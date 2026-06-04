-- Mate payout requests — mates request MoMo transfer of accumulated earnings.
-- Admin reviews / approves; server initiates Paystack Transfer on approval.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'payout_status') then
    create type public.payout_status as enum ('pending', 'processing', 'paid', 'rejected');
  end if;
end $$;

create table if not exists public.mate_payout_requests (
  id            uuid primary key default gen_random_uuid(),
  mate_id       uuid not null references auth.users (id) on delete cascade,
  amount_ghs    numeric(12, 2) not null check (amount_ghs > 0),
  momo_number   text not null,
  network       text not null default 'MTN' check (network in ('MTN', 'Vodafone', 'AirtelTigo')),
  status        public.payout_status not null default 'pending',
  admin_note    text,
  paystack_transfer_code text,
  requested_at  timestamptz not null default now(),
  processed_at  timestamptz
);

create index if not exists mate_payout_requests_mate_idx
  on public.mate_payout_requests (mate_id, requested_at desc);

create index if not exists mate_payout_requests_status_idx
  on public.mate_payout_requests (status);

alter table public.mate_payout_requests enable row level security;

drop policy if exists "payout: mate reads own" on public.mate_payout_requests;
create policy "payout: mate reads own"
  on public.mate_payout_requests for select to authenticated
  using (mate_id = auth.uid());

drop policy if exists "payout: mate inserts own" on public.mate_payout_requests;
create policy "payout: mate inserts own"
  on public.mate_payout_requests for insert to authenticated
  with check (mate_id = auth.uid());

drop policy if exists "payout: no client update" on public.mate_payout_requests;
create policy "payout: no client update"
  on public.mate_payout_requests for update to authenticated
  using (false);

grant select, insert on public.mate_payout_requests to authenticated;
grant all on public.mate_payout_requests to service_role;

-- ─── Request payout RPC (rate-limited to 1 pending per mate) ──────────────
create or replace function public.request_mate_payout(
  p_amount_ghs numeric,
  p_momo_number text,
  p_network text default 'MTN'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid          uuid := auth.uid();
  pending_count integer;
  new_id       uuid;
  min_payout   numeric := 5.00;
  max_payout   numeric := 5000.00;
  network      text    := upper(trim(p_network));
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'Not signed in');
  end if;

  if coalesce(p_amount_ghs, 0) < min_payout then
    return jsonb_build_object('ok', false, 'error', format('Minimum payout is GHS %s', min_payout));
  end if;
  if p_amount_ghs > max_payout then
    return jsonb_build_object('ok', false, 'error', format('Maximum single payout is GHS %s', max_payout));
  end if;

  if trim(p_momo_number) = '' or length(trim(p_momo_number)) < 10 then
    return jsonb_build_object('ok', false, 'error', 'Enter a valid MoMo number (10+ digits)');
  end if;

  if network not in ('MTN', 'VODAFONE', 'AIRTELTIGO') then
    network := 'MTN';
  end if;
  if network = 'VODAFONE'   then network := 'Vodafone';   end if;
  if network = 'AIRTELTIGO' then network := 'AirtelTigo'; end if;

  -- Block if a request is already in-flight (pending or being processed)
  select count(*) into pending_count
  from public.mate_payout_requests
  where mate_id = uid
    and status in ('pending', 'processing');

  if pending_count > 0 then
    return jsonb_build_object(
      'ok', false,
      'error', 'You already have a payout request in progress. Wait for it to complete.'
    );
  end if;

  insert into public.mate_payout_requests (
    mate_id, amount_ghs, momo_number, network, status
  )
  values (
    uid,
    p_amount_ghs,
    trim(p_momo_number),
    network,
    'pending'
  )
  returning id into new_id;

  return jsonb_build_object(
    'ok', true,
    'payout_id', new_id,
    'message', 'Payout request submitted. Processing now…'
  );
exception
  when others then
    return jsonb_build_object('ok', false, 'error', sqlerrm);
end;
$$;

revoke all on function public.request_mate_payout(numeric, text, text) from public;
grant execute on function public.request_mate_payout(numeric, text, text) to authenticated;

notify pgrst, 'reload schema';
