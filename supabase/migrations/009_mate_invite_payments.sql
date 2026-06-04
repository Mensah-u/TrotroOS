-- Mate seat-invite payments: driver pays 8% of trip fare + GHS 1 request fee per invite.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_kind') then
    create type public.payment_kind as enum ('passenger_booking', 'mate_invite');
  end if;
end $$;

alter table public.payment_transactions
  drop constraint if exists payment_transactions_user_id_fkey;

alter table public.payment_transactions
  add column if not exists payment_kind public.payment_kind not null default 'passenger_booking';

alter table public.payment_transactions
  add column if not exists trip_id uuid references public.trips (id) on delete set null;

alter table public.payment_transactions
  add column if not exists mate_ride_request_id uuid references public.mate_ride_requests (id) on delete set null;

create index if not exists payment_transactions_trip_idx
  on public.payment_transactions (trip_id)
  where trip_id is not null;

alter table public.mate_ride_requests
  add column if not exists payment_reference text;

create unique index if not exists mate_ride_requests_payment_ref_idx
  on public.mate_ride_requests (payment_reference)
  where payment_reference is not null;

-- ─── Verify mate invite payment before sending request ───────────────────────
create or replace function public.verify_mate_invite_payment(
  p_reference text,
  p_trip_id uuid,
  p_mate_id uuid,
  p_trip_fare numeric
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  pay public.payment_transactions%rowtype;
  expected_pesewas integer;
  trip_pesewas integer;
begin
  if p_reference is null or trim(p_reference) = '' then
    return false;
  end if;

  select * into pay
  from public.payment_transactions
  where reference = trim(p_reference)
    and status = 'success'
    and payment_kind = 'mate_invite'
  limit 1;

  if not found then
    return false;
  end if;

  if pay.user_id <> p_mate_id::text then
    return false;
  end if;

  if pay.trip_id is distinct from p_trip_id then
    return false;
  end if;

  if exists (
    select 1 from public.mate_ride_requests
    where payment_reference = pay.reference
  ) then
    return false;
  end if;

  trip_pesewas := round(coalesce(p_trip_fare, 0) * 100)::integer;
  if trip_pesewas <= 0 then
    return false;
  end if;

  expected_pesewas := round(trip_pesewas * 0.08)::integer + 100;

  if pay.amount_in_pesewas <> expected_pesewas then
    return false;
  end if;

  return true;
end;
$$;

revoke all on function public.verify_mate_invite_payment(text, uuid, uuid, numeric) from public;
grant execute on function public.verify_mate_invite_payment(text, uuid, uuid, numeric) to authenticated;

-- ─── send_mate_ride_request: require paid invite when trip has a fare ─────────
create or replace function public.send_mate_ride_request(
  p_trip_id uuid,
  p_passenger_id text,
  p_payment_reference text default null,
  p_enforce_payment boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  t public.trips%rowtype;
  loc public.passenger_locations%rowtype;
  rec public.mate_ride_requests%rowtype;
  pid text := trim(p_passenger_id);
  v_fare numeric(12, 2) := null;
  pay_ref text := nullif(trim(p_payment_reference), '');
begin
  perform public.expire_stale_mate_ride_requests();

  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'Not signed in');
  end if;
  if pid is null or pid = '' then
    return jsonb_build_object('ok', false, 'error', 'Passenger ID required');
  end if;

  select * into t from public.trips where id = p_trip_id for update;
  if not found or t.mate_id <> uid then
    return jsonb_build_object('ok', false, 'error', 'Trip not found');
  end if;
  if t.status not in ('active', 'full') or t.available_seats <= 0 then
    return jsonb_build_object('ok', false, 'error', 'No seats available');
  end if;

  select * into loc from public.passenger_locations where passenger_id = pid;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Passenger is not sharing location');
  end if;
  if loc.reservation_id is not null then
    return jsonb_build_object('ok', false, 'error', 'Passenger already has a reservation');
  end if;

  select coalesce(
    t.fare_ghs,
    (
      select dl.fare_ghs
      from public.driver_locations dl
      where dl.mate_id = uid
      order by dl.updated_at desc nulls last
      limit 1
    )
  )
  into v_fare;

  if p_enforce_payment and coalesce(v_fare, 0) > 0 then
    if pay_ref is null then
      return jsonb_build_object(
        'ok', false,
        'error', 'Pay invite fee (8% + GHS 1) before sending this request',
        'payment_required', true
      );
    end if;
    if not public.verify_mate_invite_payment(pay_ref, p_trip_id, uid, v_fare) then
      return jsonb_build_object(
        'ok', false,
        'error', 'Payment not confirmed — complete MoMo checkout and try again',
        'payment_required', true
      );
    end if;
  end if;

  update public.mate_ride_requests
  set status = 'expired'
  where trip_id = p_trip_id
    and passenger_id = pid
    and status = 'pending'
    and expires_at <= now();

  select * into rec
  from public.mate_ride_requests
  where trip_id = p_trip_id
    and passenger_id = pid
    and status = 'pending'
    and expires_at > now()
  limit 1;

  if found then
    update public.mate_ride_requests
    set expires_at = now() + interval '30 minutes',
        payment_reference = coalesce(payment_reference, pay_ref)
    where id = rec.id;

    select * into rec from public.mate_ride_requests where id = rec.id;

    return jsonb_build_object('ok', true, 'request', to_jsonb(rec), 'already_sent', true);
  end if;

  insert into public.mate_ride_requests (
    trip_id, mate_id, passenger_id, route_label, fare_ghs, status, expires_at, payment_reference
  )
  values (
    t.id,
    uid,
    pid,
    coalesce(t.route, t.origin || ' → ' || t.destination),
    v_fare,
    'pending',
    now() + interval '30 minutes',
    pay_ref
  )
  returning * into rec;

  if pay_ref is not null then
    update public.payment_transactions
    set mate_ride_request_id = rec.id,
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('mate_ride_request_id', rec.id)
    where reference = pay_ref;
  end if;

  return jsonb_build_object('ok', true, 'request', to_jsonb(rec), 'already_sent', false);
exception
  when unique_violation then
    perform public.expire_stale_mate_ride_requests();

    select * into rec
    from public.mate_ride_requests
    where trip_id = p_trip_id
      and passenger_id = pid
      and status = 'pending'
      and expires_at > now()
    limit 1;

    if found then
      update public.mate_ride_requests
      set expires_at = now() + interval '30 minutes',
          payment_reference = coalesce(payment_reference, pay_ref)
      where id = rec.id;

      select * into rec from public.mate_ride_requests where id = rec.id;

      return jsonb_build_object('ok', true, 'request', to_jsonb(rec), 'already_sent', true);
    end if;

    return jsonb_build_object('ok', false, 'error', 'Could not send request');
  when others then
    return jsonb_build_object('ok', false, 'error', sqlerrm);
end;
$$;

revoke all on function public.send_mate_ride_request(uuid, text, text, boolean) from public;
grant execute on function public.send_mate_ride_request(uuid, text, text, boolean) to authenticated;

notify pgrst, 'reload schema';
