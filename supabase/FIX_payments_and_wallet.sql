-- ─────────────────────────────────────────────────────────────────────────
-- Payments, wallet ledger, webhook idempotency.
--
-- Run this AFTER FIX_mate_depart_now.sql. Idempotent — safe to re-run.
--
-- This migration backs:
--   • server/api/index.js  → /payments/init, /webhooks/paystack, /wallet/*
--   • services/paymentsApi.js (client)
--
-- The mobile client never writes to these tables directly. RLS is locked down
-- to authenticated reads of own rows; all writes happen via the service role
-- key on the backend.
-- ─────────────────────────────────────────────────────────────────────────

-- 1. webhook_events — idempotency for any external webhook (Paystack today,
-- Stripe / momo provider tomorrow). The unique constraint is the linchpin
-- that prevents double-crediting on retries.
create table if not exists public.webhook_events (
  id          uuid primary key default gen_random_uuid(),
  provider    text not null,
  event_id    text not null,
  event_type  text,
  raw         jsonb,
  created_at  timestamptz not null default now(),
  unique (provider, event_id)
);

alter table public.webhook_events enable row level security;

drop policy if exists "webhook_events: no client access" on public.webhook_events;
create policy "webhook_events: no client access"
  on public.webhook_events for all to public using (false) with check (false);

-- 2. payments — one row per Paystack transaction attempt.
create table if not exists public.payments (
  id                 uuid primary key default gen_random_uuid(),
  reference          text not null unique,
  reservation_id     uuid references public.reservations(id) on delete set null,
  passenger_id       text,
  amount_ghs         numeric(12,2) not null,
  channel            text,
  provider           text not null default 'paystack',
  status             text not null default 'pending'
                       check (status in ('pending','success','failed','cancelled')),
  provider_response  jsonb,
  created_at         timestamptz not null default now(),
  processed_at       timestamptz
);

create index if not exists payments_reservation_idx on public.payments (reservation_id);
create index if not exists payments_passenger_idx   on public.payments (passenger_id);
create index if not exists payments_status_idx      on public.payments (status);

alter table public.payments enable row level security;

drop policy if exists "payments: passenger reads own" on public.payments;
create policy "payments: passenger reads own"
  on public.payments for select to authenticated
  using (
    passenger_id = auth.uid()::text
    or reservation_id in (
      select id from public.reservations where passenger_id = auth.uid()::text
    )
  );

-- 3. wallet_ledger — append-only audit trail of every wallet movement.
create table if not exists public.wallet_ledger (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  kind        text not null check (kind in ('credit','debit','spend','payout')),
  amount_ghs  numeric(12,2) not null,
  reference   text,
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists wallet_ledger_user_idx on public.wallet_ledger (user_id, created_at desc);
create index if not exists wallet_ledger_ref_idx  on public.wallet_ledger (reference);

alter table public.wallet_ledger enable row level security;

drop policy if exists "wallet_ledger: user reads own" on public.wallet_ledger;
create policy "wallet_ledger: user reads own"
  on public.wallet_ledger for select to authenticated
  using (user_id = auth.uid()::text);

-- 4. wallet_balances — derived view so the server can read a single row.
create or replace view public.wallet_balances as
  select
    user_id,
    coalesce(sum(case when kind in ('credit','payout') then amount_ghs else 0 end), 0)
      - coalesce(sum(case when kind in ('debit','spend')  then amount_ghs else 0 end), 0)
      as balance_ghs,
    max(created_at) as last_txn_at
  from public.wallet_ledger
  group by user_id;

grant select on public.wallet_balances to authenticated, service_role;

-- 5. Make Postgres reload PostgREST schema cache so the new tables show up.
notify pgrst, 'reload schema';
