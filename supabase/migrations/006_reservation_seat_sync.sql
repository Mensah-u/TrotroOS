-- Reservation ↔ seat sync (run in Supabase SQL Editor after 000_trotroos_complete_schema.sql)
-- Decrements trip seats on reserve; restores on cancel/expiry.

-- ─── Seat decrement on new reservation ───────────────────────────────────────
create or replace function public.on_reservation_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  seats integer;
begin
  select available_seats into seats
  from public.trips
  where id = new.trip_id
  for update;

  if seats is null then
    raise exception 'Trip not found';
  end if;

  if seats <= 0 then
    raise exception 'Trip is full';
  end if;

  update public.trips
  set
    available_seats = available_seats - 1,
    status = case when available_seats - 1 <= 0 then 'full' else status end
  where id = new.trip_id;

  return new;
end;
$$;

drop trigger if exists trg_reservation_insert on public.reservations;
create trigger trg_reservation_insert
  after insert on public.reservations
  for each row
  when (new.status = 'active')
  execute function public.on_reservation_insert();


-- ─── Seat restore on cancel / expiry ─────────────────────────────────────────
create or replace function public.on_reservation_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'active' and new.status in ('cancelled', 'expired') then
    update public.trips
    set
      available_seats = least(available_seats + 1, total_seats),
      status = case
        when status in ('full', 'active') and available_seats + 1 > 0 then 'active'
        else status
      end
    where id = old.trip_id
      and status in ('active', 'full');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reservation_cancel on public.reservations;
create trigger trg_reservation_cancel
  after update of status on public.reservations
  for each row
  execute function public.on_reservation_cancel();


-- ─── Passenger cancel RPC ────────────────────────────────────────────────────
create or replace function public.cancel_reservation(
  p_reservation_id uuid,
  p_passenger_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.reservations%rowtype;
begin
  select * into r
  from public.reservations
  where id = p_reservation_id
    and passenger_id = p_passenger_id
    and status = 'active'
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Reservation not found or already ended');
  end if;

  update public.reservations
  set status = 'cancelled'
  where id = p_reservation_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.cancel_reservation(uuid, text) to anon, authenticated;


-- ─── Expire stale reservations (10 min) ──────────────────────────────────────
create or replace function public.expire_stale_reservations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  update public.reservations
  set status = 'expired'
  where status = 'active'
    and expires_at < now();

  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on function public.expire_stale_reservations() to anon, authenticated;
