-- ============================================================================
-- TrotroOS · Security hardening (Supabase Security Advisor)
-- Project: Mensah-u / mensahstephen385@gmail.com
--
-- Run ONCE in Supabase Dashboard → SQL Editor → Run
-- Safe to re-run (idempotent drops + recreates policies)
--
-- BEFORE: Deploy updated app (services/supabase.js sends x-device-id header)
-- AFTER:  Settings → API → Reload schema (or wait ~60s)
-- TEST:   Passenger reserve · mate Depart Now · GPS queue · rating · push token
-- ============================================================================

-- ─── 0. Helpers ──────────────────────────────────────────────────────────────

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

-- ─── 1. Enable RLS on every public table ─────────────────────────────────────

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND NOT c.relrowsecurity
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.relname);
    RAISE NOTICE 'RLS enabled on %', r.relname;
  END LOOP;
END $$;

-- ─── 2. mate_profiles — hide phone from anonymous clients ────────────────────

DROP POLICY IF EXISTS "Passengers can read mate profiles" ON public.mate_profiles;

-- Mates still manage own row via existing authenticated policies.
-- Anon/passengers: column-level grant only (no phone_number leak).
REVOKE ALL ON public.mate_profiles FROM anon;
GRANT SELECT (
  id,
  full_name,
  vehicle_type,
  vehicle_registration,
  verification_status,
  verification_level,
  subscription_tier,
  fleet_id,
  default_route,
  created_at
) ON public.mate_profiles TO anon;

DROP POLICY IF EXISTS "Anon read mate profile cards" ON public.mate_profiles;
CREATE POLICY "Anon read mate profile cards"
  ON public.mate_profiles FOR SELECT TO anon
  USING (true);

-- ─── 3. passenger_profiles — device-scoped ───────────────────────────────────

DROP POLICY IF EXISTS "Anyone manage passenger profiles" ON public.passenger_profiles;
DROP POLICY IF EXISTS "Anyone read passenger profiles"   ON public.passenger_profiles;

DROP POLICY IF EXISTS "Passenger profile select own" ON public.passenger_profiles;
DROP POLICY IF EXISTS "Passenger profile insert own" ON public.passenger_profiles;
DROP POLICY IF EXISTS "Passenger profile update own" ON public.passenger_profiles;

CREATE POLICY "Passenger profile select own"
  ON public.passenger_profiles FOR SELECT TO anon, authenticated
  USING (device_id = public.request_device_id());

CREATE POLICY "Passenger profile insert own"
  ON public.passenger_profiles FOR INSERT TO anon, authenticated
  WITH CHECK (device_id = public.request_device_id());

CREATE POLICY "Passenger profile update own"
  ON public.passenger_profiles FOR UPDATE TO anon, authenticated
  USING (device_id = public.request_device_id())
  WITH CHECK (device_id = public.request_device_id());

-- ─── 4. passenger_locations — own writes; mates read queue ───────────────────

DROP POLICY IF EXISTS "Anyone manage passenger locations" ON public.passenger_locations;
DROP POLICY IF EXISTS "Anyone read passenger locations"   ON public.passenger_locations;

DROP POLICY IF EXISTS "Passenger location manage own" ON public.passenger_locations;
DROP POLICY IF EXISTS "Passenger location read own" ON public.passenger_locations;
DROP POLICY IF EXISTS "Mate read passenger locations" ON public.passenger_locations;

CREATE POLICY "Passenger location manage own"
  ON public.passenger_locations FOR ALL TO anon
  USING (passenger_id = public.request_device_id())
  WITH CHECK (passenger_id = public.request_device_id());

CREATE POLICY "Passenger location read own"
  ON public.passenger_locations FOR SELECT TO anon
  USING (passenger_id = public.request_device_id());

CREATE POLICY "Mate read passenger locations"
  ON public.passenger_locations FOR SELECT TO authenticated
  USING (true);

-- ─── 5. reservations — scoped reads/writes ───────────────────────────────────

