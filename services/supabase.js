import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';

import { SUPABASE_ANON_KEY, SUPABASE_URL, assertClientConfig } from '@/constants/config';

assertClientConfig();
import { boundingBox, withinBbox } from '@/utils/geo';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ─── Table names ────────────────────────────────────────────────────────────
const T = {
  MATE_PROFILES:       'mate_profiles',
  PASSENGER_PROFILES:  'passenger_profiles',
  DRIVER_LOCATIONS:    'driver_locations',
  PASSENGER_LOCATIONS: 'passenger_locations',
  TRIPS:               'trips',
  RESERVATIONS:        'reservations',
  RATINGS:             'ratings',
};

// ─── Auth ────────────────────────────────────────────────────────────────────
export const signUpMate = (email, password) =>
  supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: Linking.createURL('auth/callback') },
  });
export const signInMate = (email, password) =>
  supabase.auth.signInWithPassword({ email, password });
export const signOutMate = () => supabase.auth.signOut();
export const getCurrentMate = () => supabase.auth.getUser();
export const getMateSession = () => supabase.auth.getSession();

// ─── Mate profiles ───────────────────────────────────────────────────────────
export function getMateProfile(userId) {
  return supabase.from(T.MATE_PROFILES).select('*').eq('id', userId).maybeSingle();
}

export function upsertMateProfile(userId, profileData) {
  return supabase
    .from(T.MATE_PROFILES)
    .upsert({ id: userId, ...profileData }, { onConflict: 'id' })
    .select()
    .single();
}

/** Returns true when mate_profiles table exists and is reachable. */
export async function isMateBackendReady() {
  const { error } = await supabase.from(T.MATE_PROFILES).select('id').limit(1);
  return !error;
}

/** Creates mate_profiles if the user signed in without completing sign-up profile save. */
export async function ensureMateProfile(user) {
  const { data: existing, error: readErr } = await supabase
    .from(T.MATE_PROFILES)
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (readErr) return { error: readErr };
  if (existing?.id) return { error: null };

  const meta = user.user_metadata ?? {};
  const { error } = await upsertMateProfile(user.id, {
    full_name: meta.full_name ?? user.email?.split('@')[0] ?? 'Mate',
    phone_number: meta.phone_number ?? '0000000000',
    vehicle_registration: meta.vehicle_registration ?? 'PENDING',
    vehicle_type: meta.vehicle_type ?? 'Trotro',
  });
  return { error };
}

// ─── Driver locations ────────────────────────────────────────────────────────
export async function upsertDriverLocation(_mateId, route, latitude, longitude, availableSeats, heading = null) {
  const { user, error: authError } = await requireMateSession();
  if (authError) return Promise.reject(new Error(authError.message));

  const payload = {
    mate_id: user.id,
    route,
    available_seats: availableSeats,
    heading,
    updated_at: new Date().toISOString(),
  };
  if (latitude != null) payload.latitude  = latitude;
  if (longitude != null) payload.longitude = longitude;
  return supabase.from(T.DRIVER_LOCATIONS).upsert(payload, { onConflict: 'mate_id' });
}

export async function deleteDriverLocation(_mateId) {
  const { user, error: authError } = await requireMateSession();
  if (authError) return Promise.reject(new Error(authError.message));
  return supabase.from(T.DRIVER_LOCATIONS).delete().eq('mate_id', user.id);
}

// ─── Realtime helpers ────────────────────────────────────────────────────────
function uniqueChannel(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Fetch driver locations within `radiusKm` of `center` using a lat/lng
 * bounding-box filter. Falls back to a full read only if no center is given.
 * Bandwidth scales with fleet density in the bbox, not the whole city.
 */
export async function fetchNearbyDriverLocations(center, radiusKm = 2) {
  const bbox = boundingBox(center, radiusKm);
  let q = supabase.from(T.DRIVER_LOCATIONS).select('*');
  if (bbox) {
    q = q
      .gte('latitude', bbox.minLat)
      .lte('latitude', bbox.maxLat)
      .gte('longitude', bbox.minLng)
      .lte('longitude', bbox.maxLng);
  }
  return q;
}

/**
 * Resolve the query center from a static value or a live ref (preferred for
 * moving users so reload() always uses the latest GPS fix).
 */
function resolveCenter(options) {
  if (options.centerRef?.current?.latitude != null) return options.centerRef.current;
  return options.center ?? null;
}

/**
 * Geo-bounded driver_locations subscription.
 *
 * Pass `centerRef` (a React ref holding `{ latitude, longitude }`) so every
 * reload uses the user's latest position without tearing down the channel.
 */
export function subscribeToDriverLocations(callback, options = {}) {
  const { radiusKm = 8 } = options;

  const reload = () => {
    const center = resolveCenter(options);
    fetchNearbyDriverLocations(center, radiusKm).then(({ data, error }) => {
      if (error) {
        console.warn('[TrotroOS] driver_locations fetch failed:', error.message);
        return;
      }
      callback(data ?? []);
    });
  };

  reload();

  const channel = supabase
    .channel(uniqueChannel('driver_locations'))
    .on('postgres_changes', { event: '*', schema: 'public', table: T.DRIVER_LOCATIONS }, (payload) => {
      const center = resolveCenter(options);
      const bbox = boundingBox(center, radiusKm);
      if (bbox) {
        const row = payload.new ?? payload.old;
        if (!withinBbox(row, bbox)) return;
      }
      reload();
    })
    .subscribe();

  return channel;
}

// ─── Trips ───────────────────────────────────────────────────────────────────
async function requireMateSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.user) {
    return { user: null, error: { message: 'Not signed in. Please log in again on the Mate tab.' } };
  }
  return { user: session.user, error: null };
}

