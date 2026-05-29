-- ============================================================================
-- TrotroOS · FIX "Permission denied" on Depart Now / start trip
-- Paste ALL of this into Supabase SQL Editor → Run (safe to re-run)
-- https://supabase.com/dashboard/project/siwzjxwholmoassrdtwx/sql/new
-- ============================================================================

-- ─── 0. Table access for API roles ───────────────────────────────────────────
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
grant usage, select on all sequences in schema public to authenticated;

-- ─── 1. mate_profiles (required before trip insert if FK exists) ───────────────
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

-- Backfill profile for every signed-in mate
insert into public.mate_profiles (id, full_name, phone_number, vehicle_registration, vehicle_type)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1), 'Mate'),
  coalesce(u.raw_user_meta_data->>'phone_number', '0000000000'),
  coalesce(u.raw_user_meta_data->>'vehicle_registration', 'PENDING'),
  coalesce(u.raw_user_meta_data->>'vehicle_type', 'Trotro')
from auth.users u
where not exists (select 1 from public.mate_profiles mp where mp.id = u.id)
on conflict (id) do nothing;

-- ─── 2. trips table + RLS ────────────────────────────────────────────────────
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

-- Optional link to mate_profiles (skip if orphans exist)
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

alter table public.trips drop constraint if exists trips_mate_profile_fkey;

do $$
begin
  alter table public.trips
    add constraint trips_mate_profile_fkey
    foreign key (mate_id) references public.mate_profiles(id);
exception when others then
  raise notice 'trips_mate_profile_fkey skipped: %', sqlerrm;
end $$;

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

-- ─── 3. driver_locations ─────────────────────────────────────────────────────
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

-- ─── 4. RPC: start trip (bypasses RLS edge cases) ────────────────────────────
create or replace function public.create_mate_trip(
  p_route text,
  p_origin text,
  p_destination text,
  p_total_seats integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  rec public.trips%rowtype;
  meta jsonb;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'Not signed in');
  end if;

  if p_total_seats is null or p_total_seats < 1 then
    return jsonb_build_object('ok', false, 'error', 'Invalid seat count');
  end if;

  select raw_user_meta_data into meta from auth.users where id = uid;

  insert into public.mate_profiles (id, full_name, phone_number, vehicle_registration, vehicle_type)
  values (
    uid,
    coalesce(meta->>'full_name', split_part((select email from auth.users where id = uid), '@', 1), 'Mate'),
    coalesce(meta->>'phone_number', '0000000000'),
    coalesce(meta->>'vehicle_registration', 'PENDING'),
    coalesce(meta->>'vehicle_type', 'Trotro')
  )
  on conflict (id) do nothing;

  insert into public.trips (
    mate_id, route, origin, destination, total_seats, available_seats, status
  )
  values (
    uid, p_route, p_origin, p_destination, p_total_seats, p_total_seats, 'active'
  )
  returning * into rec;

  return jsonb_build_object('ok', true, 'trip', to_jsonb(rec));
exception
  when others then
    return jsonb_build_object('ok', false, 'error', sqlerrm);
end;
$$;

revoke all on function public.create_mate_trip(text, text, text, integer) from public;
grant execute on function public.create_mate_trip(text, text, text, integer) to authenticated;

-- Reload API schema cache
notify pgrst, 'reload schema';

-- Done → wait 30s → app: Mate → Depart Now
