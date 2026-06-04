-- ═══════════════════════════════════════════════════════════════════════════
-- TrotroOS · COMPLETE DATABASE SETUP (auto-generated)
-- Generated: 2026-06-04T06:49:25.552Z
--
-- Paste this ENTIRE file into Supabase SQL Editor → Run once
-- https://supabase.com/dashboard/project/siwzjxwholmoassrdtwx/sql/new
--
-- After Run: Settings → API → Reload schema (or wait ~60s)
-- Then reload the app (press r in Metro)
--
-- Source files (in order):
--   1. RUN_THIS_FIRST.sql
--   2. FIX_trip_fare.sql
--   3. FIX_v14_features.sql
--   4. FIX_mate_ride_requests.sql
--   5. FIX_mate_reservations.sql
--   6. FIX_nearby_indexes.sql
--   7. FIX_payments_and_wallet.sql
--   8. migrations/007_payment_transactions.sql
--   9. migrations/008_payment_reservation_link.sql
--   10. migrations/009_mate_invite_payments.sql
--   11. migrations/010_mate_payouts.sql
--   12. FIX_reservations_passenger_id_alter.sql
--   13. FIX_baseline_rls_policies.sql
--   14. FIX_security_hardening.sql
--   15. FIX_missing_ride_request_rpc.sql
--
-- Safe to re-run on an existing project (uses IF NOT EXISTS / DROP POLICY IF EXISTS).
-- ═══════════════════════════════════════════════════════════════════════════



-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- BEGIN: RUN_THIS_FIRST.sql
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- ============================================================================
-- TrotroOS · ONE-TIME SETUP (paste entire file into Supabase SQL Editor → Run)
-- Dashboard: https://supabase.com/dashboard/project/siwzjxwholmoassrdtwx/sql/new
-- Fixes: "could not find the table public.mate_profiles in the schema cache"
-- Safe to re-run.
-- ============================================================================

-- ─── 1. mate_profiles ───────────────────────────────────────────────────────
create table if not exists public.mate_profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  full_name            text not null,
  phone_number         text not null,
  vehicle_registration text not null,
  vehicle_type         text not null,
  default_route        text,
  created_at           timestamptz not null default now()
);

alter table public.mate_profiles enable row level security;

drop policy if exists "Mate can read own profile" on public.mate_profiles;
drop policy if exists "Mate can insert own profile" on public.mate_profiles;
drop policy if exists "Mate can update own profile" on public.mate_profiles;
drop policy if exists "Passengers can read mate profiles" on public.mate_profiles;

create policy "Mate can read own profile"
  on public.mate_profiles for select to authenticated
  using (auth.uid() = id);

create policy "Mate can insert own profile"
  on public.mate_profiles for insert to authenticated
  with check (auth.uid() = id);

create policy "Mate can update own profile"
  on public.mate_profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

create policy "Passengers can read mate profiles"
  on public.mate_profiles for select to anon, authenticated
  using (true);


-- ─── 2. trips ───────────────────────────────────────────────────────────────
create table if not exists public.trips (
  id               uuid primary key default gen_random_uuid(),
  mate_id          uuid not null references auth.users(id) on delete cascade,
  route            text not null,
  origin           text not null,
  destination      text not null,
  total_seats      integer not null check (total_seats > 0),
  available_seats  integer not null check (available_seats >= 0),
  status           text not null default 'active',
  created_at       timestamptz not null default now()
);

-- Backfill mate_profiles for mates who already have trips (fixes FK error on re-run)
insert into public.mate_profiles (id, full_name, phone_number, vehicle_registration, vehicle_type)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1), 'Mate'),
  coalesce(u.raw_user_meta_data->>'phone_number', '0000000000'),
  coalesce(u.raw_user_meta_data->>'vehicle_registration', 'PENDING'),
  coalesce(u.raw_user_meta_data->>'vehicle_type', 'Trotro')
from auth.users u
where u.id in (select distinct mate_id from public.trips)
  and not exists (select 1 from public.mate_profiles mp where mp.id = u.id)
on conflict (id) do nothing;

-- Remove orphan trips whose mate_id is not a real auth user (rare)
delete from public.trips t
where not exists (select 1 from auth.users u where u.id = t.mate_id);

do $$
begin
  alter table public.trips
    add constraint trips_mate_profile_fkey
    foreign key (mate_id) references public.mate_profiles(id);
exception when duplicate_object then null;
end $$;

create index if not exists trips_mate_id_idx on public.trips (mate_id);
create index if not exists trips_status_idx on public.trips (status);

alter table public.trips enable row level security;

drop policy if exists "Mates can insert own trips" on public.trips;
drop policy if exists "Mates can update own trips" on public.trips;
drop policy if exists "Mates can delete own trips" on public.trips;
drop policy if exists "Mates can read own trips" on public.trips;
drop policy if exists "Public can read active trips" on public.trips;

