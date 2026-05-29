-- TrotroOS · Live queue / passenger_locations (mates see "in queue", live sync)
-- Run in Supabase SQL Editor if demand stays at zero with passengers waiting.

alter table public.passenger_locations
  add column if not exists queued_route text;

create index if not exists passenger_locations_queued_route_idx
  on public.passenger_locations (queued_route);

grant select, insert, update, delete on public.passenger_locations to anon, authenticated;

alter table public.passenger_locations enable row level security;

drop policy if exists "Anyone manage passenger locations" on public.passenger_locations;
drop policy if exists "Anyone read passenger locations" on public.passenger_locations;

create policy "Anyone manage passenger locations"
  on public.passenger_locations for all to anon, authenticated
  using (true) with check (true);

alter table public.passenger_locations replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.passenger_locations;
exception when others then
  raise notice 'realtime passenger_locations: %', sqlerrm;
end $$;

notify pgrst, 'reload schema';
