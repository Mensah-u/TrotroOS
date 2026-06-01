-- ============================================================================
-- TrotroOS · Baseline RLS policies (TrotroOS-adapted)
-- Paste ALL into Supabase SQL Editor → Run (safe to re-run)
-- https://supabase.com/dashboard/project/siwzjxwholmoassrdtwx/sql/new
--
-- NOTE: Do NOT run generic auth.uid()-only policies on this project.
-- Passengers use device IDs (x-device-id header), not Supabase auth.
-- For full Security Advisor hardening, also run FIX_security_hardening.sql
-- ============================================================================

-- ─── Helper: read passenger device id from API request header ────────────────

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

-- ====================================================================
-- 1. ENABLE ROW-LEVEL SECURITY
-- ====================================================================

ALTER TABLE IF EXISTS public.passenger_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.safety_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fleet_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mate_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mate_verification_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.passenger_favorite_routes ENABLE ROW LEVEL SECURITY;

-- ====================================================================
-- 2. BASELINE POLICIES (idempotent — drops old names first)
-- ====================================================================

-- ─── PASSENGER PROFILES (PK = device_id, not auth.users.id) ─────────────────

DROP POLICY IF EXISTS "passenger_profiles_owner_access" ON public.passenger_profiles;
DROP POLICY IF EXISTS "Anyone manage passenger profiles" ON public.passenger_profiles;
DROP POLICY IF EXISTS "Passenger profile select own" ON public.passenger_profiles;
DROP POLICY IF EXISTS "Passenger profile insert own" ON public.passenger_profiles;
DROP POLICY IF EXISTS "Passenger profile update own" ON public.passenger_profiles;

CREATE POLICY "passenger_profiles_owner_access"
  ON public.passenger_profiles
  FOR ALL TO anon, authenticated
  USING (device_id = public.request_device_id())
  WITH CHECK (device_id = public.request_device_id());

-- ─── PUSH TOKENS (user_id is text: device id OR mate auth uuid) ──────────────

DROP POLICY IF EXISTS "push_tokens_owner_access" ON public.push_tokens;
DROP POLICY IF EXISTS "push_tokens_all" ON public.push_tokens;
DROP POLICY IF EXISTS "Push tokens passenger own" ON public.push_tokens;
DROP POLICY IF EXISTS "Push tokens mate own" ON public.push_tokens;
DROP POLICY IF EXISTS "push_tokens_passenger_own" ON public.push_tokens;
DROP POLICY IF EXISTS "push_tokens_passenger_authenticated_own" ON public.push_tokens;
DROP POLICY IF EXISTS "push_tokens_mate_own" ON public.push_tokens;

CREATE POLICY "push_tokens_passenger_own"
  ON public.push_tokens
  FOR ALL TO anon
  USING (user_role = 'passenger' AND user_id = public.request_device_id())
  WITH CHECK (user_role = 'passenger' AND user_id = public.request_device_id());

CREATE POLICY "push_tokens_passenger_authenticated_own"
  ON public.push_tokens
  FOR ALL TO authenticated
  USING (user_role = 'passenger' AND user_id = public.request_device_id())
  WITH CHECK (user_role = 'passenger' AND user_id = public.request_device_id());

CREATE POLICY "push_tokens_mate_own"
  ON public.push_tokens
  FOR ALL TO authenticated
  USING (user_role = 'mate' AND user_id = auth.uid()::text)
  WITH CHECK (user_role = 'mate' AND user_id = auth.uid()::text);

-- ─── RESERVATIONS (passenger_id = device_id text) ───────────────────────────

DROP POLICY IF EXISTS "reservations_passenger_view" ON public.reservations;
DROP POLICY IF EXISTS "reservations_passenger_insert" ON public.reservations;
DROP POLICY IF EXISTS "Anyone can create reservations" ON public.reservations;
DROP POLICY IF EXISTS "Anyone can read reservations" ON public.reservations;
DROP POLICY IF EXISTS "Passenger create reservation" ON public.reservations;
DROP POLICY IF EXISTS "Passenger read own reservations" ON public.reservations;

CREATE POLICY "reservations_passenger_view"
  ON public.reservations
  FOR SELECT TO anon, authenticated
  USING (passenger_id = public.request_device_id());

CREATE POLICY "reservations_passenger_insert"
  ON public.reservations
  FOR INSERT TO anon, authenticated
  WITH CHECK (passenger_id = public.request_device_id());

-- Mates must read reservations on their own trips (dashboard boarding)
DROP POLICY IF EXISTS "Mates read reservations for own trips" ON public.reservations;
CREATE POLICY "Mates read reservations for own trips"
  ON public.reservations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = reservations.trip_id
        AND t.mate_id = auth.uid()
    )
  );