create policy "Mates can insert own trips"
  on public.trips for insert to authenticated
  with check (auth.uid() = mate_id);

create policy "Mates can update own trips"
  on public.trips for update to authenticated
  using (auth.uid() = mate_id) with check (auth.uid() = mate_id);

create policy "Mates can delete own trips"
  on public.trips for delete to authenticated
  using (auth.uid() = mate_id);

create policy "Mates can read own trips"
  on public.trips for select to authenticated
  using (auth.uid() = mate_id);

create policy "Public can read active trips"
  on public.trips for select to anon, authenticated
  using (status in ('active', 'full'));


-- ─── 3. reservations ────────────────────────────────────────────────────────
create table if not exists public.reservations (
  id            uuid primary key default gen_random_uuid(),
  trip_id       uuid not null references public.trips(id) on delete cascade,
  passenger_id  text,
  status        text not null default 'active',
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now()
);

create index if not exists reservations_trip_id_idx on public.reservations (trip_id);
create index if not exists reservations_passenger_id_idx on public.reservations (passenger_id);

alter table public.reservations enable row level security;

drop policy if exists "Anyone can create reservations" on public.reservations;
drop policy if exists "Anyone can read reservations" on public.reservations;
drop policy if exists "Mates read reservations for own trips" on public.reservations;

create policy "Anyone can create reservations"
  on public.reservations for insert to anon, authenticated
  with check (true);

create policy "Anyone can read reservations"
  on public.reservations for select to anon, authenticated
  using (true);

create policy "Mates read reservations for own trips"
  on public.reservations for select to authenticated
  using (
    exists (
      select 1 from public.trips t
      where t.id = trip_id and t.mate_id = auth.uid()
    )
  );


-- ─── 4. driver_locations ────────────────────────────────────────────────────
create table if not exists public.driver_locations (
  mate_id          uuid primary key references auth.users(id) on delete cascade,
  route            text not null,
  latitude         double precision,
  longitude        double precision,
  available_seats  integer not null default 0,
  heading          double precision,
  updated_at       timestamptz not null default now()
);

alter table public.driver_locations enable row level security;

drop policy if exists "Mates manage own driver location" on public.driver_locations;
drop policy if exists "Public read driver locations" on public.driver_locations;

create policy "Mates manage own driver location"
  on public.driver_locations for all to authenticated
  using (auth.uid() = mate_id) with check (auth.uid() = mate_id);

create policy "Public read driver locations"
  on public.driver_locations for select to anon, authenticated
  using (true);


-- ─── 5. passenger_locations ─────────────────────────────────────────────────
create table if not exists public.passenger_locations (
  passenger_id    text primary key,
  reservation_id  uuid references public.reservations(id) on delete set null,
  latitude        double precision not null,
  longitude       double precision not null,
  queued_route    text,
  updated_at      timestamptz not null default now()
);

create index if not exists passenger_locations_queued_route_idx
  on public.passenger_locations (queued_route);

alter table public.passenger_locations enable row level security;

drop policy if exists "Anyone manage passenger locations" on public.passenger_locations;
drop policy if exists "Anyone read passenger locations" on public.passenger_locations;

create policy "Anyone manage passenger locations"
  on public.passenger_locations for all to anon, authenticated
  using (true) with check (true);


-- ─── 6. passenger_profiles ──────────────────────────────────────────────────
create table if not exists public.passenger_profiles (
  device_id       text primary key,
  display_name    text not null default 'Passenger',
  phone           text default '',
  notify_trips    boolean not null default true,
  notify_reserve  boolean not null default true,
  notify_promo    boolean not null default false,
  share_location  boolean not null default true,
  anonymous_mode  boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.passenger_profiles enable row level security;

drop policy if exists "Anyone manage passenger profiles" on public.passenger_profiles;

create policy "Anyone manage passenger profiles"
  on public.passenger_profiles for all to anon, authenticated
  using (true) with check (true);


-- ─── 7. ratings ─────────────────────────────────────────────────────────────
create table if not exists public.ratings (
  id                  uuid primary key default gen_random_uuid(),
  trip_id             uuid not null references public.trips(id) on delete cascade,
  mate_id             uuid not null references auth.users(id) on delete cascade,
  passenger_device_id text not null,
  stars               integer not null check (stars between 1 and 5),
  comment             text,
  created_at          timestamptz not null default now(),
  unique (trip_id, passenger_device_id)
);

create index if not exists ratings_mate_id_idx on public.ratings (mate_id);

alter table public.ratings enable row level security;

drop policy if exists "ratings_insert_anyone" on public.ratings;
drop policy if exists "ratings_select_anyone" on public.ratings;

create policy "ratings_insert_anyone"
  on public.ratings for insert to anon, authenticated
  with check (true);

create policy "ratings_select_anyone"
  on public.ratings for select to anon, authenticated
  using (true);


-- ─── 8. Realtime ────────────────────────────────────────────────────────────
alter table public.trips replica identity full;
alter table public.reservations replica identity full;
alter table public.driver_locations replica identity full;
alter table public.passenger_locations replica identity full;
alter table public.ratings replica identity full;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'trips', 'reservations', 'driver_locations',
    'passenger_locations', 'ratings'
  ]
  loop
    begin
      execute format(
        'alter publication supabase_realtime add table public.%I',
        tbl
      );
    exception when duplicate_object then
      null;
    end;
  end loop;
