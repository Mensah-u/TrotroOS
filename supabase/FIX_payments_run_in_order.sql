-- ═══════════════════════════════════════════════════════════════════════════
-- RUN THESE IN ORDER — ONE BLOCK PER SQL EDITOR RUN
-- Do NOT combine. Wait for each to succeed before the next.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── RUN 1 OF 3: Drop every policy on reservations ───────────────────────
-- Copy ONLY from here down to "END RUN 1", paste, click Run.

ALTER TABLE public.reservations DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reservations_passenger_view" ON public.reservations;
DROP POLICY IF EXISTS "reservations_passenger_insert" ON public.reservations;
DROP POLICY IF EXISTS "Anyone can create reservations" ON public.reservations;
DROP POLICY IF EXISTS "Anyone can read reservations" ON public.reservations;
DROP POLICY IF EXISTS "Passenger create reservation" ON public.reservations;
DROP POLICY IF EXISTS "Passenger read own reservations" ON public.reservations;
DROP POLICY IF EXISTS "Mates read reservations for own trips" ON public.reservations;

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT p.polname
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'reservations'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.reservations', pol.polname);
    RAISE NOTICE 'Dropped policy: %', pol.polname;
  END LOOP;
END $$;

-- END RUN 1 — You should see "Success". Then run RUN 2.


-- ─── RUN 2 OF 3: Verify zero policies, then alter column ─────────────────

DO $$
DECLARE cnt int;
BEGIN
  SELECT count(*) INTO cnt
  FROM pg_policy p
  JOIN pg_class c ON c.oid = p.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'reservations';

  IF cnt > 0 THEN
    RAISE EXCEPTION 'STOP: % policies still on reservations. Re-run RUN 1.', cnt;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reservations'
      AND column_name = 'passenger_id'
      AND udt_name = 'text'
  ) THEN
    RAISE NOTICE 'passenger_id is already text — no alter needed';
  ELSE
    EXECUTE 'ALTER TABLE public.reservations ALTER COLUMN passenger_id TYPE text USING passenger_id::text';
    RAISE NOTICE 'passenger_id converted to text';
  END IF;
END $$;

-- END RUN 2


-- ─── RUN 3 OF 3: Recreate profiles, FK, policies, payment table ──────────

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

ALTER TABLE public.passenger_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone manage passenger profiles" ON public.passenger_profiles;
CREATE POLICY "Anyone manage passenger profiles"
  ON public.passenger_profiles FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.passenger_profiles TO anon, authenticated;

INSERT INTO public.passenger_profiles (device_id, display_name)
SELECT DISTINCT r.passenger_id, 'Passenger'
FROM public.reservations r
WHERE r.passenger_id IS NOT NULL AND trim(r.passenger_id) <> ''
ON CONFLICT (device_id) DO NOTHING;

ALTER TABLE public.reservations DROP CONSTRAINT IF EXISTS reservations_passenger_id_fkey;
ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_passenger_id_fkey
  FOREIGN KEY (passenger_id) REFERENCES public.passenger_profiles (device_id)
  ON DELETE SET NULL NOT VALID;
ALTER TABLE public.reservations VALIDATE CONSTRAINT reservations_passenger_id_fkey;

CREATE OR REPLACE FUNCTION public.request_device_id()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT nullif(trim(coalesce(
    current_setting('request.headers', true)::json->>'x-device-id',
    current_setting('request.headers', true)::json->>'X-Device-Id', ''
  )), '');
$$;
GRANT EXECUTE ON FUNCTION public.request_device_id() TO anon, authenticated, service_role;

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reservations_passenger_view"
  ON public.reservations FOR SELECT TO anon, authenticated
  USING (passenger_id = public.request_device_id());

CREATE POLICY "reservations_passenger_insert"
  ON public.reservations FOR INSERT TO anon, authenticated
  WITH CHECK (passenger_id = public.request_device_id());

CREATE POLICY "Mates read reservations for own trips"
  ON public.reservations FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.trips t WHERE t.id = reservations.trip_id AND t.mate_id = auth.uid())
  );

GRANT SELECT, INSERT ON public.reservations TO anon, authenticated;

-- payment_transactions (Paystack)
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_id text NOT NULL,
  event_type text,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id)
);
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "webhook_events: no client access" ON public.webhook_events;
CREATE POLICY "webhook_events: no client access"
  ON public.webhook_events FOR ALL TO public USING (false) WITH CHECK (false);
GRANT ALL ON public.webhook_events TO service_role;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_transaction_status') THEN
    CREATE TYPE public.payment_transaction_status AS ENUM ('pending', 'success', 'failed');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.passenger_profiles (device_id) ON DELETE RESTRICT,
  reference text NOT NULL UNIQUE,
  amount_in_pesewas integer NOT NULL CHECK (amount_in_pesewas > 0),
  seat_fare numeric(12,2) NOT NULL CHECK (seat_fare > 0),
  platform_fee numeric(12,2) NOT NULL CHECK (platform_fee >= 0),
  request_fee numeric(12,2) NOT NULL DEFAULT 1.00 CHECK (request_fee >= 0),
  status public.payment_transaction_status NOT NULL DEFAULT 'pending',
  reservation_id uuid REFERENCES public.reservations (id) ON DELETE SET NULL,
  paystack_access_code text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_transactions_user_idx ON public.payment_transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_transactions_status_idx ON public.payment_transactions (status);

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payment_transactions: no client writes" ON public.payment_transactions;
CREATE POLICY "payment_transactions: no client writes"
  ON public.payment_transactions FOR INSERT TO public WITH CHECK (false);
DROP POLICY IF EXISTS "payment_transactions: no client updates" ON public.payment_transactions;
CREATE POLICY "payment_transactions: no client updates"
  ON public.payment_transactions FOR UPDATE TO public USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "payment_transactions: user reads own" ON public.payment_transactions;
CREATE POLICY "payment_transactions: user reads own"
  ON public.payment_transactions FOR SELECT TO anon, authenticated
  USING (user_id = coalesce(
    nullif(trim(current_setting('request.headers', true)::json->>'x-device-id'), ''),
    nullif(trim(current_setting('request.headers', true)::json->>'X-Device-Id'), ''),
    auth.uid()::text
  ));
GRANT SELECT ON public.payment_transactions TO anon, authenticated;
GRANT ALL ON public.payment_transactions TO service_role;

NOTIFY pgrst, 'reload schema';

-- END RUN 3
