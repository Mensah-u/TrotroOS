-- Link successful Paystack payments to active reservations (no invalid 'paid' status).
-- Run after 007_payment_transactions.sql

alter table public.reservations
  add column if not exists payment_reference text;

create index if not exists reservations_payment_reference_idx
  on public.reservations (payment_reference)
  where payment_reference is not null;

comment on column public.reservations.payment_reference is
  'Paystack reference from payment_transactions when MoMo/card checkout succeeds.';

notify pgrst, 'reload schema';
