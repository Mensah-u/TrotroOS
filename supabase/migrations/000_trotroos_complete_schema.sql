-- ============================================================================
-- TrotroOS · Complete backend schema (run once in Supabase SQL Editor)
-- Safe to re-run: uses IF NOT EXISTS + DROP POLICY IF EXISTS
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

-- Lets PostgREST join trips → mate_profiles for Find Ride cards
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

drop policy if exists "Mates manage own trips" on public.trips;
drop policy if exists "Anyone can read active trips" on public.trips;
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


-- ─── 4. driver_locations ───────────────────────────────────────────────────
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


-- ─── 5. passenger_locations ──────────────────────────────────────────────────
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


-- ─── 6. passenger_profiles (Profile tab backend) ─────────────────────────────
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
drop policy if exists "Anyone read passenger profiles" on public.passenger_profiles;

create policy "Anyone manage passenger profiles"
  on public.passenger_profiles for all to anon, authenticated
  using (true) with check (true);


-- ─── 7. ratings ──────────────────────────────────────────────────────────────
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
create index if not exists ratings_passenger_device_id_idx on public.ratings (passenger_device_id);

alter table public.ratings enable row level security;

drop policy if exists "ratings_insert_anyone" on public.ratings;
drop policy if exists "ratings_select_anyone" on public.ratings;

create policy "ratings_insert_anyone"
  on public.ratings for insert to anon, authenticated
  with check (true);

create policy "ratings_select_anyone"
  on public.ratings for select to anon, authenticated
  using (true);


-- ─── 8. Enable Realtime ──────────────────────────────────────────────────────
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
