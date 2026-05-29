-- ============================================================================
-- TrotroOS · Ratings + Demand Queue migration
-- Run this in your Supabase SQL Editor BEFORE installing the new APK.
-- ============================================================================

-- 1. Add queued_route to passenger_locations so we can group waiting riders
-- ----------------------------------------------------------------------------
alter table public.passenger_locations
  add column if not exists queued_route text;

create index if not exists passenger_locations_queued_route_idx
  on public.passenger_locations (queued_route);


-- 2. Ratings table (passengers rate mates after a trip completes)
-- ----------------------------------------------------------------------------
create table if not exists public.ratings (
  id                    uuid primary key default gen_random_uuid(),
  trip_id               uuid not null references public.trips(id) on delete cascade,
  mate_id               uuid not null references auth.users(id) on delete cascade,
  passenger_device_id   text not null,
  stars                 integer not null check (stars between 1 and 5),
  comment               text,
  created_at            timestamptz not null default now()
);

create index if not exists ratings_mate_id_idx on public.ratings (mate_id);
create index if not exists ratings_trip_id_idx on public.ratings (trip_id);

alter table public.ratings enable row level security;

drop policy if exists "ratings_insert_anyone"   on public.ratings;
drop policy if exists "ratings_select_anyone"   on public.ratings;

create policy "ratings_insert_anyone"
  on public.ratings for insert
  to anon, authenticated
  with check (true);

create policy "ratings_select_anyone"
  on public.ratings for select
  to anon, authenticated
  using (true);