export async function createTrip(_mateId, route, origin, destination, totalSeats) {
  const { user, error: authError } = await requireMateSession();
  if (authError) return { data: null, error: authError };

  const { error: profileError } = await ensureMateProfile(user);
  if (profileError) return { data: null, error: profileError };

  const { data: rpcData, error: rpcError } = await supabase.rpc('create_mate_trip', {
    p_route:         route,
    p_origin:        origin,
    p_destination:   destination,
    p_total_seats:   totalSeats,
  });

  if (!rpcError && rpcData?.ok === true && rpcData?.trip) {
    return { data: rpcData.trip, error: null };
  }

  if (!rpcError && rpcData?.ok === false) {
    return { data: null, error: { message: rpcData.error ?? 'Could not start trip' } };
  }

  // Fallback if RPC not deployed yet (run FIX_mate_depart_now.sql)
  const direct = await supabase
    .from(T.TRIPS)
    .insert({
      mate_id:          user.id,
      route,
      origin,
      destination,
      total_seats:      totalSeats,
      available_seats:  totalSeats,
      status:           'active',
    })
    .select()
    .single();

  if (direct.error && rpcError) {
    return { data: null, error: { message: rpcError.message } };
  }

  return direct;
}

export async function updateTripSeats(tripId, newAvailableSeats, status) {
  const { error: authError } = await requireMateSession();
  if (authError) return Promise.reject(new Error(authError.message));

  const patch = { available_seats: newAvailableSeats };
  if (status !== undefined) patch.status = status;
  return supabase.from(T.TRIPS).update(patch).eq('id', tripId);
}

export async function endTrip(tripId) {
  const { error: authError } = await requireMateSession();
  if (authError) return Promise.reject(new Error(authError.message));

  return supabase.from(T.TRIPS).update({ status: 'completed', available_seats: 0 }).eq('id', tripId);
}

export async function updateTripDestination(tripId, { route, origin, destination }) {
  const { error: authError } = await requireMateSession();
  if (authError) return { data: null, error: { message: authError.message } };

  const patch = {};
  if (route !== undefined) patch.route = route;
  if (origin !== undefined) patch.origin = origin;
  if (destination !== undefined) patch.destination = destination;
  if (Object.keys(patch).length === 0) {
    return { data: null, error: { message: 'No changes to save' } };
  }

  return supabase.from(T.TRIPS).update(patch).eq('id', tripId).select().single();
}

const TRIPS_SELECT_WITH_MATE =
  '*, mate_profiles(full_name, vehicle_registration, vehicle_type)';

async function fetchNearbyActiveTrips(center, radiusKm = 8) {
  const bbox = boundingBox(center, radiusKm);

  if (!bbox) {
    const { data, error } = await supabase
      .from(T.TRIPS)
      .select(TRIPS_SELECT_WITH_MATE)
      .eq('status', 'active');
    return { data: data ?? [], error };
  }

  const { data: nearbyDrivers, error: drvErr } = await supabase
    .from(T.DRIVER_LOCATIONS)
    .select('mate_id, latitude, longitude')
    .gte('latitude', bbox.minLat)
    .lte('latitude', bbox.maxLat)
    .gte('longitude', bbox.minLng)
    .lte('longitude', bbox.maxLng);

  if (drvErr) return { data: [], error: drvErr };

  const mateIds = Array.from(new Set((nearbyDrivers ?? []).map((d) => d.mate_id).filter(Boolean)));
  if (mateIds.length === 0) {
    const { data, error } = await supabase
      .from(T.TRIPS)
      .select(TRIPS_SELECT_WITH_MATE)
      .eq('status', 'active');
    return { data: data ?? [], error };
  }

  const { data, error } = await supabase
    .from(T.TRIPS)
    .select(TRIPS_SELECT_WITH_MATE)
    .eq('status', 'active')
    .in('mate_id', mateIds);
  return { data: data ?? [], error };
}

