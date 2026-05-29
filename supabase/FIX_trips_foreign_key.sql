-- ============================================================================
-- TrotroOS · FIX: trips_mate_profile_fkey error
-- Run this in Supabase SQL Editor if RUN_THIS_FIRST failed on the trips FK step.
-- Safe to re-run.
-- ============================================================================

-- 1. Ensure mate_profiles table exists (skip if you already ran section 1)
create table if not exists public.mate_profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  full_name            text not null,
  phone_number         text not null,
  vehicle_registration text not null,
  vehicle_type         text not null,
  default_route        text,
  created_at           timestamptz not null default now()
);

-- 2. Create a profile row for every mate who has trips but no profile yet
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

-- 3. Remove trips pointing at non-existent auth users (orphans only)
delete from public.trips t
where not exists (select 1 from auth.users u where u.id = t.mate_id);

-- 4. Add the foreign key (only after every trip.mate_id has a mate_profiles row)
alter table public.trips drop constraint if exists trips_mate_profile_fkey;

alter table public.trips
  add constraint trips_mate_profile_fkey
  foreign key (mate_id) references public.mate_profiles(id);

-- Done. Continue RUN_THIS_FIRST from section 3 onward, or re-run the full file.