-- ─── RATINGS (passenger_device_id, not rater_id) ────────────────────────────

DROP POLICY IF EXISTS "ratings_insert_policy" ON public.ratings;
DROP POLICY IF EXISTS "ratings_select_policy" ON public.ratings;
DROP POLICY IF EXISTS "ratings_insert_anyone" ON public.ratings;
DROP POLICY IF EXISTS "ratings_select_anyone" ON public.ratings;
DROP POLICY IF EXISTS "Passenger insert own rating" ON public.ratings;

CREATE POLICY "ratings_insert_policy"
  ON public.ratings
  FOR INSERT TO anon, authenticated
  WITH CHECK (passenger_device_id = public.request_device_id());

CREATE POLICY "ratings_select_policy"
  ON public.ratings
  FOR SELECT TO anon, authenticated
  USING (true);

-- ─── SAFETY REPORTS (reporter_id, not passenger_id) ─────────────────────────

DROP POLICY IF EXISTS "safety_reports_passenger_insert" ON public.safety_reports;
DROP POLICY IF EXISTS "safety_reports_passenger_view_own" ON public.safety_reports;
DROP POLICY IF EXISTS "safety_reports_insert" ON public.safety_reports;
DROP POLICY IF EXISTS "safety_reports_read" ON public.safety_reports;
DROP POLICY IF EXISTS "Safety reports insert" ON public.safety_reports;
DROP POLICY IF EXISTS "Safety reports read own" ON public.safety_reports;

CREATE POLICY "safety_reports_passenger_insert"
  ON public.safety_reports
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    reporter_id = public.request_device_id()
    OR (auth.uid() IS NOT NULL AND reporter_id = auth.uid()::text)
  );

CREATE POLICY "safety_reports_passenger_view_own"
  ON public.safety_reports
  FOR SELECT TO anon, authenticated
  USING (
    reporter_id = public.request_device_id()
    OR (auth.uid() IS NOT NULL AND reporter_id = auth.uid()::text)
  );

-- ─── FLEET GROUPS ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "fleet_groups_authenticated_view" ON public.fleet_groups;
DROP POLICY IF EXISTS "fleet_groups_read" ON public.fleet_groups;
DROP POLICY IF EXISTS "fleet_groups_anon_view" ON public.fleet_groups;

CREATE POLICY "fleet_groups_authenticated_view"
  ON public.fleet_groups
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "fleet_groups_anon_view"
  ON public.fleet_groups
  FOR SELECT TO anon
  USING (active = true);

-- ─── MATE PROFILES ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "mate_profiles_owner_access" ON public.mate_profiles;
DROP POLICY IF EXISTS "mate_profiles_public_view" ON public.mate_profiles;
DROP POLICY IF EXISTS "Mate can read own profile" ON public.mate_profiles;
DROP POLICY IF EXISTS "Mate can insert own profile" ON public.mate_profiles;
DROP POLICY IF EXISTS "Mate can update own profile" ON public.mate_profiles;
DROP POLICY IF EXISTS "Passengers can read mate profiles" ON public.mate_profiles;

CREATE POLICY "mate_profiles_owner_access"
  ON public.mate_profiles
  FOR ALL TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "mate_profiles_public_view"
  ON public.mate_profiles
  FOR SELECT TO anon, authenticated
  USING (true);

-- ─── MATE VERIFICATION DOCS ─────────────────────────────────────────────────

DROP POLICY IF EXISTS "mate_docs_restrictive_access" ON public.mate_verification_docs;
DROP POLICY IF EXISTS "mate_verification_docs_own" ON public.mate_verification_docs;

CREATE POLICY "mate_docs_restrictive_access"
  ON public.mate_verification_docs
  FOR ALL TO authenticated
  USING (auth.uid() = mate_id)
  WITH CHECK (auth.uid() = mate_id);

-- ─── PASSENGER FAVORITE ROUTES ──────────────────────────────────────────────

DROP POLICY IF EXISTS "favorite_routes_owner_access" ON public.passenger_favorite_routes;
DROP POLICY IF EXISTS "passenger_favorites_all" ON public.passenger_favorite_routes;
DROP POLICY IF EXISTS "Favorite routes passenger own" ON public.passenger_favorite_routes;

CREATE POLICY "favorite_routes_owner_access"
  ON public.passenger_favorite_routes
  FOR ALL TO anon
  USING (passenger_id = public.request_device_id())
  WITH CHECK (passenger_id = public.request_device_id());

-- ─── Grants ─────────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON public.passenger_profiles TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_tokens TO anon, authenticated;
GRANT SELECT, INSERT ON public.ratings TO anon, authenticated;
GRANT SELECT, INSERT ON public.reservations TO anon, authenticated;
GRANT SELECT, INSERT ON public.safety_reports TO anon, authenticated;
GRANT SELECT ON public.fleet_groups TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.mate_profiles TO authenticated;
GRANT SELECT ON public.mate_profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mate_verification_docs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.passenger_favorite_routes TO anon;

