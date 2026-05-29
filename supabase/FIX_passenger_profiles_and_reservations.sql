-- ─────────────────────────────────────────────────────────────────────────
-- TrotroOS · Fix reservation booking (passenger_id foreign key errors)
--
-- Run this entire script in Supabase → SQL Editor → Run
--
-- Fixes errors like:
--   insert or update on table "reservations" violates foreign key constraint
--   "reservations_passenger_id_fkey"
--   "Reservation_passenger_id_key"
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

-- 3. passenger_id must be text (device UUID), not auth.users uuid
alter table public.reservations
  alter column passenger_id type text using passenger_id::text;

-- 4. Backfill profiles for any existing reservation passenger_ids
insert into public.passenger_profiles (device_id, display_name)
select distinct r.passenger_id, 'Passenger'
from public.reservations r
where r.passenger_id is not null
  and trim(r.passenger_id) <> ''
on conflict (device_id) do nothing;

-- 5. Re-create the correct FK → passenger_profiles.device_id
alter table public.reservations
  drop constraint if exists reservations_passenger_id_fkey;

alter table public.reservations
  add constraint reservations_passenger_id_fkey
  foreign key (passenger_id)
  references public.passenger_profiles (device_id)
  on delete set null
  not valid;

-- Validate against existing rows (NULL passenger_id is OK)
alter table public.reservations validate constraint reservations_passenger_id_fkey;

-- 6. Reload PostgREST schema cache
notify pgrst, 'reload schema';