DROP POLICY IF EXISTS "Anyone can create reservations" ON public.reservations;
DROP POLICY IF EXISTS "Anyone can read reservations"   ON public.reservations;

DROP POLICY IF EXISTS "Passenger create reservation" ON public.reservations;
DROP POLICY IF EXISTS "Passenger read own reservations" ON public.reservations;

CREATE POLICY "Passenger create reservation"
  ON public.reservations FOR INSERT TO anon, authenticated
  WITH CHECK (passenger_id = public.request_device_id());

CREATE POLICY "Passenger read own reservations"
  ON public.reservations FOR SELECT TO anon, authenticated
  USING (passenger_id = public.request_device_id());

-- "Mates read reservations for own trips" — keep if already present (005 / RUN_THIS_FIRST)

-- ─── 6. ratings — scoped insert; public aggregates still readable ────────────

DROP POLICY IF EXISTS "ratings_insert_anyone" ON public.ratings;

DROP POLICY IF EXISTS "Passenger insert own rating" ON public.ratings;

CREATE POLICY "Passenger insert own rating"
  ON public.ratings FOR INSERT TO anon, authenticated
  WITH CHECK (passenger_device_id = public.request_device_id());

-- ratings_select_anyone kept for mate average stars on Find Ride cards

-- ─── 7. v1.4 tables (from FIX_v14_features.sql) ──────────────────────────────

DROP POLICY IF EXISTS scheduled_demand_all ON public.scheduled_demand;
DROP POLICY IF EXISTS push_tokens_all ON public.push_tokens;
DROP POLICY IF EXISTS passenger_favorites_all ON public.passenger_favorite_routes;
DROP POLICY IF EXISTS safety_reports_insert ON public.safety_reports;
DROP POLICY IF EXISTS safety_reports_read ON public.safety_reports;

DROP POLICY IF EXISTS "Scheduled demand passenger own" ON public.scheduled_demand;
DROP POLICY IF EXISTS "Scheduled demand mate read active" ON public.scheduled_demand;
DROP POLICY IF EXISTS "Push tokens passenger own" ON public.push_tokens;
DROP POLICY IF EXISTS "Push tokens mate own" ON public.push_tokens;
DROP POLICY IF EXISTS "Favorite routes passenger own" ON public.passenger_favorite_routes;
DROP POLICY IF EXISTS "Safety reports insert" ON public.safety_reports;
DROP POLICY IF EXISTS "Safety reports read own" ON public.safety_reports;

CREATE POLICY "Scheduled demand passenger own"
  ON public.scheduled_demand FOR ALL TO anon
  USING (passenger_id = public.request_device_id())
  WITH CHECK (passenger_id = public.request_device_id());

CREATE POLICY "Scheduled demand mate read active"
  ON public.scheduled_demand FOR SELECT TO authenticated
  USING (status = 'active');

CREATE POLICY "Push tokens passenger own"
  ON public.push_tokens FOR ALL TO anon
  USING (user_role = 'passenger' AND user_id = public.request_device_id())
  WITH CHECK (user_role = 'passenger' AND user_id = public.request_device_id());

CREATE POLICY "Push tokens mate own"
  ON public.push_tokens FOR ALL TO authenticated
  USING (user_role = 'mate' AND user_id = auth.uid()::text)
  WITH CHECK (user_role = 'mate' AND user_id = auth.uid()::text);

CREATE POLICY "Favorite routes passenger own"
  ON public.passenger_favorite_routes FOR ALL TO anon
  USING (passenger_id = public.request_device_id())
  WITH CHECK (passenger_id = public.request_device_id());

CREATE POLICY "Safety reports insert"
  ON public.safety_reports FOR INSERT TO anon, authenticated
  WITH CHECK (
    reporter_id = public.request_device_id()
    OR (auth.uid() IS NOT NULL AND reporter_id = auth.uid()::text)
  );

CREATE POLICY "Safety reports read own"
  ON public.safety_reports FOR SELECT TO anon, authenticated
  USING (
    reporter_id = public.request_device_id()
    OR (auth.uid() IS NOT NULL AND reporter_id = auth.uid()::text)
  );

