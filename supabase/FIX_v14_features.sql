-- TrotroOS v1.4 features — run once in Supabase SQL Editor
-- Verification, pickup stops, scheduled demand, safety reports, push tokens,
-- favorites sync, fleet groups, mate subscriptions, boarding RPC

-- ─── Mate verification & monetization ───────────────────────────────────────
ALTER TABLE public.mate_profiles
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS verification_level int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promoted_until timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_tier text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS fleet_id uuid;

CREATE TABLE IF NOT EXISTS public.mate_verification_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mate_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type IN ('phone', 'id', 'license', 'vehicle')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  UNIQUE (mate_id, doc_type)
);

-- ─── Fleet / B2B shuttles ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fleet_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_phone text,
  corridor_label text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mate_profiles
  DROP CONSTRAINT IF EXISTS mate_profiles_fleet_id_fkey;
ALTER TABLE public.mate_profiles
  ADD CONSTRAINT mate_profiles_fleet_id_fkey
  FOREIGN KEY (fleet_id) REFERENCES public.fleet_groups(id) ON DELETE SET NULL;

-- ─── Pickup stop on demand queue ────────────────────────────────────────────
ALTER TABLE public.passenger_locations
  ADD COLUMN IF NOT EXISTS pickup_stop text;

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS pickup_stop text;

-- Allow onboarded status (walk-up uses mate counter only)
ALTER TABLE public.reservations DROP CONSTRAINT IF EXISTS reservations_status_check;
ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_status_check
  CHECK (status IN ('active', 'cancelled', 'expired', 'onboarded'));

-- ─── Scheduled demand ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.scheduled_demand (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  passenger_id text NOT NULL,
  route_label text NOT NULL,
  pickup_stop text,
  scheduled_at timestamptz NOT NULL,
  repeat_days int[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'fulfilled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_demand_time ON public.scheduled_demand (scheduled_at)
  WHERE status = 'active';

-- ─── Safety / dispute reports ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.safety_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id text NOT NULL,
  reporter_role text NOT NULL CHECK (reporter_role IN ('passenger', 'mate')),
  trip_id uuid REFERENCES public.trips(id) ON DELETE SET NULL,
  reservation_id uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  category text NOT NULL CHECK (category IN ('fare_dispute', 'safety', 'harassment', 'wrong_route', 'other')),
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── Push tokens ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  user_role text NOT NULL CHECK (user_role IN ('passenger', 'mate')),
  expo_push_token text NOT NULL,
  platform text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, expo_push_token)
);

-- ─── Synced favorite routes ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.passenger_favorite_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  passenger_id text NOT NULL,
  route_id text NOT NULL,
  route_label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (passenger_id, route_id)
);

-- ─── Board reservation (prevents double seat decrement) ─────────────────────
CREATE OR REPLACE FUNCTION public.board_reservation(
  p_reservation_id uuid,
  p_mate_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res reservations%ROWTYPE;
  v_trip trips%ROWTYPE;
  v_new_seats int;
  v_status text;
BEGIN
  SELECT * INTO v_res FROM reservations WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Reservation not found');
  END IF;
  IF v_res.status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Reservation is not active');
  END IF;

  SELECT * INTO v_trip FROM trips WHERE id = v_res.trip_id FOR UPDATE;
  IF NOT FOUND OR v_trip.mate_id <> p_mate_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Trip not found or not yours');
  END IF;
  IF v_trip.available_seats <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Trip is full');
  END IF;

  UPDATE reservations SET status = 'onboarded' WHERE id = p_reservation_id;

  v_new_seats := v_trip.available_seats - 1;
  v_status := CASE WHEN v_new_seats <= 0 THEN 'full' ELSE v_trip.status END;

  UPDATE trips
  SET available_seats = v_new_seats,
      status = v_status
  WHERE id = v_trip.id;

  RETURN jsonb_build_object(
    'ok', true,
    'available_seats', v_new_seats,
    'trip_status', v_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.board_reservation(uuid, uuid) TO authenticated, anon;

-- ─── RLS (permissive for MVP — tighten for production) ────────────────────────
ALTER TABLE public.mate_verification_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_demand ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passenger_favorite_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mate_verification_docs_own ON public.mate_verification_docs;
CREATE POLICY mate_verification_docs_own ON public.mate_verification_docs
  FOR ALL USING (auth.uid() = mate_id) WITH CHECK (auth.uid() = mate_id);

DROP POLICY IF EXISTS scheduled_demand_all ON public.scheduled_demand;
CREATE POLICY scheduled_demand_all ON public.scheduled_demand FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS safety_reports_insert ON public.safety_reports;
CREATE POLICY safety_reports_insert ON public.safety_reports FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS safety_reports_read ON public.safety_reports;
CREATE POLICY safety_reports_read ON public.safety_reports FOR SELECT USING (true);

DROP POLICY IF EXISTS push_tokens_all ON public.push_tokens;
CREATE POLICY push_tokens_all ON public.push_tokens FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS passenger_favorites_all ON public.passenger_favorite_routes;
CREATE POLICY passenger_favorites_all ON public.passenger_favorite_routes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS fleet_groups_read ON public.fleet_groups;
CREATE POLICY fleet_groups_read ON public.fleet_groups FOR SELECT USING (active = true);

-- Realtime (optional)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduled_demand;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';
