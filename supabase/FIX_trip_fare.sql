-- Persist mate-set fare on live trips + driver broadcasts (passenger Find Ride cards).
-- Run once in Supabase SQL Editor, then reload schema.

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS fare_ghs numeric(12, 2);

COMMENT ON COLUMN public.trips.fare_ghs IS 'GHS fare per seat set by mate at depart time';

ALTER TABLE public.driver_locations
  ADD COLUMN IF NOT EXISTS fare_ghs numeric(12, 2);

COMMENT ON COLUMN public.driver_locations.fare_ghs IS 'GHS fare per seat broadcast with live GPS';

-- Recreate RPC with optional fare (safe to re-run).
CREATE OR REPLACE FUNCTION public.create_mate_trip(
  p_route text,
  p_origin text,
  p_destination text,
  p_total_seats integer,
  p_fare_ghs numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  rec public.trips%ROWTYPE;
  meta jsonb;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not signed in');
  END IF;

  IF p_total_seats IS NULL OR p_total_seats < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid seat count');
  END IF;

  SELECT raw_user_meta_data INTO meta FROM auth.users WHERE id = uid;

  INSERT INTO public.mate_profiles (id, full_name, phone_number, vehicle_registration, vehicle_type)
  VALUES (
    uid,
    coalesce(meta->>'full_name', split_part((select email from auth.users where id = uid), '@', 1), 'Mate'),
    coalesce(meta->>'phone_number', '0000000000'),
    coalesce(meta->>'vehicle_registration', 'PENDING'),
    coalesce(meta->>'vehicle_type', 'Trotro')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.trips (
    mate_id, route, origin, destination, total_seats, available_seats, status, fare_ghs
  )
  VALUES (
    uid,
    p_route,
    p_origin,
    p_destination,
    p_total_seats,
    p_total_seats,
    'active',
    CASE WHEN p_fare_ghs IS NOT NULL AND p_fare_ghs > 0 THEN p_fare_ghs ELSE NULL END
  )
  RETURNING * INTO rec;

  RETURN jsonb_build_object('ok', true, 'trip', to_jsonb(rec));
EXCEPTION
  WHEN others THEN
    RETURN jsonb_build_object('ok', false, 'error', sqlerrm);
END;
$$;

REVOKE ALL ON FUNCTION public.create_mate_trip(text, text, text, integer, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_mate_trip(text, text, text, integer, numeric) TO authenticated;

NOTIFY pgrst, 'reload schema';
