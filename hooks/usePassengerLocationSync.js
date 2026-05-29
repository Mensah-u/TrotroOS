import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';

import {
  deletePassengerLocation,
  isPassengerLocationsAvailable,
  upsertPassengerLocation,
} from '@/services/supabase';
import { startLocationBroadcast } from '@/services/locationBroadcaster';
import useDebouncedValue from '@/hooks/useDebouncedValue';

/**
 * One GPS pipeline for the passenger screen.
 *
 * • Single broadcaster (no duplicate 5 s + 12 s GPS timers fighting each other).
 * • Route label is debounced so typing a custom location doesn't restart uploads.
 * • Refs hold deviceId / reservation metadata so callbacks never go stale.
 */
export default function usePassengerLocationSync({
  deviceId,
  fromPlace,
  toPlace,
  activeReservationId,
  isWaiting,
  queuedRouteLabel,
}) {
  const [passengerCoords, setPassengerCoords] = useState(null);
  const passengerCoordsRef = useRef(null);
  const stopRef = useRef(null);
  const restartLockRef = useRef(false);
  const deviceIdRef = useRef(deviceId);
  const shareRef = useRef({ reservationId: null, routeLabel: null });

  deviceIdRef.current = deviceId;

  const routeLabel =
    fromPlace && toPlace ? `${fromPlace} → ${toPlace}` : null;
  const debouncedRouteLabel = useDebouncedValue(routeLabel, 700);

  useEffect(() => {
    passengerCoordsRef.current = passengerCoords;
  }, [passengerCoords]);

  // Boot: permission + first fix (once).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!cancelled) {
          const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          passengerCoordsRef.current = coords;
          setPassengerCoords(coords);
        }
      } catch {
        // broadcaster will retry once a route is active
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const stopBroadcast = useCallback(async ({ removeFromDb = false } = {}) => {
    if (stopRef.current) {
      await stopRef.current().catch(() => {});
      stopRef.current = null;
    }
    if (removeFromDb && deviceIdRef.current) {
      await deletePassengerLocation(deviceIdRef.current).catch(() => {});
    }
  }, []);

  const startBroadcast = useCallback((reservationId, label) => {
    shareRef.current = { reservationId: reservationId ?? null, routeLabel: label ?? null };

    if (stopRef.current) return; // already running — metadata updated above

    stopRef.current = startLocationBroadcast({
      onCoords: (coords) => {
        passengerCoordsRef.current = coords;
        setPassengerCoords(coords);
      },
      onLocation: async (coords) => {
        const id = deviceIdRef.current;
        if (!id || !isPassengerLocationsAvailable()) return;
        const { reservationId: resId, routeLabel: rl } = shareRef.current;
        await upsertPassengerLocation(
          id,
          resId,
          coords.latitude,
          coords.longitude,
          rl,
        ).catch(() => {});
      },
    });
  }, []);

  const restartBroadcast = useCallback(async (reservationId, label) => {
    if (restartLockRef.current) return;
    restartLockRef.current = true;
    try {
      await stopBroadcast({ removeFromDb: false });
      startBroadcast(reservationId, label);
    } finally {
      restartLockRef.current = false;
    }
  }, [startBroadcast, stopBroadcast]);

  const modeKeyRef = useRef('');

  // Decide what to share based on priority: reservation > queue > browsing route.
  useEffect(() => {
    if (!deviceId) return undefined;

    let mode = 'off';
    let reservationId = null;
    let label = null;

    if (activeReservationId) {
      mode = 'reservation';
      reservationId = activeReservationId;
      label = shareRef.current.routeLabel ?? debouncedRouteLabel ?? queuedRouteLabel;
    } else if (isWaiting && queuedRouteLabel) {
      mode = 'queue';
      label = queuedRouteLabel;
    } else if (debouncedRouteLabel) {
      mode = 'browse';
      label = debouncedRouteLabel;
    }

    const nextKey = `${mode}:${reservationId ?? ''}:${label ?? ''}`;
    if (nextKey === modeKeyRef.current) return undefined;
    modeKeyRef.current = nextKey;

    if (mode === 'off') {
      stopBroadcast({ removeFromDb: true });
      return undefined;
    }

    restartBroadcast(reservationId, label);
    return () => { /* unmount handled separately */ };
  }, [
    deviceId,
    activeReservationId,
    isWaiting,
    queuedRouteLabel,
    debouncedRouteLabel,
    restartBroadcast,
    stopBroadcast,
  ]);

  useEffect(() => () => {
    stopBroadcast({ removeFromDb: true }).catch(() => {});
  }, [stopBroadcast]);

  return {
    passengerCoords,
    passengerCoordsRef,
    debouncedRouteLabel,
    setShareRouteLabel: (label) => { shareRef.current.routeLabel = label; },
    restartBroadcast,
    stopBroadcast,
  };
}