export { fetchNearbyActiveTrips };

/**
 * Geo-bounded active-trips subscription.
 *
 * Trips themselves have no coords, so we first pull the nearby driver_locations
 * (bbox-filtered) and then fetch trips whose mate_id appears in that set.
 * Without a center we fall back to the legacy "all active trips" behaviour
 * for backwards compatibility (idle map, dashboards, etc).
 */
export function subscribeToTrips(callback, options = {}) {
  const { radiusKm = 8 } = options;

  const fetchActive = async () => {
    const center = resolveCenter(options);
    const { data, error } = await fetchNearbyActiveTrips(center, radiusKm);
    if (!error) callback(data);
  };

  fetchActive();

  const channel = supabase
    .channel(uniqueChannel('trips'))
    .on('postgres_changes', { event: '*', schema: 'public', table: T.TRIPS }, () => {
      fetchActive();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: T.DRIVER_LOCATIONS }, () => {
      fetchActive();
    })
    .subscribe();

  return channel;
}

// ─── Passenger locations ─────────────────────────────────────────────────────
/** Set false after first "table not in schema" error so the app keeps working. */
let passengerLocationsSupported = true;

function isPassengerLocationsSchemaError(error) {
  const msg = String(error?.message ?? '');
  return (
    msg.includes('schema cache')
    || msg.includes('Could not find the table')
    || msg.includes('passenger_locations')
    || error?.code === 'PGRST205'
  );
}

function markPassengerLocationsUnavailable(error) {
  if (!isPassengerLocationsSchemaError(error)) return;
  if (passengerLocationsSupported) {
    passengerLocationsSupported = false;
    console.warn(
      '[TrotroOS] passenger_locations unavailable — run supabase/FIX_live_demand.sql. Demand queue disabled until then.',
    );
  }
}

export function isPassengerLocationsAvailable() {
  return passengerLocationsSupported;
}

export async function upsertPassengerLocation(deviceId, reservationId, latitude, longitude, queuedRoute = null) {
  if (!passengerLocationsSupported) {
    return { data: null, error: null };
  }
  const payload = {
    passenger_id:    deviceId,
    reservation_id:  reservationId ?? null,
    latitude,
    longitude,
    updated_at:      new Date().toISOString(),
  };
  if (queuedRoute !== undefined) payload.queued_route = queuedRoute ?? null;
  const result = await supabase
    .from(T.PASSENGER_LOCATIONS)
    .upsert(payload, { onConflict: 'passenger_id' });
  if (result.error) markPassengerLocationsUnavailable(result.error);
  return result;
}

export async function deletePassengerLocation(deviceId) {
  if (!passengerLocationsSupported) {
    return { data: null, error: null };
  }
  const result = await supabase.from(T.PASSENGER_LOCATIONS).delete().eq('passenger_id', deviceId);
  if (result.error) markPassengerLocationsUnavailable(result.error);
  return result;
}

export async function fetchPassengerLocations(options = {}) {
  if (!passengerLocationsSupported) {
    return { data: [], error: null };
  }
  const { center = null, radiusKm = 2 } = options;
  const bbox = boundingBox(center, radiusKm);
  let q = supabase
    .from(T.PASSENGER_LOCATIONS)
    .select('*')
    .order('updated_at', { ascending: false });
  if (bbox) {
    q = q
      .gte('latitude', bbox.minLat)
      .lte('latitude', bbox.maxLat)
      .gte('longitude', bbox.minLng)
      .lte('longitude', bbox.maxLng);
  }
  const result = await q;
  if (result.error) markPassengerLocationsUnavailable(result.error);
  return result;
}

export function subscribeToPassengerLocations(callback, options = {}) {
  if (!passengerLocationsSupported) return null;

  const { radiusKm = 8 } = options;

  const load = () => {
    if (!passengerLocationsSupported) return;
    const center = resolveCenter(options);
    fetchPassengerLocations({ center, radiusKm }).then(({ data, error }) => {
      if (error) return;
      callback(data ?? []);
    });
  };

  load();

  const channel = supabase
    .channel(uniqueChannel('passenger_locations'))
    .on('postgres_changes', { event: '*', schema: 'public', table: T.PASSENGER_LOCATIONS }, (payload) => {
      if (!passengerLocationsSupported) return;
      const center = resolveCenter(options);
      const bbox = boundingBox(center, radiusKm);
      if (bbox) {
        const row = payload.new ?? payload.old;
        if (!withinBbox(row, bbox)) return;
      }
      load();
    })
    .subscribe();

  return channel;
}

