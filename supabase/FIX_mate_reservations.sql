-- Mate dashboard: read active seat reservations for own trips.
-- Run once in Supabase SQL Editor, then reload schema (~30s).

-- Ensure mates can SELECT reservations on their active trips (RLS).
DROP POLICY IF EXISTS "Mates read reservations for own trips" ON public.reservations;

CREATE POLICY "Mates read reservations for own trips"
  ON public.reservations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = trip_id AND t.mate_id = auth.uid()
    )
  );

-- Reliable fetch for mate UI (works even when direct SELECT is blocked).
CREATE OR REPLACE FUNCTION public.get_mate_trip_reservations(p_trip_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  rows jsonb;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not signed in');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.trips t
    WHERE t.id = p_trip_id AND t.mate_id = uid
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Trip not found');
  END IF;

  SELECT coalesce(
    jsonb_agg(to_jsonb(r) ORDER BY r.created_at ASC),
    '[]'::jsonb
  )
  INTO rows
  FROM public.reservations r
  WHERE r.trip_id = p_trip_id
    AND r.status = 'active'
    AND r.expires_at > now();

  RETURN jsonb_build_object('ok', true, 'reservations', rows);
END;
$$;

REVOKE ALL ON FUNCTION public.get_mate_trip_reservations(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_mate_trip_reservations(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
