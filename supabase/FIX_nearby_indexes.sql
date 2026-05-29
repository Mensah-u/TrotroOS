-- ─────────────────────────────────────────────────────────────────────────────
-- FIX_nearby_indexes.sql
--
-- Indexes + optional geohash columns to make 2 km nearby queries cheap.
--
-- Run in Supabase SQL Editor.
--
-- Adds:
--   • B-tree indexes on (latitude, longitude) for bounding-box scans.
--   • A `geohash5` generated column on driver_locations and passenger_locations.
--   • An index on geohash5 for prefix / `in (...)` queries.
--
-- The mobile client uses bounding-box filtering today; geohash5 is here so we
-- can switch to `geohash5 in ('gc8…', 'gc9…', …)` later without another
-- migration once Postgres scans start to hurt.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Geohash helper (pure SQL, no extensions required) ───────────────────
create or replace function public.geohash_encode(lat double precision, lng double precision, precision int default 5)
returns text
language plpgsql
immutable
parallel safe
as $$
declare
  base32 constant text := '0123456789bcdefghjkmnpqrstuvwxyz';
  lat_min double precision := -90;
  lat_max double precision :=  90;
  lng_min double precision := -180;
  lng_max double precision :=  180;
  bits   int := 0;
  bit_n  int := 0;
  even   boolean := true;
  hash   text := '';
  mid    double precision;
begin
  if lat is null or lng is null then return null; end if;

  while char_length(hash) < precision loop
    if even then
      mid := (lng_min + lng_max) / 2;
      if lng >= mid then bits := (bits << 1) | 1; lng_min := mid;
      else                bits := bits << 1;       lng_max := mid;
      end if;
    else
      mid := (lat_min + lat_max) / 2;
      if lat >= mid then bits := (bits << 1) | 1; lat_min := mid;
      else                bits := bits << 1;       lat_max := mid;
      end if;
    end if;
    even := not even;
    bit_n := bit_n + 1;
    if bit_n = 5 then
      hash  := hash || substr(base32, bits + 1, 1);
      bits  := 0;
      bit_n := 0;
    end if;
  end loop;

  return hash;
end;
$$;

-- ─── 2. driver_locations ────────────────────────────────────────────────────
create index if not exists driver_locations_lat_lng_idx
  on public.driver_locations (latitude, longitude);

alter table public.driver_locations
  add column if not exists geohash5 text
  generated always as (public.geohash_encode(latitude, longitude, 5)) stored;

create index if not exists driver_locations_geohash5_idx
  on public.driver_locations (geohash5);

-- ─── 3. passenger_locations ─────────────────────────────────────────────────
create index if not exists passenger_locations_lat_lng_idx
  on public.passenger_locations (latitude, longitude);

alter table public.passenger_locations
  add column if not exists geohash5 text
  generated always as (public.geohash_encode(latitude, longitude, 5)) stored;

create index if not exists passenger_locations_geohash5_idx
  on public.passenger_locations (geohash5);

-- ─── 4. Refresh PostgREST schema cache ──────────────────────────────────────
notify pgrst, 'reload schema';