// ─── Reservations ────────────────────────────────────────────────────────────
const RESERVATION_SELECT =
  '*, trips(*, mate_profiles(full_name, vehicle_registration, vehicle_type))';

/** reservations.passenger_id FK → passenger_profiles.device_id in production. */
export async function ensurePassengerProfileExists(deviceId) {
  const id = deviceId?.trim();
  if (!id) {
    return {
      ok: false,
      error: { message: 'Passenger ID is not ready yet. Please wait a moment and try again.' },
    };
  }

  const profileRow = {
    device_id: id,
    display_name: 'Passenger',
    phone: '',
    notify_trips: true,
    notify_reserve: true,
    notify_promo: false,
    share_location: true,
    anonymous_mode: true,
    updated_at: new Date().toISOString(),
  };

  const { error: upsertError } = await supabase
    .from(T.PASSENGER_PROFILES)
    .upsert(profileRow, { onConflict: 'device_id' });

  if (upsertError) {
    return { ok: false, error: upsertError };
  }

  const { data, error: verifyError } = await supabase
    .from(T.PASSENGER_PROFILES)
    .select('device_id')
    .eq('device_id', id)
    .maybeSingle();

  if (verifyError) {
    return { ok: false, error: verifyError };
  }
  if (!data?.device_id) {
    return {
      ok: false,
      error: {
        message:
          'Could not save passenger profile. Run supabase/FIX_passenger_profiles_and_reservations.sql in Supabase SQL Editor.',
      },
    };
  }

  return { ok: true, error: null };
}

export async function createReservation(tripId, passengerId = null) {
  const pid = passengerId?.trim() || null;
  if (!tripId) {
    return { data: null, error: { message: 'Trip ID is required.' } };
  }
  if (!pid) {
    return {
      data: null,
      error: { message: 'Passenger ID is not loaded yet. Please wait a moment and try again.' },
    };
  }

  const ensured = await ensurePassengerProfileExists(pid);
  if (!ensured.ok) {
    const msg = ensured.error?.message ?? '';
    if (msg.includes('passenger_profiles')) {
      return {
        data: null,
        error: {
          message:
            'Passenger profile table is missing in Supabase. Run supabase/FIX_passenger_profiles_and_reservations.sql in the SQL Editor.',
        },
      };
    }
    return { data: null, error: ensured.error };
  }

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  return supabase
    .from(T.RESERVATIONS)
    .insert({
      trip_id: tripId,
      passenger_id: pid,
      status: 'active',
      expires_at: expiresAt,
    })
    .select()
    .single();
}

export function getActiveReservation(deviceId) {
  return supabase
    .from(T.RESERVATIONS)
    .select(RESERVATION_SELECT)
    .eq('passenger_id', deviceId)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
}

export async function cancelReservation(reservationId, deviceId) {
  const { data, error } = await supabase.rpc('cancel_reservation', {
    p_reservation_id: reservationId,
    p_passenger_id: deviceId,
  });
  if (error) return { ok: false, error };
  if (data?.ok === false) return { ok: false, error: { message: data.error ?? 'Cancel failed' } };
  return { ok: true, error: null };
}

export async function expireStaleReservations() {
  return supabase.rpc('expire_stale_reservations');
}

export async function getActiveMateTrip(_mateId) {
  const { user, error: authError } = await requireMateSession();
  if (authError) return { data: null, error: authError };

  return supabase
    .from(T.TRIPS)
    .select('*')
    .eq('mate_id', user.id)
    .in('status', ['active', 'full'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
}

export function subscribeToReservations(tripId, callback) {
  const fetchAll = () =>
    supabase
      .from(T.RESERVATIONS)
      .select('*')
      .eq('trip_id', tripId)
      .eq('status', 'active')
      .then(({ data }) => { callback({ type: 'sync', reservations: data ?? [] }); });

  fetchAll();

  const channel = supabase
    .channel(uniqueChannel(`reservations_trip_${tripId}`))
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: T.RESERVATIONS, filter: `trip_id=eq.${tripId}` },
      (payload) => {
        callback({ type: payload.eventType, reservation: payload.new, reservations: null });
        fetchAll();
      },
    )
    .subscribe();

  return channel;
}

export function fetchTripById(tripId) {
  return supabase.from(T.TRIPS).select('*').eq('id', tripId).maybeSingle();
}

