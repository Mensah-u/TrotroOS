import { useCallback, useEffect, useRef } from 'react';
import { Alert, AppState } from 'react-native';

import { getOrCreateDeviceId, saveActiveReservationCache } from '@/services/passengerProfile';
import {
  expireStaleMateRideRequests,
  fetchPendingRideRequestsForPassenger,
  filterLiveRideRequests,
  respondMateRideRequest,
  subscribeToPassengerRideRequests,
} from '@/services/rideRequests';
import { emitMateRideAccepted, emitMateRideInvite } from '@/services/rideRequestBus';
import { getActiveReservation, setSupabaseDeviceId, supabase } from '@/services/supabase';
import { formatSupabaseError } from '@/utils/supabaseErrors';

const POLL_MS = 5_000;

/**
 * Listens for mate seat invites on every passenger tab (not only Find Ride).
 * Shows the system alert and forwards events to FindRideScreen via rideRequestBus.
 */
export default function PassengerRideRequestWatcher() {
  const deviceIdRef = useRef(null);
  const channelRef = useRef(null);
  const handledRef = useRef(new Set());
  const showingRef = useRef(null);
  const hasReservationRef = useRef(false);

  const refreshReservationGate = useCallback(async () => {
    const id = deviceIdRef.current;
    if (!id) {
      hasReservationRef.current = false;
      return;
    }
    await expireStaleMateRideRequests().catch(() => {});
    const { data } = await getActiveReservation(id);
    hasReservationRef.current = !!data?.id;
  }, []);

  const presentInvite = useCallback((req) => {
    if (!req?.id || handledRef.current.has(req.id)) return;
    if (hasReservationRef.current) return;
    if (showingRef.current === req.id) return;

    const route = req.route_label ?? req.trips?.route ?? 'your route';
    const fare = req.fare_ghs ?? req.trips?.fare_ghs;
    const mate = req.trips?.mate_profiles;
    const mateLine = mate?.full_name
      ? `${mate.full_name}${mate.vehicle_registration ? ` · ${mate.vehicle_registration}` : ''}`
      : 'A mate';

    let message = `${mateLine} is heading your way on ${route}.`;
    if (fare != null && Number(fare) > 0) message += `\nFare: GHS ${Number(fare).toFixed(2)}`;
    message += '\n\nReserve a seat on this trip?';

    showingRef.current = req.id;
    emitMateRideInvite(req);

    const clearShowing = () => {
      if (showingRef.current === req.id) showingRef.current = null;
    };

    Alert.alert(
      'Seat invitation',
      message,
      [
        {
          text: 'Not now',
          style: 'cancel',
          onPress: () => {
            clearShowing();
            handledRef.current.add(req.id);
            const pid = deviceIdRef.current;
            if (pid) respondMateRideRequest(req.id, pid, false).catch(() => {});
          },
        },
        {
          text: 'Reserve seat',
          onPress: async () => {
            clearShowing();
            const pid = deviceIdRef.current;
            if (!pid) return;
            const { data, error } = await respondMateRideRequest(req.id, pid, true);
            if (error) {
              Alert.alert('Reservation failed', formatSupabaseError(error.message));
              return;
            }
            handledRef.current.add(req.id);
            hasReservationRef.current = true;
            const res = data?.reservation;
            const tripId = data?.trip_id ?? req.trip_id ?? req.trips?.id;
            if (res?.id) {
              await saveActiveReservationCache({
                reservationId: res.id,
                tripId: tripId ?? null,
              }).catch(() => {});
            }
            emitMateRideAccepted({ request: req, reservation: res, tripId });
          },
        },
      ],
      { cancelable: true, onDismiss: clearShowing },
    );
  }, []);

  const processPending = useCallback(async () => {
    const id = deviceIdRef.current;
    if (!id || hasReservationRef.current) return;

    await expireStaleMateRideRequests().catch(() => {});
    const { data, error } = await fetchPendingRideRequestsForPassenger(id);
    if (error) {
      if (__DEV__) console.warn('[PassengerRideRequestWatcher] fetch failed:', error.message);
      return;
    }

    const live = filterLiveRideRequests(data);
    const next = live.find((r) => !handledRef.current.has(r.id));
    if (next) presentInvite(next);
  }, [presentInvite]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const id = await getOrCreateDeviceId();
      if (cancelled || !id) return;
      deviceIdRef.current = id;
      setSupabaseDeviceId(id);
      await refreshReservationGate();

      if (channelRef.current) supabase.removeChannel(channelRef.current);
      channelRef.current = subscribeToPassengerRideRequests(id, (requests) => {
        if (hasReservationRef.current) return;
        const next = filterLiveRideRequests(requests).find((r) => !handledRef.current.has(r.id));
        if (next) presentInvite(next);
      });

      processPending();
    })();

    const pollId = setInterval(processPending, POLL_MS);

    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refreshReservationGate().then(processPending);
      }
    });

    return () => {
      cancelled = true;
      clearInterval(pollId);
      appSub.remove();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [presentInvite, processPending, refreshReservationGate]);

  return null;
}