-- mate_verification_docs_own and fleet_groups_read — unchanged (already scoped)

-- ─── 8. SECURITY DEFINER functions — search_path + grants ────────────────────

DO $$
BEGIN
  IF to_regprocedure('public.create_mate_trip(text,text,text,integer)') IS NOT NULL THEN
    ALTER FUNCTION public.create_mate_trip(text, text, text, integer) SET search_path = public;
  END IF;
  IF to_regprocedure('public.cancel_reservation(uuid,text)') IS NOT NULL THEN
    ALTER FUNCTION public.cancel_reservation(uuid, text) SET search_path = public;
  END IF;
  IF to_regprocedure('public.expire_stale_reservations()') IS NOT NULL THEN
    ALTER FUNCTION public.expire_stale_reservations() SET search_path = public;
  END IF;
  IF to_regprocedure('public.board_reservation(uuid,uuid)') IS NOT NULL THEN
    ALTER FUNCTION public.board_reservation(uuid, uuid) SET search_path = public;
    REVOKE EXECUTE ON FUNCTION public.board_reservation(uuid, uuid) FROM anon;
    GRANT EXECUTE ON FUNCTION public.board_reservation(uuid, uuid) TO authenticated;
  END IF;
END $$;

-- ─── 9. Payments / webhooks — deny all client access ─────────────────────────

DO $$
BEGIN
  IF to_regclass('public.webhook_events') IS NOT NULL THEN
    DROP POLICY IF EXISTS "webhook_events: no client access" ON public.webhook_events;
    CREATE POLICY "webhook_events: no client access"
      ON public.webhook_events FOR ALL TO public
      USING (false) WITH CHECK (false);
  END IF;
END $$;

-- ─── 10. wallet_balances view — invoker security (PG15+) ─────────────────────

DO $$
BEGIN
  IF to_regclass('public.wallet_balances') IS NOT NULL THEN
    EXECUTE 'ALTER VIEW public.wallet_balances SET (security_invoker = true)';
  END IF;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'wallet_balances security_invoker skipped: %', SQLERRM;
END $$;

-- ─── 11. Admin dashboard (service-role alternative via RPC) ────────────────────

CREATE TABLE IF NOT EXISTS public.app_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_admins no client access" ON public.app_admins;
CREATE POLICY "app_admins no client access"
  ON public.app_admins FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- Register project owner (run after mate account exists in Auth)
INSERT INTO public.app_admins (user_id)
SELECT id FROM auth.users WHERE email = 'mensahstephen385@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.app_admins WHERE user_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not authorized');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'totalTrips', (SELECT count(*)::int FROM public.trips),
    'mateCount', (SELECT count(*)::int FROM public.mate_profiles),
    'openReports', (SELECT count(*)::int FROM public.safety_reports WHERE status = 'open'),
    'scheduledDemand', (SELECT count(*)::int FROM public.scheduled_demand WHERE status = 'active')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_open_safety_reports(p_limit int DEFAULT 25)
RETURNS SETOF public.safety_reports
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.app_admins WHERE user_id = auth.uid()
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.safety_reports
  WHERE status = 'open'
  ORDER BY created_at DESC
  LIMIT greatest(1, least(p_limit, 100));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_dashboard_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_open_safety_reports(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_open_safety_reports(int) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_recent_trips(p_limit int DEFAULT 25)
RETURNS SETOF public.trips
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.app_admins WHERE user_id = auth.uid()
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.trips
  ORDER BY created_at DESC
  LIMIT greatest(1, least(p_limit, 100));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_recent_trips(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_recent_trips(int) TO authenticated;

-- ─── 12. Reload PostgREST schema cache ───────────────────────────────────────

NOTIFY pgrst, 'reload schema';

-- Done. Verify Security Advisor → warnings should drop sharply.
-- If passenger flows fail: confirm app sends header x-device-id (see services/supabase.js).
