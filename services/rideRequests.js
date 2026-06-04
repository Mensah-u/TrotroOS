import { PAYMENTS_ENABLED } from '@/constants/config';
import { supabase } from '@/services/supabase';

const TABLE = 'mate_ride_requests';

/** Base row only — nested joins can fail RLS/embed and block the whole query. */
const REQUEST_SELECT = '*';

/** Optional trip card fields (separate query if needed). */
const REQUEST_SELECT_WITH_TRIP =
  '*, trips(id, route, origin, destination, available_seats, fare_ghs, mate_profiles(full_name, vehicle_registration, vehicle_type))';

async function fetchPendingRows(passengerId) {
  const simple = await supabase
    .from(TABLE)
    .select(REQUEST_SELECT)
    .eq('passenger_id', passengerId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (!simple.error) return simple;

  if (__DEV__) {
    console.warn('[rideRequests] simple fetch failed:', simple.error.message);
  }

  return supabase
    .from(TABLE)
    .select(REQUEST_SELECT_WITH_TRIP)
    .eq('passenger_id', passengerId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
}

/** Postgrest builders are thenable but do not expose `.catch()` — always await in try/catch. */
export async function expireStaleMateRideRequests() {
  try {
    const { error } = await supabase.rpc('expire_stale_mate_ride_requests');
    if (error) return { error };
    return { error: null };
  } catch (e) {
    return { error: e };
  }
}

export function filterLiveRideRequests(rows) {
  const now = Date.now();
  return (rows ?? []).filter((r) => {
    if (r.status && r.status !== 'pending') return false;
    if (!r.expires_at) return true;
    return new Date(r.expires_at).getTime() > now - 60_000;
  });
}

export async function sendMateRideRequest(tripId, passengerId, paymentReference = null) {
  const { data, error } = await supabase.rpc('send_mate_ride_request', {
    p_trip_id: tripId,
    p_passenger_id: passengerId,
    p_payment_reference: paymentReference ?? null,
    p_enforce_payment: PAYMENTS_ENABLED,
  });
  if (error) return { data: null, error };
  if (data?.ok === false) return { data: null, error: { message: data.error ?? 'Unable to send request' } };
  return { data, error: null };
}

export async function respondMateRideRequest(requestId, passengerId, accept) {
  const { data, error } = await supabase.rpc('respond_mate_ride_request', {
    p_request_id: requestId,
    p_passenger_id: passengerId,
    p_accept: accept,
  });
  if (error) return { data: null, error };
  if (data?.ok === false) return { data: null, error: { message: data.error ?? 'Unable to respond to request' } };
  return { data, error: null };
}

export function fetchPendingRideRequestsForTrip(tripId) {
  return supabase
    .from(TABLE)
    .select('*')
    .eq('trip_id', tripId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
}

export function fetchPendingRideRequestsForPassenger(passengerId) {
  return fetchPendingRows(passengerId);
}

export function subscribeToTripRideRequests(tripId, callback) {
  const load = async () => {
    await expireStaleMateRideRequests();
    const { data, error } = await fetchPendingRideRequestsForTrip(tripId);
    if (error) return;
    callback(filterLiveRideRequests(data));
  };

  load();

  const channel = supabase
    .channel(`ride_requests_trip_${tripId}_${Date.now()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLE, filter: `trip_id=eq.${tripId}` }, () => {
      load();
    })
    .subscribe();

  return channel;
}

export function subscribeToPassengerRideRequests(passengerId, callback) {
  const load = async () => {
    await expireStaleMateRideRequests();
    const { data, error } = await fetchPendingRows(passengerId);
    if (error) {
      if (__DEV__) console.warn('[rideRequests] passenger load failed:', error.message);
      return;
    }
    callback(filterLiveRideRequests(data));
  };

  load();

  const channel = supabase
    .channel(`ride_requests_passenger_${passengerId}_${Date.now()}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE, filter: `passenger_id=eq.${passengerId}` },
      () => { load(); },
    )
    .subscribe();

  return channel;
}
