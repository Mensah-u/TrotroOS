-- ─────────────────────────────────────────────────────────────────────────
-- TrotroOS · payment_transactions (Paystack MoMo seat booking)
--
-- Backs Supabase Edge Functions:
--   • initialize-payment
--   • paystack-webhook
--
-- Fee model (computed server-side only):
--   total = seat_fare + (8% × seat_fare) + 1 GHS request fee
--   Paystack amount = total × 100 pesewas
-- ─────────────────────────────────────────────────────────────────────────

-- webhook idempotency (safe if FIX_payments_and_wallet.sql already ran)
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

grant all on public.webhook_events to service_role;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_transaction_status') then
    create type public.payment_transaction_status as enum ('pending', 'success', 'failed');
  end if;
end $$;

create table if not exists public.payment_transactions (
  id                 uuid primary key default gen_random_uuid(),
  -- TrotroOS passengers: user_id = passenger_profiles.device_id (device-scoped profile)
  user_id            text not null
                       references public.passenger_profiles (device_id)
                       on delete restrict,
  reference          text not null unique,
  amount_in_pesewas  integer not null check (amount_in_pesewas > 0),
  seat_fare          numeric(12, 2) not null check (seat_fare > 0),
  platform_fee       numeric(12, 2) not null check (platform_fee >= 0),
  request_fee        numeric(12, 2) not null default 1.00 check (request_fee >= 0),
  status             public.payment_transaction_status not null default 'pending',
  reservation_id     uuid references public.reservations (id) on delete set null,
  paystack_access_code text,
  metadata           jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists payment_transactions_user_idx
  on public.payment_transactions (user_id, created_at desc);

create index if not exists payment_transactions_status_idx
  on public.payment_transactions (status);

create index if not exists payment_transactions_reservation_idx
  on public.payment_transactions (reservation_id)
  where reservation_id is not null;

-- Auto-update updated_at
create or replace function public.set_payment_transactions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists payment_transactions_updated_at on public.payment_transactions;
create trigger payment_transactions_updated_at
  before update on public.payment_transactions
  for each row execute function public.set_payment_transactions_updated_at();

alter table public.payment_transactions enable row level security;

drop policy if exists "payment_transactions: no client writes" on public.payment_transactions;
create policy "payment_transactions: no client writes"
  on public.payment_transactions for insert to public
  with check (false);

drop policy if exists "payment_transactions: no client updates" on public.payment_transactions;
create policy "payment_transactions: no client updates"
  on public.payment_transactions for update to public
  using (false) with check (false);

drop policy if exists "payment_transactions: user reads own" on public.payment_transactions;
create policy "payment_transactions: user reads own"
  on public.payment_transactions for select to anon, authenticated
  using (
    user_id = coalesce(
      nullif(trim(current_setting('request.headers', true)::json->>'x-device-id'), ''),
      nullif(trim(current_setting('request.headers', true)::json->>'X-Device-Id'), ''),
      auth.uid()::text
    )
  );

grant select on public.payment_transactions to anon, authenticated;
grant all on public.payment_transactions to service_role;

notify pgrst, 'reload schema';
