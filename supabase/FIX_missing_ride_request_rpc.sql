-- TrotroOS · Missing passenger mate-invite RPC (safe to re-run)
-- Paste in Supabase SQL Editor if debug shows get_my_pending_mate_ride_requests missing.

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
