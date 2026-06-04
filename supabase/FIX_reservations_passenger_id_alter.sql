-- ============================================================================
-- TrotroOS · Fix: cannot alter type of column used in a policy definition
-- Error: policy reservations_passenger_view depends on column passenger_id
--
-- Paste ALL of this in Supabase SQL Editor → Run once → Reload schema
-- https://supabase.com/dashboard/project/siwzjxwholmoassrdtwx/sql/new
-- ============================================================================

-- ─── 1. Drop EVERY policy on reservations (required before ALTER COLUMN) ───

ALTER TABLE public.reservations DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reservations_passenger_view" ON public.reservations;
DROP POLICY IF EXISTS "reservations_passenger_insert" ON public.reservations;
DROP POLICY IF EXISTS "Anyone can create reservations" ON public.reservations;
DROP POLICY IF EXISTS "Anyone can read reservations" ON public.reservations;
DROP POLICY IF EXISTS "Passenger create reservation" ON public.reservations;
DROP POLICY IF EXISTS "Passenger read own reservations" ON public.reservations;
DROP POLICY IF EXISTS "Mates read reservations for own trips" ON public.reservations;

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT p.polname
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'reservations'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.reservations', pol.polname);
    RAISE NOTICE 'Dropped policy: %', pol.polname;
  END LOOP;
END $$;

DO $$
DECLARE
  cnt int;
BEGIN
  SELECT count(*) INTO cnt
  FROM pg_policy p
  JOIN pg_class c ON c.oid = p.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'reservations';

  IF cnt > 0 THEN
    RAISE EXCEPTION 'Still % policies on reservations — remove them in Dashboard → Database → Policies, then re-run', cnt;
  END IF;
END $$;

-- ─── 2. Alter passenger_id → text (device UUID, not auth.users id) ─────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reservations'
      AND column_name = 'passenger_id'
      AND udt_name = 'text'
  ) THEN
    RAISE NOTICE 'passenger_id is already text — skipping alter';
  ELSE
    ALTER TABLE public.reservations
      ALTER COLUMN passenger_id TYPE text USING passenger_id::text;
    RAISE NOTICE 'passenger_id converted to text';
  END IF;
END $$;

-- ─── 3. Ensure passenger_profiles + FK exist ────────────────────────────────

CREATE TABLE IF NOT EXISTS public.passenger_profiles (
  device_id       text PRIMARY KEY,
  display_name    text NOT NULL DEFAULT 'Passenger',
  phone           text DEFAULT '',
  notify_trips    boolean NOT NULL DEFAULT true,
  notify_reserve  boolean NOT NULL DEFAULT true,
  notify_promo    boolean NOT NULL DEFAULT false,
  share_location  boolean NOT NULL DEFAULT true,
  anonymous_mode  boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.passenger_profiles (device_id, display_name)
SELECT DISTINCT r.passenger_id, 'Passenger'
FROM public.reservations r
WHERE r.passenger_id IS NOT NULL
  AND trim(r.passenger_id) <> ''
ON CONFLICT (device_id) DO NOTHING;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'reservations'
      AND c.contype = 'f'
      AND pg_get_constraintdef(c.oid) ILIKE '%passenger_id%'
  LOOP
    EXECUTE format('ALTER TABLE public.reservations DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_passenger_id_fkey
  FOREIGN KEY (passenger_id)
  REFERENCES public.passenger_profiles (device_id)
  ON DELETE SET NULL
  NOT VALID;

ALTER TABLE public.reservations VALIDATE CONSTRAINT reservations_passenger_id_fkey;

-- ─── 4. Helper + RLS policies (TrotroOS device-id model) ───────────────────

CREATE OR REPLACE FUNCTION public.request_device_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(
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

REVOKE ALL ON FUNCTION public.request_device_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_device_id() TO anon, authenticated, service_role;

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reservations_passenger_view"
  ON public.reservations
  FOR SELECT TO anon, authenticated
  USING (passenger_id = public.request_device_id());

CREATE POLICY "reservations_passenger_insert"
  ON public.reservations
  FOR INSERT TO anon, authenticated
  WITH CHECK (passenger_id = public.request_device_id());

CREATE POLICY "Mates read reservations for own trips"
  ON public.reservations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = reservations.trip_id
        AND t.mate_id = auth.uid()
    )
  );

GRANT SELECT, INSERT ON public.reservations TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