-- ====================================================================
-- 3. CORE RIDE TABLES (Find Ride, Depart Now, live map)
-- ====================================================================

ALTER TABLE IF EXISTS public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.driver_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.passenger_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mate_ride_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.scheduled_demand ENABLE ROW LEVEL SECURITY;

-- ─── TRIPS ──────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Mates can insert own trips" ON public.trips;
DROP POLICY IF EXISTS "Mates can update own trips" ON public.trips;
DROP POLICY IF EXISTS "Mates can delete own trips" ON public.trips;
DROP POLICY IF EXISTS "Mates can read own trips" ON public.trips;
DROP POLICY IF EXISTS "Public can read active trips" ON public.trips;

CREATE POLICY "Mates can insert own trips"
  ON public.trips FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = mate_id);

CREATE POLICY "Mates can update own trips"
  ON public.trips FOR UPDATE TO authenticated
  USING (auth.uid() = mate_id)
  WITH CHECK (auth.uid() = mate_id);

CREATE POLICY "Mates can delete own trips"
  ON public.trips FOR DELETE TO authenticated
  USING (auth.uid() = mate_id);

CREATE POLICY "Mates can read own trips"
  ON public.trips FOR SELECT TO authenticated
  USING (auth.uid() = mate_id);

CREATE POLICY "Public can read active trips"
  ON public.trips FOR SELECT TO anon, authenticated
  USING (status IN ('active', 'full'));

-- ─── DRIVER LOCATIONS ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Mates manage own driver location" ON public.driver_locations;
DROP POLICY IF EXISTS "Public read driver locations" ON public.driver_locations;

CREATE POLICY "Mates manage own driver location"
  ON public.driver_locations FOR ALL TO authenticated
  USING (auth.uid() = mate_id)
  WITH CHECK (auth.uid() = mate_id);

CREATE POLICY "Public read driver locations"
  ON public.driver_locations FOR SELECT TO anon, authenticated
  USING (true);

-- ─── PASSENGER LOCATIONS (demand queue + I'm waiting) ──────────────────────

DROP POLICY IF EXISTS "Anyone manage passenger locations" ON public.passenger_locations;
DROP POLICY IF EXISTS "Anyone read passenger locations" ON public.passenger_locations;
DROP POLICY IF EXISTS "Passenger location manage own" ON public.passenger_locations;
DROP POLICY IF EXISTS "Passenger location read own" ON public.passenger_locations;
DROP POLICY IF EXISTS "Mate read passenger locations" ON public.passenger_locations;

CREATE POLICY "Passenger location manage own"
  ON public.passenger_locations FOR ALL TO anon, authenticated
  USING (passenger_id = public.request_device_id())
  WITH CHECK (passenger_id = public.request_device_id());

CREATE POLICY "Mate read passenger locations"
  ON public.passenger_locations FOR SELECT TO authenticated
  USING (true);

-- ─── MATE RIDE REQUESTS (mate invites waiting passengers) ───────────────────

DROP POLICY IF EXISTS "Mate read own ride requests" ON public.mate_ride_requests;
DROP POLICY IF EXISTS "Passenger read own ride requests" ON public.mate_ride_requests;

CREATE POLICY "Mate read own ride requests"
  ON public.mate_ride_requests FOR SELECT TO authenticated
  USING (mate_id = auth.uid());

CREATE POLICY "Passenger read own ride requests"
  ON public.mate_ride_requests FOR SELECT TO anon, authenticated
  USING (passenger_id = public.request_device_id());

-- ─── SCHEDULED DEMAND ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS "scheduled_demand_all" ON public.scheduled_demand;
DROP POLICY IF EXISTS "Scheduled demand passenger own" ON public.scheduled_demand;
DROP POLICY IF EXISTS "Scheduled demand mate read active" ON public.scheduled_demand;

CREATE POLICY "Scheduled demand passenger own"
  ON public.scheduled_demand FOR ALL TO anon, authenticated
  USING (passenger_id = public.request_device_id())
  WITH CHECK (passenger_id = public.request_device_id());

CREATE POLICY "Scheduled demand mate read active"
  ON public.scheduled_demand FOR SELECT TO authenticated
  USING (status = 'active');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trips TO authenticated;
GRANT SELECT ON public.trips TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_locations TO authenticated;
GRANT SELECT ON public.driver_locations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.passenger_locations TO anon, authenticated;
GRANT SELECT ON public.mate_ride_requests TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_demand TO anon, authenticated;

-- ─── Passenger mate-invite RPC fallback ───────────────────────────────────────

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
