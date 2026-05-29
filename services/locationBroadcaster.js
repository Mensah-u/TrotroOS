/**
 * Adaptive GPS broadcaster.
 *
 * One source of truth for "push my coords to Supabase every N seconds".
 *
 *   const stop = startLocationBroadcast({
 *     onLocation: (coords) => upsertPassengerLocation(deviceId, resId, coords.latitude, coords.longitude, routeLabel),
 *     onCoords:   setPassengerCoords,
 *   });
 *   // …later
 *   stop();
 *
 * Intervals (foreground only — matches Play Store / manifest policy):
 *
 *   active / inactive → every 5 s
 *   background        → paused (no GPS uploads until app returns to foreground)
 *
 * Coords are also accuracy-filtered (≥ 50 m horizontalAccuracy is dropped)
 * and distance-deduped: if the new fix is within DEDUPE_M of the last upload
 * and the timer just fired, we still skip the network round-trip.
 */

import * as Location from 'expo-location';
import { AppState } from 'react-native';

export const FOREGROUND_INTERVAL_MS = 5_000;
export const BACKGROUND_INTERVAL_MS = 30_000;
export const BACKGROUND_PAUSE_AFTER_MS = 5 * 60_000;
const ACCURACY_FLOOR_M = 50;
const DEDUPE_M = 8;

function metersBetween(a, b) {
  if (!a || !b) return Infinity;
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/**
 * @param {Object} cfg
 * @param {(coords:{latitude:number, longitude:number})=>void|Promise<void>} cfg.onLocation
 *   Called whenever a fresh fix is ready to be pushed upstream.
 * @param {(coords:{latitude:number, longitude:number})=>void} [cfg.onCoords]
 *   Optional UI callback called for *every* fix (even when network upload is deduped).
 * @param {Location.LocationAccuracy} [cfg.accuracy]
 * @param {boolean} [cfg.fireImmediately]
 * @returns {() => Promise<void>} stop function
 */
export function startLocationBroadcast({
  onLocation,
  onCoords,
  accuracy = Location.Accuracy.Balanced,
  fireImmediately = true,
}) {
  let cancelled = false;
  let timer = null;
  let lastUploaded = null;
  let lastBackgroundedAt = null;
  let appState = AppState.currentState;

  const intervalForState = (s) => (s === 'background' ? null : FOREGROUND_INTERVAL_MS);

  const tick = async ({ force = false } = {}) => {
    if (cancelled) return;
    if (appState === 'background') return;

    let perm;
    try {
      perm = await Location.getForegroundPermissionsAsync();
    } catch (e) {
      console.warn('[locationBroadcaster] permission read failed:', e?.message ?? e);
      return;
    }
    if (perm.status !== 'granted') return;

    let loc;
    try {
      loc = await Location.getCurrentPositionAsync({ accuracy });
    } catch (e) {
      console.warn('[locationBroadcaster] getCurrentPositionAsync failed:', e?.message ?? e);
      return;
    }

    const coords = {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    };
    const acc = loc.coords.accuracy;
    if (typeof acc === 'number' && acc > ACCURACY_FLOOR_M) {
      // GPS is too coarse — still notify the UI but skip the upload.
      onCoords?.(coords);
      return;
    }

    onCoords?.(coords);

    const distance = metersBetween(lastUploaded, coords);
    if (!force && lastUploaded && distance < DEDUPE_M) return;

    try {
      await onLocation?.(coords);
      lastUploaded = coords;
    } catch (e) {
      console.warn('[locationBroadcaster] upload failed:', e?.message ?? e);
    }
  };

  const scheduleNext = () => {
    if (cancelled) return;
    if (timer) clearTimeout(timer);
    const interval = intervalForState(appState);
    if (!interval) return;
    timer = setTimeout(async () => {
      await tick();
      scheduleNext();
    }, interval);
  };

  const handleAppState = (next) => {
    const prev = appState;
    appState = next;
    if (prev !== 'background' && next === 'background') {
      lastBackgroundedAt = Date.now();
    } else if (prev === 'background' && next !== 'background') {
      lastBackgroundedAt = null;
      // Snap-back: force a fix immediately on return to foreground.
      tick({ force: true });
    }
    scheduleNext();
  };

  const sub = AppState.addEventListener('change', handleAppState);

  if (fireImmediately) tick({ force: true });
  scheduleNext();

  return async () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    timer = null;
    sub?.remove?.();
  };
}
