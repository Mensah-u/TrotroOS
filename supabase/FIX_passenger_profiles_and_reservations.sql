-- ─────────────────────────────────────────────────────────────────────────
-- TrotroOS · Fix reservation booking (passenger_id foreign key errors)
--
-- Run this entire script in Supabase → SQL Editor → Run
--
-- Fixes errors like:
--   insert or update on table "reservations" violates foreign key constraint
--   "reservations_passenger_id_fkey"
--   cannot alter type of a column used in a policy definition
--
-- TrotroOS passengers are identified by device_id (text UUID in AsyncStorage),
-- NOT auth.users. This script aligns the database with the app.
-- ─────────────────────────────────────────────────────────────────────────

-- 1. passenger_profiles — must exist BEFORE reservations FK
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

grant select, insert, update, delete on public.passenger_profiles to anon, authenticated;

-- 2. Drop ANY foreign key on reservations.passenger_id (wrong target = booking fails)
do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'reservations'
      and c.contype = 'f'
      and pg_get_constraintdef(c.oid) ilike '%passenger_id%'
  loop
    execute format('alter table public.reservations drop constraint if exists %I', r.conname);
    raise notice 'Dropped FK: %', r.conname;
  end loop;
end $$;

-- 3. Drop ALL RLS policies on reservations (required before ALTER COLUMN passenger_id)
--    Explicit names first, then any leftovers via pg_policies.
drop policy if exists "reservations_passenger_view" on public.reservations;
drop policy if exists "reservations_passenger_insert" on public.reservations;
drop policy if exists "Anyone can create reservations" on public.reservations;
drop policy if exists "Anyone can read reservations" on public.reservations;
drop policy if exists "Passenger create reservation" on public.reservations;
drop policy if exists "Passenger read own reservations" on public.reservations;
drop policy if exists "Mates read reservations for own trips" on public.reservations;

do $$
declare
  r record;
begin
  for r in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'reservations'
  loop
    execute format('drop policy if exists %I on public.reservations', r.policyname);
    raise notice 'Dropped policy: %', r.policyname;
  end loop;
end $$;

do $$
declare
  remaining int;
begin
  select count(*) into remaining
  from pg_policies
  where schemaname = 'public' and tablename = 'reservations';
  if remaining > 0 then
    raise exception 'Still % policies on reservations — drop them in Dashboard → Authentication → Policies, then re-run', remaining;
  end if;
end $$;

-- 4. passenger_id must be text (device UUID), not auth.users uuid — skip if already text
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'reservations'
      and column_name = 'passenger_id'
      and udt_name = 'text'
  ) then
    raise notice 'passenger_id is already text — skipping alter';
  else
    execute 'alter table public.reservations alter column passenger_id type text using passenger_id::text';
  end if;
end $$;

-- 5. Backfill profiles for any existing reservation passenger_ids
insert into public.passenger_profiles (device_id, display_name)
select distinct r.passenger_id, 'Passenger'
from public.reservations r
where r.passenger_id is not null
  and trim(r.passenger_id) <> ''
on conflict (device_id) do nothing;

-- 6. Re-create the correct FK → passenger_profiles.device_id
alter table public.reservations
  drop constraint if exists reservations_passenger_id_fkey;

alter table public.reservations
  add constraint reservations_passenger_id_fkey
  foreign key (passenger_id)
  references public.passenger_profiles (device_id)
  on delete set null
  not valid;

alter table public.reservations validate constraint reservations_passenger_id_fkey;

-- 7. request_device_id helper (no-op if already exists)
create or replace function public.request_device_id()
returns text
language sql
stable
as $$
  select nullif(
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

revoke all on function public.request_device_id() from public;
grant execute on function public.request_device_id() to anon, authenticated, service_role;

-- 8. Re-create reservation RLS policies
alter table public.reservations enable row level security;

create policy "reservations_passenger_view"
  on public.reservations
  for select to anon, authenticated
  using (passenger_id = public.request_device_id());

create policy "reservations_passenger_insert"
  on public.reservations
  for insert to anon, authenticated
  with check (passenger_id = public.request_device_id());

create policy "Mates read reservations for own trips"
  on public.reservations
  for select to authenticated
  using (
    exists (
      select 1 from public.trips t
      where t.id = reservations.trip_id
        and t.mate_id = auth.uid()
    )
  );

grant select, insert on public.reservations to anon, authenticated;

-- 9. Reload PostgREST schema cache
notify pgrst, 'reload schema';
