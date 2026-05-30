import { supabase } from '@/services/supabase';

const T = {
  SCHEDULED: 'scheduled_demand',
  SAFETY: 'safety_reports',
  PUSH: 'push_tokens',
  FAVORITES: 'passenger_favorite_routes',
  VERIFICATION: 'mate_verification_docs',
};

// ─── Scheduled demand ────────────────────────────────────────────────────────

export async function createScheduledDemand({ passengerId, routeLabel, pickupStop, scheduledAt, repeatDays = [] }) {
  return supabase.from(T.SCHEDULED).insert({
    passenger_id: passengerId,
    route_label: routeLabel,
    pickup_stop: pickupStop ?? null,
    scheduled_at: scheduledAt,
    repeat_days: repeatDays,
    status: 'active',
  }).select().single();
}

export function fetchScheduledDemand(passengerId) {
  return supabase
    .from(T.SCHEDULED)
    .select('*')
    .eq('passenger_id', passengerId)
    .eq('status', 'active')
    .order('scheduled_at', { ascending: true });
}

export async function cancelScheduledDemand(id, passengerId) {
  return supabase
    .from(T.SCHEDULED)
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('passenger_id', passengerId);
}

export function fetchUpcomingScheduledDemand(limit = 50) {
  return supabase
    .from(T.SCHEDULED)
    .select('*')
    .eq('status', 'active')
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(limit);
}

// ─── Safety reports ──────────────────────────────────────────────────────────

export async function submitSafetyReport(payload) {
  return supabase.from(T.SAFETY).insert({
    reporter_id: payload.reporterId,
    reporter_role: payload.reporterRole,
    trip_id: payload.tripId ?? null,
    reservation_id: payload.reservationId ?? null,
    category: payload.category,
    description: payload.description,
    status: 'open',
  }).select().single();
}

export function fetchMySafetyReports(reporterId) {
  return supabase
    .from(T.SAFETY)
    .select('*')
    .eq('reporter_id', reporterId)
    .order('created_at', { ascending: false })
    .limit(20);
}

// ─── Push tokens ─────────────────────────────────────────────────────────────

export async function upsertPushToken({ userId, userRole, expoPushToken, platform }) {
  return supabase.from(T.PUSH).upsert(
    {
      user_id: userId,
      user_role: userRole,
      expo_push_token: expoPushToken,
      platform: platform ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,expo_push_token' },
  );
}

// ─── Favorite routes sync ────────────────────────────────────────────────────

export async function syncFavoriteRouteRemote({ passengerId, routeId, routeLabel }) {
  return supabase.from(T.FAVORITES).upsert(
    { passenger_id: passengerId, route_id: routeId, route_label: routeLabel },
    { onConflict: 'passenger_id,route_id' },
  );
}

export async function removeFavoriteRouteRemote(passengerId, routeId) {
  return supabase.from(T.FAVORITES).delete().eq('passenger_id', passengerId).eq('route_id', routeId);
}

export function fetchFavoriteRoutesRemote(passengerId) {
  return supabase
    .from(T.FAVORITES)
    .select('*')
    .eq('passenger_id', passengerId)
    .order('created_at', { ascending: false });
}

// ─── Mate verification ───────────────────────────────────────────────────────

export async function submitVerificationDoc(mateId, docType, note) {
  return supabase.from(T.VERIFICATION).upsert(
    { mate_id: mateId, doc_type: docType, status: 'pending', note: note ?? null },
    { onConflict: 'mate_id,doc_type' },
  ).select().single();
}

export function fetchVerificationDocs(mateId) {
  return supabase.from(T.VERIFICATION).select('*').eq('mate_id', mateId);
}

export async function boardReservation(reservationId, mateId) {
  return supabase.rpc('board_reservation', {
    p_reservation_id: reservationId,
    p_mate_id: mateId,
  });
}

// ─── Admin / analytics aggregates ───────────────────────────────────────────

export async function fetchAdminStats() {
  const { data, error } = await supabase.rpc('admin_dashboard_stats');
  if (error || data?.ok === false) {
    return {
      totalTrips: 0,
      openReports: 0,
      scheduledDemand: 0,
      mateCount: 0,
      unauthorized: true,
      error: data?.error ?? error?.message,
    };
  }
  return {
    totalTrips: data.totalTrips ?? 0,
    openReports: data.openReports ?? 0,
    scheduledDemand: data.scheduledDemand ?? 0,
    mateCount: data.mateCount ?? 0,
    unauthorized: false,
  };
}

export async function fetchRecentTripsAdmin(limit = 25) {
  const { data, error } = await supabase.rpc('admin_recent_trips', { p_limit: limit });
  if (error) return { data: [], error };
  return { data: data ?? [], error: null };
}

export async function fetchOpenSafetyReports(limit = 25) {
  const { data, error } = await supabase.rpc('admin_open_safety_reports', { p_limit: limit });
  if (error) return { data: [], error };
  return { data: data ?? [], error: null };
}

export function fetchFleetGroups() {
  return supabase.from('fleet_groups').select('*').eq('active', true).order('name');
}