end $$;


-- ─── 9. Reservation seat sync ─────────────────────────────────────────────────
create or replace function public.on_reservation_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  seats integer;
begin
  select available_seats into seats
  from public.trips
  where id = new.trip_id
  for update;

  if seats is null then
    raise exception 'Trip not found';
  end if;

  if seats <= 0 then
    raise exception 'Trip is full';
  end if;

  update public.trips
  set
    available_seats = available_seats - 1,
    status = case when available_seats - 1 <= 0 then 'full' else status end
  where id = new.trip_id;

  return new;
end;
$$;

drop trigger if exists trg_reservation_insert on public.reservations;
create trigger trg_reservation_insert
  after insert on public.reservations
  for each row
  when (new.status = 'active')
  execute function public.on_reservation_insert();

create or replace function public.on_reservation_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'active' and new.status in ('cancelled', 'expired') then
    update public.trips
    set
      available_seats = least(available_seats + 1, total_seats),
      status = case
        when status in ('full', 'active') and available_seats + 1 > 0 then 'active'
        else status
      end
    where id = old.trip_id
      and status in ('active', 'full');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reservation_cancel on public.reservations;
create trigger trg_reservation_cancel
  after update of status on public.reservations
  for each row
  execute function public.on_reservation_cancel();

create or replace function public.cancel_reservation(
  p_reservation_id uuid,
  p_passenger_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.reservations%rowtype;
begin
  select * into r
  from public.reservations
  where id = p_reservation_id
    and passenger_id = p_passenger_id
    and status = 'active'
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Reservation not found or already ended');
  end if;

  update public.reservations
  set status = 'cancelled'
  where id = p_reservation_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.cancel_reservation(uuid, text) to anon, authenticated;

create or replace function public.expire_stale_reservations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  update public.reservations
  set status = 'expired'
  where status = 'active'
    and expires_at < now();

  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on function public.expire_stale_reservations() to anon, authenticated;

-- Done. Reload schema: Settings → API → Reload schema (or wait ~1 min), then retry mate sign-up.


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- BEGIN: FIX_trip_fare.sql
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- BEGIN: FIX_v14_features.sql
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- BEGIN: FIX_mate_ride_requests.sql
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- BEGIN: FIX_mate_reservations.sql
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- BEGIN: FIX_nearby_indexes.sql
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX_nearby_indexes.sql
--
-- Indexes + optional geohash columns to make 2 km nearby queries cheap.
--
-- Run in Supabase SQL Editor.
--
-- Adds:
--   • B-tree indexes on (latitude, longitude) for bounding-box scans.
--   • A `geohash5` generated column on driver_locations and passenger_locations.
--   • An index on geohash5 for prefix / `in (...)` queries.
--
-- The mobile client uses bounding-box filtering today; geohash5 is here so we
-- can switch to `geohash5 in ('gc8…', 'gc9…', …)` later without another
-- migration once Postgres scans start to hurt.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Geohash helper (pure SQL, no extensions required) ───────────────────
create or replace function public.geohash_encode(
  lat double precision,
  lng double precision,
  hash_len int default 5
)
returns text
language plpgsql
immutable
parallel safe
as $$
declare
  base32 constant text := '0123456789bcdefghjkmnpqrstuvwxyz';
  lat_min double precision := -90;
  lat_max double precision :=  90;
  lng_min double precision := -180;
  lng_max double precision :=  180;
  bits   int := 0;
  bit_n  int := 0;
  even   boolean := true;
  hash   text := '';
  mid    double precision;
begin
  if lat is null or lng is null then return null; end if;

  while char_length(hash) < hash_len loop
    if even then
      mid := (lng_min + lng_max) / 2;
      if lng >= mid then bits := (bits << 1) | 1; lng_min := mid;
      else                bits := bits << 1;       lng_max := mid;
      end if;
    else
      mid := (lat_min + lat_max) / 2;
      if lat >= mid then bits := (bits << 1) | 1; lat_min := mid;
      else                bits := bits << 1;       lat_max := mid;
      end if;
    end if;
    even := not even;
    bit_n := bit_n + 1;
    if bit_n = 5 then
      hash  := hash || substr(base32, bits + 1, 1);
      bits  := 0;
      bit_n := 0;
    end if;
  end loop;

  return hash;
end;
$$;

-- ─── 2. driver_locations ────────────────────────────────────────────────────
create index if not exists driver_locations_lat_lng_idx
  on public.driver_locations (latitude, longitude);

alter table public.driver_locations
  add column if not exists geohash5 text
  generated always as (public.geohash_encode(latitude, longitude, 5)) stored;

create index if not exists driver_locations_geohash5_idx
  on public.driver_locations (geohash5);

-- ─── 3. passenger_locations ─────────────────────────────────────────────────
create index if not exists passenger_locations_lat_lng_idx
  on public.passenger_locations (latitude, longitude);

alter table public.passenger_locations
  add column if not exists geohash5 text
  generated always as (public.geohash_encode(latitude, longitude, 5)) stored;

create index if not exists passenger_locations_geohash5_idx
  on public.passenger_locations (geohash5);

-- ─── 4. Refresh PostgREST schema cache ──────────────────────────────────────
notify pgrst, 'reload schema';


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- BEGIN: FIX_payments_and_wallet.sql
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- ─────────────────────────────────────────────────────────────────────────
-- Payments, wallet ledger, webhook idempotency.
--
-- Run this AFTER FIX_mate_depart_now.sql. Idempotent — safe to re-run.
--
-- This migration backs:
--   • server/api/index.js  → /payments/init, /webhooks/paystack, /wallet/*
--   • services/paymentsApi.js (client)
--
-- The mobile client never writes to these tables directly. RLS is locked down
-- to authenticated reads of own rows; all writes happen via the service role
-- key on the backend.
-- ─────────────────────────────────────────────────────────────────────────

-- 1. webhook_events — idempotency for any external webhook (Paystack today,
-- Stripe / momo provider tomorrow). The unique constraint is the linchpin
-- that prevents double-crediting on retries.
create table if not exists public.webhook_events (
  id          uuid primary key default gen_random_uuid(),
  provider    text not null,
  event_id    text not null,
  event_type  text,
  raw         jsonb,
  created_at  timestamptz not null default now(),
  unique (provider, event_id)
);

alter table public.webhook_events enable row level security;

drop policy if exists "webhook_events: no client access" on public.webhook_events;
create policy "webhook_events: no client access"
  on public.webhook_events for all to public using (false) with check (false);

-- 2. payments — one row per Paystack transaction attempt.
create table if not exists public.payments (
  id                 uuid primary key default gen_random_uuid(),
  reference          text not null unique,
  reservation_id     uuid references public.reservations(id) on delete set null,
  passenger_id       text,
  amount_ghs         numeric(12,2) not null,
  channel            text,
  provider           text not null default 'paystack',
  status             text not null default 'pending'
                       check (status in ('pending','success','failed','cancelled')),
  provider_response  jsonb,
  created_at         timestamptz not null default now(),
  processed_at       timestamptz
);

create index if not exists payments_reservation_idx on public.payments (reservation_id);
create index if not exists payments_passenger_idx   on public.payments (passenger_id);
create index if not exists payments_status_idx      on public.payments (status);

alter table public.payments enable row level security;

drop policy if exists "payments: passenger reads own" on public.payments;
create policy "payments: passenger reads own"
  on public.payments for select to authenticated
  using (
    passenger_id = auth.uid()::text
    or reservation_id in (
      select id from public.reservations where passenger_id = auth.uid()::text
    )
  );

-- 3. wallet_ledger — append-only audit trail of every wallet movement.
create table if not exists public.wallet_ledger (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  kind        text not null check (kind in ('credit','debit','spend','payout')),
  amount_ghs  numeric(12,2) not null,
  reference   text,
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists wallet_ledger_user_idx on public.wallet_ledger (user_id, created_at desc);
create index if not exists wallet_ledger_ref_idx  on public.wallet_ledger (reference);

alter table public.wallet_ledger enable row level security;

drop policy if exists "wallet_ledger: user reads own" on public.wallet_ledger;
create policy "wallet_ledger: user reads own"
  on public.wallet_ledger for select to authenticated
  using (user_id = auth.uid()::text);

-- 4. wallet_balances — derived view so the server can read a single row.
create or replace view public.wallet_balances as
  select
    user_id,
    coalesce(sum(case when kind in ('credit','payout') then amount_ghs else 0 end), 0)
      - coalesce(sum(case when kind in ('debit','spend')  then amount_ghs else 0 end), 0)
      as balance_ghs,
    max(created_at) as last_txn_at
  from public.wallet_ledger
  group by user_id;

grant select on public.wallet_balances to authenticated, service_role;

-- 5. Make Postgres reload PostgREST schema cache so the new tables show up.
notify pgrst, 'reload schema';


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- BEGIN: migrations/007_payment_transactions.sql
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- ─────────────────────────────────────────────────────────────────────────
-- TrotroOS · payment_transactions (Paystack MoMo seat booking)
--
-- Backs Supabase Edge Functions:
--   • initialize-payment
--   • paystack-webhook
--
-- Fee model (computed server-side only):
--   total = seat_fare + (8% × seat_fare) + 1 GHS request fee
--   Paystack amount = total × 100 pesewas
-- ─────────────────────────────────────────────────────────────────────────

-- webhook idempotency (safe if FIX_payments_and_wallet.sql already ran)
create table if not exists public.webhook_events (
  id          uuid primary key default gen_random_uuid(),
  provider    text not null,
  event_id    text not null,
  event_type  text,
  raw         jsonb,
  created_at  timestamptz not null default now(),
  unique (provider, event_id)
);

alter table public.webhook_events enable row level security;

drop policy if exists "webhook_events: no client access" on public.webhook_events;
create policy "webhook_events: no client access"
  on public.webhook_events for all to public using (false) with check (false);

grant all on public.webhook_events to service_role;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_transaction_status') then
    create type public.payment_transaction_status as enum ('pending', 'success', 'failed');
  end if;
end $$;

create table if not exists public.payment_transactions (
  id                 uuid primary key default gen_random_uuid(),
  -- TrotroOS passengers: user_id = passenger_profiles.device_id (device-scoped profile)
  user_id            text not null
                       references public.passenger_profiles (device_id)
                       on delete restrict,
  reference          text not null unique,
  amount_in_pesewas  integer not null check (amount_in_pesewas > 0),
  seat_fare          numeric(12, 2) not null check (seat_fare > 0),
  platform_fee       numeric(12, 2) not null check (platform_fee >= 0),
  request_fee        numeric(12, 2) not null default 1.00 check (request_fee >= 0),
  status             public.payment_transaction_status not null default 'pending',
  reservation_id     uuid references public.reservations (id) on delete set null,
  paystack_access_code text,
  metadata           jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists payment_transactions_user_idx
  on public.payment_transactions (user_id, created_at desc);

create index if not exists payment_transactions_status_idx
  on public.payment_transactions (status);

create index if not exists payment_transactions_reservation_idx
  on public.payment_transactions (reservation_id)
  where reservation_id is not null;

-- Auto-update updated_at
create or replace function public.set_payment_transactions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists payment_transactions_updated_at on public.payment_transactions;
create trigger payment_transactions_updated_at
  before update on public.payment_transactions
  for each row execute function public.set_payment_transactions_updated_at();

alter table public.payment_transactions enable row level security;

drop policy if exists "payment_transactions: no client writes" on public.payment_transactions;
create policy "payment_transactions: no client writes"
  on public.payment_transactions for insert to public
  with check (false);

drop policy if exists "payment_transactions: no client updates" on public.payment_transactions;
create policy "payment_transactions: no client updates"
  on public.payment_transactions for update to public
  using (false) with check (false);

drop policy if exists "payment_transactions: user reads own" on public.payment_transactions;
create policy "payment_transactions: user reads own"
  on public.payment_transactions for select to anon, authenticated
  using (
    user_id = coalesce(
      nullif(trim(current_setting('request.headers', true)::json->>'x-device-id'), ''),
      nullif(trim(current_setting('request.headers', true)::json->>'X-Device-Id'), ''),
      auth.uid()::text
    )
  );

grant select on public.payment_transactions to anon, authenticated;
grant all on public.payment_transactions to service_role;

notify pgrst, 'reload schema';


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- BEGIN: migrations/008_payment_reservation_link.sql
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Link successful Paystack payments to active reservations (no invalid 'paid' status).
-- Run after 007_payment_transactions.sql

alter table public.reservations
  add column if not exists payment_reference text;

create index if not exists reservations_payment_reference_idx
  on public.reservations (payment_reference)
  where payment_reference is not null;

comment on column public.reservations.payment_reference is
  'Paystack reference from payment_transactions when MoMo/card checkout succeeds.';

notify pgrst, 'reload schema';


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- BEGIN: migrations/009_mate_invite_payments.sql
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Mate seat-invite payments: driver pays 8% of trip fare + GHS 1 request fee per invite.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_kind') then
    create type public.payment_kind as enum ('passenger_booking', 'mate_invite');
  end if;
end $$;

alter table public.payment_transactions
  drop constraint if exists payment_transactions_user_id_fkey;

alter table public.payment_transactions
  add column if not exists payment_kind public.payment_kind not null default 'passenger_booking';

alter table public.payment_transactions
  add column if not exists trip_id uuid references public.trips (id) on delete set null;

alter table public.payment_transactions
  add column if not exists mate_ride_request_id uuid references public.mate_ride_requests (id) on delete set null;

create index if not exists payment_transactions_trip_idx
  on public.payment_transactions (trip_id)
  where trip_id is not null;

alter table public.mate_ride_requests
  add column if not exists payment_reference text;

create unique index if not exists mate_ride_requests_payment_ref_idx
  on public.mate_ride_requests (payment_reference)
  where payment_reference is not null;

-- ─── Verify mate invite payment before sending request ───────────────────────
create or replace function public.verify_mate_invite_payment(
  p_reference text,
  p_trip_id uuid,
  p_mate_id uuid,
  p_trip_fare numeric
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  pay public.payment_transactions%rowtype;
  expected_pesewas integer;
  trip_pesewas integer;
begin
  if p_reference is null or trim(p_reference) = '' then
    return false;
  end if;

  select * into pay
  from public.payment_transactions
  where reference = trim(p_reference)
    and status = 'success'
    and payment_kind = 'mate_invite'
  limit 1;

  if not found then
    return false;
  end if;

  if pay.user_id <> p_mate_id::text then
    return false;
  end if;

  if pay.trip_id is distinct from p_trip_id then
    return false;
  end if;

  if exists (
    select 1 from public.mate_ride_requests
    where payment_reference = pay.reference
  ) then
    return false;
  end if;

  trip_pesewas := round(coalesce(p_trip_fare, 0) * 100)::integer;
  if trip_pesewas <= 0 then
    return false;
  end if;

  expected_pesewas := round(trip_pesewas * 0.08)::integer + 100;

  if pay.amount_in_pesewas <> expected_pesewas then
    return false;
  end if;

  return true;
end;
$$;

revoke all on function public.verify_mate_invite_payment(text, uuid, uuid, numeric) from public;
grant execute on function public.verify_mate_invite_payment(text, uuid, uuid, numeric) to authenticated;

-- ─── send_mate_ride_request: require paid invite when trip has a fare ─────────
create or replace function public.send_mate_ride_request(
  p_trip_id uuid,
  p_passenger_id text,
  p_payment_reference text default null,
  p_enforce_payment boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  t public.trips%rowtype;
  loc public.passenger_locations%rowtype;
  rec public.mate_ride_requests%rowtype;
  pid text := trim(p_passenger_id);
  v_fare numeric(12, 2) := null;
  pay_ref text := nullif(trim(p_payment_reference), '');
begin
  perform public.expire_stale_mate_ride_requests();

  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'Not signed in');
  end if;
  if pid is null or pid = '' then
    return jsonb_build_object('ok', false, 'error', 'Passenger ID required');
  end if;

  select * into t from public.trips where id = p_trip_id for update;
  if not found or t.mate_id <> uid then
    return jsonb_build_object('ok', false, 'error', 'Trip not found');
  end if;
  if t.status not in ('active', 'full') or t.available_seats <= 0 then
    return jsonb_build_object('ok', false, 'error', 'No seats available');
  end if;

  select * into loc from public.passenger_locations where passenger_id = pid;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Passenger is not sharing location');
  end if;
  if loc.reservation_id is not null then
    return jsonb_build_object('ok', false, 'error', 'Passenger already has a reservation');
  end if;

  select coalesce(
    t.fare_ghs,
    (
      select dl.fare_ghs
      from public.driver_locations dl
      where dl.mate_id = uid
      order by dl.updated_at desc nulls last
      limit 1
    )
  )
  into v_fare;

  if p_enforce_payment and coalesce(v_fare, 0) > 0 then
    if pay_ref is null then
      return jsonb_build_object(
        'ok', false,
        'error', 'Pay invite fee (8% + GHS 1) before sending this request',
        'payment_required', true
      );
    end if;
    if not public.verify_mate_invite_payment(pay_ref, p_trip_id, uid, v_fare) then
      return jsonb_build_object(
        'ok', false,
        'error', 'Payment not confirmed — complete MoMo checkout and try again',
        'payment_required', true
      );
    end if;
  end if;

  update public.mate_ride_requests
  set status = 'expired'
  where trip_id = p_trip_id
    and passenger_id = pid
    and status = 'pending'
    and expires_at <= now();

  select * into rec
  from public.mate_ride_requests
  where trip_id = p_trip_id
    and passenger_id = pid
    and status = 'pending'
    and expires_at > now()
  limit 1;

  if found then
    update public.mate_ride_requests
    set expires_at = now() + interval '30 minutes',
        payment_reference = coalesce(payment_reference, pay_ref)
    where id = rec.id;

    select * into rec from public.mate_ride_requests where id = rec.id;

    return jsonb_build_object('ok', true, 'request', to_jsonb(rec), 'already_sent', true);
  end if;

  insert into public.mate_ride_requests (
    trip_id, mate_id, passenger_id, route_label, fare_ghs, status, expires_at, payment_reference
  )
  values (
    t.id,
    uid,
    pid,
    coalesce(t.route, t.origin || ' → ' || t.destination),
    v_fare,
    'pending',
    now() + interval '30 minutes',
    pay_ref
  )
  returning * into rec;

  if pay_ref is not null then
    update public.payment_transactions
    set mate_ride_request_id = rec.id,
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('mate_ride_request_id', rec.id)
    where reference = pay_ref;
  end if;

  return jsonb_build_object('ok', true, 'request', to_jsonb(rec), 'already_sent', false);
exception
  when unique_violation then
    perform public.expire_stale_mate_ride_requests();

    select * into rec
    from public.mate_ride_requests
    where trip_id = p_trip_id
      and passenger_id = pid
      and status = 'pending'
      and expires_at > now()
    limit 1;

    if found then
      update public.mate_ride_requests
      set expires_at = now() + interval '30 minutes',
          payment_reference = coalesce(payment_reference, pay_ref)
      where id = rec.id;

      select * into rec from public.mate_ride_requests where id = rec.id;

      return jsonb_build_object('ok', true, 'request', to_jsonb(rec), 'already_sent', true);
    end if;

    return jsonb_build_object('ok', false, 'error', 'Could not send request');
  when others then
    return jsonb_build_object('ok', false, 'error', sqlerrm);
end;
$$;

revoke all on function public.send_mate_ride_request(uuid, text, text, boolean) from public;
grant execute on function public.send_mate_ride_request(uuid, text, text, boolean) to authenticated;

notify pgrst, 'reload schema';


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- BEGIN: migrations/010_mate_payouts.sql
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Mate payout requests — mates request MoMo transfer of accumulated earnings.
-- Admin reviews / approves; server initiates Paystack Transfer on approval.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'payout_status') then
    create type public.payout_status as enum ('pending', 'processing', 'paid', 'rejected');
  end if;
end $$;

create table if not exists public.mate_payout_requests (
  id            uuid primary key default gen_random_uuid(),
  mate_id       uuid not null references auth.users (id) on delete cascade,
  amount_ghs    numeric(12, 2) not null check (amount_ghs > 0),
  momo_number   text not null,
  network       text not null default 'MTN' check (network in ('MTN', 'Vodafone', 'AirtelTigo')),
  status        public.payout_status not null default 'pending',
  admin_note    text,
  paystack_transfer_code text,
  requested_at  timestamptz not null default now(),
  processed_at  timestamptz
);

create index if not exists mate_payout_requests_mate_idx
  on public.mate_payout_requests (mate_id, requested_at desc);

create index if not exists mate_payout_requests_status_idx
  on public.mate_payout_requests (status);

alter table public.mate_payout_requests enable row level security;

drop policy if exists "payout: mate reads own" on public.mate_payout_requests;
create policy "payout: mate reads own"
  on public.mate_payout_requests for select to authenticated
  using (mate_id = auth.uid());

drop policy if exists "payout: mate inserts own" on public.mate_payout_requests;
create policy "payout: mate inserts own"
  on public.mate_payout_requests for insert to authenticated
  with check (mate_id = auth.uid());

drop policy if exists "payout: no client update" on public.mate_payout_requests;
create policy "payout: no client update"
  on public.mate_payout_requests for update to authenticated
  using (false);

grant select, insert on public.mate_payout_requests to authenticated;
grant all on public.mate_payout_requests to service_role;

-- ─── Request payout RPC (rate-limited to 1 pending per mate) ──────────────
create or replace function public.request_mate_payout(
  p_amount_ghs numeric,
  p_momo_number text,
  p_network text default 'MTN'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  pending_count integer;
  min_payout numeric := 5.00;
  max_payout numeric := 5000.00;
  network text := upper(trim(p_network));
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'Not signed in');
  end if;

  if coalesce(p_amount_ghs, 0) < min_payout then
    return jsonb_build_object('ok', false, 'error', format('Minimum payout is GHS %s', min_payout));
  end if;
  if p_amount_ghs > max_payout then
    return jsonb_build_object('ok', false, 'error', format('Maximum single payout is GHS %s', max_payout));
  end if;

  if trim(p_momo_number) = '' or length(trim(p_momo_number)) < 10 then
    return jsonb_build_object('ok', false, 'error', 'Enter a valid MoMo number (10+ digits)');
  end if;

  if network not in ('MTN', 'VODAFONE', 'AIRTELTIGO') then
    network := 'MTN';
  end if;
  if network = 'VODAFONE' then network := 'Vodafone'; end if;
  if network = 'AIRTELTIGO' then network := 'AirtelTigo'; end if;

  select count(*) into pending_count
  from public.mate_payout_requests
  where mate_id = uid
    and status = 'pending';

  if pending_count > 0 then
    return jsonb_build_object(
      'ok', false,
      'error', 'You already have a pending payout request. Wait for it to be processed.'
    );
  end if;

  insert into public.mate_payout_requests (
    mate_id, amount_ghs, momo_number, network, status
  )
  values (
    uid,
    p_amount_ghs,
    trim(p_momo_number),
    network,
    'pending'
  );

  return jsonb_build_object('ok', true, 'message', 'Payout request submitted. Processed within 1–2 business days.');
exception
  when others then
    return jsonb_build_object('ok', false, 'error', sqlerrm);
end;
$$;

revoke all on function public.request_mate_payout(numeric, text, text) from public;
grant execute on function public.request_mate_payout(numeric, text, text) to authenticated;

notify pgrst, 'reload schema';


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- BEGIN: FIX_reservations_passenger_id_alter.sql
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- ============================================================================
-- TrotroOS · Fix: cannot alter type of column used in a policy definition
-- Error: policy reservations_passenger_view depends on column passenger_id
--
-- Paste ALL of this in Supabase SQL Editor → Run once → Reload schema
-- https://supabase.com/dashboard/project/siwzjxwholmoassrdtwx/sql/new
-- ============================================================================

-- ─── 1. Drop EVERY policy on reservations (required before ALTER COLUMN) ───

ALTER TABLE public.reservations DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reservations_passenger_view" ON public.reservations;
DROP POLICY IF EXISTS "reservations_passenger_insert" ON public.reservations;
DROP POLICY IF EXISTS "Anyone can create reservations" ON public.reservations;
DROP POLICY IF EXISTS "Anyone can read reservations" ON public.reservations;
DROP POLICY IF EXISTS "Passenger create reservation" ON public.reservations;
DROP POLICY IF EXISTS "Passenger read own reservations" ON public.reservations;
DROP POLICY IF EXISTS "Mates read reservations for own trips" ON public.reservations;

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT p.polname
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'reservations'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.reservations', pol.polname);
    RAISE NOTICE 'Dropped policy: %', pol.polname;
  END LOOP;
END $$;

DO $$
DECLARE
  cnt int;
BEGIN
  SELECT count(*) INTO cnt
  FROM pg_policy p
  JOIN pg_class c ON c.oid = p.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'reservations';

  IF cnt > 0 THEN
    RAISE EXCEPTION 'Still % policies on reservations — remove them in Dashboard → Database → Policies, then re-run', cnt;
  END IF;
END $$;

-- ─── 2. Alter passenger_id → text (device UUID, not auth.users id) ─────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reservations'
      AND column_name = 'passenger_id'
      AND udt_name = 'text'
  ) THEN
    RAISE NOTICE 'passenger_id is already text — skipping alter';
  ELSE
    ALTER TABLE public.reservations
      ALTER COLUMN passenger_id TYPE text USING passenger_id::text;
    RAISE NOTICE 'passenger_id converted to text';
  END IF;
END $$;

-- ─── 3. Ensure passenger_profiles + FK exist ────────────────────────────────

CREATE TABLE IF NOT EXISTS public.passenger_profiles (
  device_id       text PRIMARY KEY,
  display_name    text NOT NULL DEFAULT 'Passenger',
  phone           text DEFAULT '',
  notify_trips    boolean NOT NULL DEFAULT true,
  notify_reserve  boolean NOT NULL DEFAULT true,
  notify_promo    boolean NOT NULL DEFAULT false,
  share_location  boolean NOT NULL DEFAULT true,
  anonymous_mode  boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.passenger_profiles (device_id, display_name)
SELECT DISTINCT r.passenger_id, 'Passenger'
FROM public.reservations r
WHERE r.passenger_id IS NOT NULL
  AND trim(r.passenger_id) <> ''
ON CONFLICT (device_id) DO NOTHING;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'reservations'
      AND c.contype = 'f'
      AND pg_get_constraintdef(c.oid) ILIKE '%passenger_id%'
  LOOP
    EXECUTE format('ALTER TABLE public.reservations DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_passenger_id_fkey
  FOREIGN KEY (passenger_id)
  REFERENCES public.passenger_profiles (device_id)
  ON DELETE SET NULL
  NOT VALID;

ALTER TABLE public.reservations VALIDATE CONSTRAINT reservations_passenger_id_fkey;

-- ─── 4. Helper + RLS policies (TrotroOS device-id model) ───────────────────

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

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reservations_passenger_view"
  ON public.reservations
  FOR SELECT TO anon, authenticated
  USING (passenger_id = public.request_device_id());

CREATE POLICY "reservations_passenger_insert"
  ON public.reservations
  FOR INSERT TO anon, authenticated
  WITH CHECK (passenger_id = public.request_device_id());

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

GRANT SELECT, INSERT ON public.reservations TO anon, authenticated;

NOTIFY pgrst, 'reload schema';


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- BEGIN: FIX_baseline_rls_policies.sql
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- BEGIN: FIX_security_hardening.sql
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
DROP POLICY IF EXISTS "push_tokens_passenger_own" ON public.push_tokens;
DROP POLICY IF EXISTS "push_tokens_passenger_authenticated_own" ON public.push_tokens;
DROP POLICY IF EXISTS "push_tokens_mate_own" ON public.push_tokens;
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


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- BEGIN: FIX_missing_ride_request_rpc.sql
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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

-- ═══════════════════════════════════════════════════════════════════════════
-- END TrotroOS_COMPLETE.sql
NOTIFY pgrst, 'reload schema';
