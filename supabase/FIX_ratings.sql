-- ─────────────────────────────────────────────────────────────────────────
-- TrotroOS · Create ratings table (post-trip mate star ratings)
--
-- Run this entire script in Supabase → SQL Editor → Run
--
-- Fixes errors like:
--   Could not find the table 'public.ratings' in the schema cache
--   PGRST205
-- ─────────────────────────────────────────────────────────────────────────

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
create index if not exists ratings_trip_id_idx on public.ratings (trip_id);
create index if not exists ratings_passenger_device_id_idx
  on public.ratings (passenger_device_id);

alter table public.ratings enable row level security;

drop policy if exists "ratings_insert_anyone" on public.ratings;
drop policy if exists "ratings_select_anyone" on public.ratings;

create policy "ratings_insert_anyone"
  on public.ratings for insert to anon, authenticated
  with check (true);

create policy "ratings_select_anyone"
  on public.ratings for select to anon, authenticated
  using (true);

grant select, insert on public.ratings to anon, authenticated;

alter table public.ratings replica identity full;

do $$
begin
  execute 'alter publication supabase_realtime add table public.ratings';
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

notify pgrst, 'reload schema';
