/**
 * Offline-first static data service.
 *
 * Static reference data (Kumasi trotro routes, stations, fares, place coords)
 * is bundled with the app, persisted to AsyncStorage on first launch, and
 * read from local storage on every subsequent launch. The network is **only**
 * consulted to check for a newer dataset version — never to render the UI.
 *
 * Why
 * ───
 *   • Cold start: no spinner waiting on a routes endpoint. Map and route
 *     planner are usable while offline (phone in a tunnel, in a basement,
 *     out of data bundle).
 *   • Cheap reads: zero Supabase reads per session for static reference data.
 *   • Update path: bump `STATIC_DATA_VERSION` in the bundle, optionally point
 *     `STATIC_DATA_URL` at a CDN JSON file, and clients pull the diff once
 *     in the background.
 *
 * Contract
 * ────────
 *   • `getStaticDataSync()` returns the in-memory snapshot synchronously.
 *     Always non-null thanks to the bundled fallback.
 *   • `loadStaticData()` warms cache from AsyncStorage, then bundled data.
 *   • `refreshStaticData()` (optional) pulls a remote JSON and persists it
 *     if `version > current`.
 *   • Everything imports from this service; nothing should hit the network
 *     for routes / places / fares.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import * as bundled from '@/constants/routes';

const STORAGE_KEY = 'staticData.v1';
/** Bump when the bundled dataset is updated so old caches are discarded. */
export const STATIC_DATA_VERSION = 1;

/** Optional CDN endpoint serving `{ version, routes, placeCoords }`. Leave '' to disable network sync. */
const STATIC_DATA_URL = '';

const BUNDLED_SNAPSHOT = Object.freeze({
  version: STATIC_DATA_VERSION,
  routes: bundled.routes,
  placeCoords: bundled.placeCoords,
  source: 'bundle',
});

let snapshot = BUNDLED_SNAPSHOT;
let loaded = false;
let loadingPromise = null;

export function getStaticDataSync() {
  return snapshot;
}

/** Returns the merged routes array (custom + bundled = same shape). */
export function getRoutes() {
  return snapshot.routes;
}

export function getPlaceCoordsMap() {
  return snapshot.placeCoords;
}

export function getPlaceCoords(place) {
  if (!place) return null;
  return snapshot.placeCoords[place] ?? null;
}

export function getAllPlaces() {
  const set = new Set();
  for (const r of snapshot.routes) {
    set.add(r.origin);
    set.add(r.destination);
  }
  return Array.from(set).sort();
}

export function getOrigins() {
  return [...new Set(snapshot.routes.map((r) => r.origin))].sort();
}

export function getDestinationsForOrigin(origin) {
  if (!origin) return getAllPlaces();
  return snapshot.routes.filter((r) => r.origin === origin).map((r) => r.destination);
}

export function findRouteByPlaces(origin, destination) {
  if (!origin || !destination) return null;
  return snapshot.routes.find((r) => r.origin === origin && r.destination === destination) ?? null;
}

function isValidPayload(obj) {
  return (
    obj &&
    typeof obj.version === 'number' &&
    Array.isArray(obj.routes) &&
    obj.placeCoords &&
    typeof obj.placeCoords === 'object'
  );
}

/**
 * Idempotent. Warms `snapshot` from AsyncStorage on first call, falling back
 * to the bundled data. Safe to call from multiple places — subsequent calls
 * return the in-flight promise.
 */
export function loadStaticData() {
  if (loaded) return Promise.resolve(snapshot);
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (isValidPayload(parsed) && parsed.version >= STATIC_DATA_VERSION) {
          snapshot = Object.freeze({ ...parsed, source: 'cache' });
        } else {
          // Cache is older than the bundle — discard.
          await AsyncStorage.removeItem(STORAGE_KEY);
        }
      }
      // Ensure the bundle is at least persisted so first offline launches work.
      if (snapshot.source === 'bundle') {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(BUNDLED_SNAPSHOT));
      }
    } catch (e) {
      console.warn('[staticData] load failed:', e?.message ?? e);
    } finally {
      loaded = true;
      loadingPromise = null;
    }
    return snapshot;
  })();

  return loadingPromise;
}

/**
 * Optional best-effort remote refresh. No-ops when `STATIC_DATA_URL` is empty.
 * Call from `App.js` on a focus/foreground event — never from a render path.
 */
export async function refreshStaticData() {
  if (!STATIC_DATA_URL) return snapshot;
  try {
    const res = await fetch(STATIC_DATA_URL, { method: 'GET' });
    if (!res.ok) return snapshot;
    const remote = await res.json();
    if (!isValidPayload(remote)) return snapshot;
    if (remote.version <= snapshot.version) return snapshot;

    snapshot = Object.freeze({ ...remote, source: 'remote' });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    return snapshot;
  } catch (e) {
    console.warn('[staticData] refresh failed:', e?.message ?? e);
    return snapshot;
  }
}

export async function clearStaticDataCache() {
  await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  snapshot = BUNDLED_SNAPSHOT;
  loaded = false;
}