export function fetchActiveReservationsForTrip(tripId) {
  return supabase
    .from(T.RESERVATIONS)
    .select('*')
    .eq('trip_id', tripId)
    .eq('status', 'active');
}

/** Real-time updates for a single active trip (seat count, status). */
export function subscribeToTripById(tripId, callback) {
  const fetchTrip = () =>
    fetchTripById(tripId).then(({ data }) => {
      if (data) callback(data);
    });

  fetchTrip();

  const channel = supabase
    .channel(uniqueChannel(`trip_${tripId}`))
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: T.TRIPS, filter: `id=eq.${tripId}` },
      () => { fetchTrip(); },
    )
    .subscribe();

  return channel;
}

/** Live mate trip list (Trips tab + history). */
export function subscribeToMateTrips(mateId, callback) {
  const fetchTrips = () =>
    getMateTripHistory(mateId).then(({ data }) => {
      callback(data ?? []);
    });

  fetchTrips();

  const channel = supabase
    .channel(uniqueChannel(`mate_trips_${mateId}`))
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: T.TRIPS, filter: `mate_id=eq.${mateId}` },
      () => { fetchTrips(); },
    )
    .subscribe();

  return channel;
}

/** Passenger reservation history updates. */
export function subscribeToPassengerHistory(deviceId, callback) {
  const fetchHistory = () =>
    getPassengerHistory(deviceId).then(({ data }) => {
      callback(data ?? []);
    });

  fetchHistory();

  const channel = supabase
    .channel(uniqueChannel(`passenger_history_${deviceId}`))
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: T.RESERVATIONS },
      () => { fetchHistory(); },
    )
    .subscribe();

  return channel;
}

// ─── Trip history ────────────────────────────────────────────────────────────
export function getPassengerHistory(deviceId, limit = 30) {
  return supabase
    .from(T.RESERVATIONS)
    .select('*, trips(origin, destination, route, status, mate_profiles(full_name, vehicle_registration))')
    .eq('passenger_id', deviceId)
    .order('created_at', { ascending: false })
    .limit(limit);
}

export function getMateTripHistory(mateId, limit = 30) {
  return supabase
    .from(T.TRIPS)
    .select('*')
    .eq('mate_id', mateId)
    .order('created_at', { ascending: false })
    .limit(limit);
}

// ─── Ratings ────────────────────────────────────────────────────────────────
export function submitRating(tripId, mateId, passengerDeviceId, stars, comment = null) {
  if (!tripId || !mateId || !passengerDeviceId) {
    return Promise.resolve({
      data: null,
      error: { message: 'Missing trip, mate, or passenger info for rating.' },
    });
  }
  return supabase
    .from(T.RATINGS)
    .insert({
      trip_id: tripId,
      mate_id: mateId,
      passenger_device_id: passengerDeviceId,
      stars,
      comment,
    });
}

export async function getMateRatingAverages(mateIds = []) {
  if (!mateIds.length) return {};
  const { data, error } = await supabase
    .from(T.RATINGS)
    .select('mate_id, stars')
    .in('mate_id', mateIds);
  if (error || !data) return {};

  const sums = {};
  for (const r of data) {
    const entry = sums[r.mate_id] ?? { total: 0, count: 0 };
    entry.total += r.stars;
    entry.count += 1;
    sums[r.mate_id] = entry;
  }
  const out = {};
  for (const [id, { total, count }] of Object.entries(sums)) {
    out[id] = { avg: total / count, count };
  }
  return out;
}

export function getPassengerRatings(deviceId, limit = 50) {
  return supabase
    .from(T.RATINGS)
    .select('*, trips(route, origin, destination, mate_profiles(full_name))')
    .eq('passenger_device_id', deviceId)
    .order('created_at', { ascending: false })
    .limit(limit);
}

// ─── Passenger profiles (Profile tab) ─────────────────────────────────────────
export function getPassengerProfileRemote(deviceId) {
  return supabase
    .from(T.PASSENGER_PROFILES)
    .select('*')
    .eq('device_id', deviceId)
    .maybeSingle();
}

export function upsertPassengerProfileRemote(deviceId, profile) {
  return supabase
    .from(T.PASSENGER_PROFILES)
    .upsert(
      {
        device_id:      deviceId,
        display_name:   profile.displayName,
        phone:          profile.phone ?? '',
        notify_trips:   profile.notifyTrips,
        notify_reserve: profile.notifyReserve,
        notify_promo:   profile.notifyPromo,
        share_location: profile.shareLocation,
        anonymous_mode: profile.anonymousMode,
        updated_at:     new Date().toISOString(),
      },
      { onConflict: 'device_id' },
    )
    .select()
    .single();
}
