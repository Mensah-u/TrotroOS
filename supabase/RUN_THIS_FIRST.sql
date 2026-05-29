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
