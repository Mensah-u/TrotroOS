-- ============================================================================
-- TrotroOS · Fix trips + mate_profiles RLS (mate "Depart Now" insert blocked)
-- Run this in Supabase → SQL Editor
-- ============================================================================

-- ─── mate_profiles (if table missing) ───────────────────────────────────────
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

drop policy if exists "Mate can read own profile"   on public.mate_profiles;
drop policy if exists "Mate can insert own profile"   on public.mate_profiles;
drop policy if exists "Mate can update own profile"   on public.mate_profiles;
drop policy if exists "Passengers can read mate profiles" on public.mate_profiles;

create policy "Mate can read own profile"
  on public.mate_profiles for select to authenticated
  using (auth.uid() = id);

create policy "Mate can insert own profile"
  on public.mate_profiles for insert to authenticated
  with check (auth.uid() = id);

create policy "Mate can update own profile"
  on public.mate_profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Passengers need mate name/plate on trip cards
create policy "Passengers can read mate profiles"
  on public.mate_profiles for select to anon, authenticated
  using (true);


-- ─── trips ───────────────────────────────────────────────────────────────────
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

alter table public.trips enable row level security;

-- Drop old/conflicting policies
drop policy if exists "Mates manage own trips"        on public.trips;
drop policy if exists "Anyone can read active trips"  on public.trips;
drop policy if exists "Mates can insert own trips"  on public.trips;
drop policy if exists "Mates can update own trips"  on public.trips;
drop policy if exists "Mates can delete own trips"  on public.trips;
drop policy if exists "Public can read active trips"  on public.trips;

-- Mate: create a trip (Depart Now)
create policy "Mates can insert own trips"
  on public.trips for insert to authenticated
  with check (auth.uid() = mate_id);

-- Mate: update seats / end trip
create policy "Mates can update own trips"
  on public.trips for update to authenticated
  using (auth.uid() = mate_id)
  with check (auth.uid() = mate_id);

-- Mate: optional delete
create policy "Mates can delete own trips"
  on public.trips for delete to authenticated
  using (auth.uid() = mate_id);

-- Mate: read own trip history
create policy "Mates can read own trips"
  on public.trips for select to authenticated
  using (auth.uid() = mate_id);

-- Passengers (anonymous): read live trips on Find Ride screen
create policy "Public can read active trips"
  on public.trips for select to anon, authenticated
  using (status in ('active', 'full'));
