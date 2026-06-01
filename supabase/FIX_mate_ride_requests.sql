-- Mate invites waiting passengers (same route, no reservation yet).
-- Run once in Supabase SQL Editor, then reload schema (~30s).

-- Helper: passenger device id from x-device-id header (also in FIX_security_hardening.sql)
CREATE OR REPLACE FUNCTION public.request_device_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(
    trim(
      coalesce(
        current_setting('request.headers', true)::json->>'x-device-id',
        current_setting('request.headers', true)::json->>'X-Device-Id',
        ''
      )
    ),
    ''
  );
$$;

REVOKE ALL ON FUNCTION public.request_device_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_device_id() TO anon, authenticated, service_role;

-- Fare column (also in FIX_trip_fare.sql — safe if already applied)
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS fare_ghs numeric(12, 2);

ALTER TABLE public.driver_locations
  ADD COLUMN IF NOT EXISTS fare_ghs numeric(12, 2);

CREATE TABLE IF NOT EXISTS public.mate_ride_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id       uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  mate_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  passenger_id  text NOT NULL,
  route_label   text NOT NULL,
  fare_ghs      numeric(12, 2),
  status        text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
  expires_at    timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mate_ride_requests_trip_idx
  ON public.mate_ride_requests (trip_id, status);

CREATE INDEX IF NOT EXISTS mate_ride_requests_passenger_idx
  ON public.mate_ride_requests (passenger_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS mate_ride_requests_one_pending
  ON public.mate_ride_requests (trip_id, passenger_id)
  WHERE status = 'pending';

ALTER TABLE public.mate_ride_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Mate read own ride requests" ON public.mate_ride_requests;
DROP POLICY IF EXISTS "Passenger read own ride requests" ON public.mate_ride_requests;

CREATE POLICY "Mate read own ride requests"
  ON public.mate_ride_requests FOR SELECT TO authenticated
  USING (mate_id = auth.uid());

CREATE POLICY "Passenger read own ride requests"
  ON public.mate_ride_requests FOR SELECT TO anon, authenticated
  USING (passenger_id = public.request_device_id());

ALTER TABLE public.mate_ride_requests REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.mate_ride_requests;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'realtime mate_ride_requests: %', SQLERRM;
END $$;

-- ─── Mate sends invite to a waiting passenger ────────────────────────────────
CREATE OR REPLACE FUNCTION public.expire_stale_mate_ride_requests()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  UPDATE public.mate_ride_requests
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at <= now();

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_mate_ride_request(
  p_trip_id uuid,
  p_passenger_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  t public.trips%ROWTYPE;
  loc public.passenger_locations%ROWTYPE;
  rec public.mate_ride_requests%ROWTYPE;
  pid text := trim(p_passenger_id);
  v_fare numeric(12, 2) := NULL;
BEGIN
  PERFORM public.expire_stale_mate_ride_requests();

  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not signed in');
  END IF;
  IF pid IS NULL OR pid = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Passenger ID required');
  END IF;

  SELECT * INTO t FROM public.trips WHERE id = p_trip_id FOR UPDATE;
  IF NOT FOUND OR t.mate_id <> uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Trip not found');
  END IF;
  IF t.status NOT IN ('active', 'full') OR t.available_seats <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No seats available');
  END IF;

  SELECT * INTO loc FROM public.passenger_locations WHERE passenger_id = pid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Passenger is not sharing location');
  END IF;
  IF loc.reservation_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Passenger already has a reservation');
  END IF;

  UPDATE public.mate_ride_requests
  SET status = 'expired'
  WHERE trip_id = p_trip_id
    AND passenger_id = pid
    AND status = 'pending'
    AND expires_at <= now();

  SELECT * INTO rec
  FROM public.mate_ride_requests
  WHERE trip_id = p_trip_id
    AND passenger_id = pid
    AND status = 'pending'
    AND expires_at > now()
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.mate_ride_requests
    SET expires_at = now() + interval '30 minutes'
    WHERE id = rec.id;

    SELECT * INTO rec FROM public.mate_ride_requests WHERE id = rec.id;

    RETURN jsonb_build_object('ok', true, 'request', to_jsonb(rec), 'already_sent', true);
  END IF;

  SELECT coalesce(
    t.fare_ghs,
    (
      SELECT dl.fare_ghs
      FROM public.driver_locations dl
      WHERE dl.mate_id = uid
      ORDER BY dl.updated_at DESC NULLS LAST
      LIMIT 1
    )
  )
  INTO v_fare;

  INSERT INTO public.mate_ride_requests (
    trip_id, mate_id, passenger_id, route_label, fare_ghs, status, expires_at
  )
  VALUES (
    t.id,
    uid,
    pid,
    coalesce(t.route, t.origin || ' → ' || t.destination),
    v_fare,
    'pending',
    now() + interval '30 minutes'
  )
  RETURNING * INTO rec;

  RETURN jsonb_build_object('ok', true, 'request', to_jsonb(rec), 'already_sent', false);
EXCEPTION
  WHEN unique_violation THEN
    PERFORM public.expire_stale_mate_ride_requests();

    SELECT * INTO rec
    FROM public.mate_ride_requests
    WHERE trip_id = p_trip_id
      AND passenger_id = pid
      AND status = 'pending'
      AND expires_at > now()
    LIMIT 1;

    IF FOUND THEN
      UPDATE public.mate_ride_requests
      SET expires_at = now() + interval '30 minutes'
      WHERE id = rec.id;

      SELECT * INTO rec FROM public.mate_ride_requests WHERE id = rec.id;

      RETURN jsonb_build_object('ok', true, 'request', to_jsonb(rec), 'already_sent', true);
    END IF;

    RETURN jsonb_build_object('ok', false, 'error', 'Could not send request');
  WHEN others THEN
    RETURN jsonb_build_object('ok', false, 'error', sqlerrm);
END;
$$;

-- ─── Passenger accepts or declines ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.respond_mate_ride_request(
  p_request_id uuid,
  p_passenger_id text,
  p_accept boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req public.mate_ride_requests%ROWTYPE;
  t public.trips%ROWTYPE;
  res public.reservations%ROWTYPE;
  pid text := trim(p_passenger_id);
BEGIN
  IF pid IS NULL OR pid = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Passenger ID required');
  END IF;

  SELECT * INTO req
  FROM public.mate_ride_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Request not found');
  END IF;
  IF req.passenger_id <> pid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not your request');
  END IF;

  IF req.status = 'accepted' AND p_accept THEN
    SELECT * INTO res
    FROM public.reservations
    WHERE trip_id = req.trip_id
      AND passenger_id = pid
      AND status = 'active'
      AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'ok', true,
        'accepted', true,
        'reservation', to_jsonb(res),
        'trip_id', req.trip_id
      );
    END IF;
  END IF;

  IF req.status = 'declined' AND NOT p_accept THEN
    RETURN jsonb_build_object('ok', true, 'accepted', false);
  END IF;

  IF req.status = 'expired' AND p_accept AND req.expires_at > now() - interval '30 minutes' THEN
    UPDATE public.mate_ride_requests
    SET status = 'pending', expires_at = now() + interval '30 minutes'
    WHERE id = req.id;

    SELECT * INTO req FROM public.mate_ride_requests WHERE id = req.id;
  END IF;

  IF req.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This invite is no longer available');
  END IF;

  IF req.expires_at <= now() THEN
    UPDATE public.mate_ride_requests
    SET expires_at = now() + interval '30 minutes'
    WHERE id = req.id;

    SELECT * INTO req FROM public.mate_ride_requests WHERE id = req.id;
  END IF;

  IF NOT p_accept THEN
    UPDATE public.mate_ride_requests SET status = 'declined' WHERE id = req.id;
    RETURN jsonb_build_object('ok', true, 'accepted', false);
  END IF;

  SELECT * INTO t FROM public.trips WHERE id = req.trip_id FOR UPDATE;
  IF NOT FOUND OR t.status NOT IN ('active', 'full') OR t.available_seats <= 0 THEN
    UPDATE public.mate_ride_requests SET status = 'expired' WHERE id = req.id;
    RETURN jsonb_build_object('ok', false, 'error', 'Trip is full or ended');
  END IF;

  INSERT INTO public.passenger_profiles (device_id, display_name)
  VALUES (pid, 'Passenger')
  ON CONFLICT (device_id) DO NOTHING;

  INSERT INTO public.reservations (trip_id, passenger_id, status, expires_at)
  VALUES (req.trip_id, pid, 'active', now() + interval '30 minutes')
  RETURNING * INTO res;

  UPDATE public.mate_ride_requests SET status = 'accepted' WHERE id = req.id;

  UPDATE public.passenger_locations
  SET reservation_id = res.id,
      updated_at = now()
  WHERE passenger_id = pid;

  RETURN jsonb_build_object(
    'ok', true,
    'accepted', true,
    'reservation', to_jsonb(res),
    'trip_id', req.trip_id
  );
EXCEPTION
  WHEN others THEN
    RETURN jsonb_build_object('ok', false, 'error', sqlerrm);
END;
$$;

REVOKE ALL ON FUNCTION public.expire_stale_mate_ride_requests() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_stale_mate_ride_requests() TO anon, authenticated;

REVOKE ALL ON FUNCTION public.send_mate_ride_request(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_mate_ride_request(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.respond_mate_ride_request(uuid, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_mate_ride_request(uuid, text, boolean) TO anon, authenticated;

-- Reliable passenger fetch (uses x-device-id header; no nested joins).
CREATE OR REPLACE FUNCTION public.get_my_pending_mate_ride_requests()
RETURNS SETOF public.mate_ride_requests
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.mate_ride_requests
  WHERE passenger_id = public.request_device_id()
    AND status = 'pending'
    AND expires_at > now()
  ORDER BY created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_my_pending_mate_ride_requests() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_pending_mate_ride_requests() TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
