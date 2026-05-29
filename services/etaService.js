/**
 * Caching ETA service.
 *
 * Goal: never let the screen call the underlying ETA calculator (or any
 * routing API) more than once per minute per (driver, pickup, route, seats)
 * tuple. Today that calculator is a local heuristic, but the moment we wire
 * a real Routing/Distance Matrix API behind it, the cache lets us stay well
 * under the 1 QPS-per-route soft cap most providers enforce.
 *
 * Architecture
 * ────────────
 *  ┌──────────────┐    getEta()    ┌──────────────────┐
 *  │  React UI    │ ─────────────▶ │  etaService.js   │
 *  └──────────────┘                │  ─ 60s TTL cache │
 *                                  │  ─ key dedupes   │
 *                                  │    in-flight req │
 *                                  └────────┬─────────┘
 *                                           │ on miss
 *                                           ▼
 *                                ┌─────────────────────┐
 *                                │  ETA_SERVICE_URL?   │
 *                                │  yes → HTTPS fetch  │
 *                                │  no  → local heur.  │
 *                                └─────────────────────┘
 *
 * The client never talks to Google/Mapbox/OSRM directly. To enable a
 * server-side cached ETA endpoint, set `ETA_SERVICE_URL` in
 * `constants/config.js` to e.g. `https://eta.trotroos.app`. See
 * `server/eta-service/README.md` for the matching Express implementation.
 */

import { ETA_SERVICE_URL } from '@/constants/config';
import { estimatePickupEta as localEstimatePickupEta, formatEtaRange } from '@/utils/rideEta';

const TTL_MS = 60_000;
const MAX_ENTRIES = 200;

const cache = new Map();           // key -> { value, expiresAt }
const inflight = new Map();        // key -> Promise<value>

function round(n, digits = 3) {
  if (n == null) return 'x';
  const factor = 10 ** digits;
  return Math.round(n * factor) / factor;
}

function makeKey({ driverCoords, pickupCoords, routeMeta, availableSeats }) {
  const driver = driverCoords
    ? `${round(driverCoords.latitude)},${round(driverCoords.longitude)}`
    : 'nodrv';
  const pickup = pickupCoords
    ? `${round(pickupCoords.latitude)},${round(pickupCoords.longitude)}`
    : 'nopu';
  const route = routeMeta?.id ?? routeMeta?.routeLabel ?? 'noroute';
  const seats = Number.isFinite(availableSeats) ? availableSeats : 0;
  return `${driver}|${pickup}|${route}|${seats}`;
}

function pruneIfFull(now) {
  if (cache.size <= MAX_ENTRIES) return;
  for (const [k, v] of cache) {
    if (v.expiresAt <= now) cache.delete(k);
    if (cache.size <= MAX_ENTRIES * 0.8) break;
  }
}

async function fetchRemoteEta(params) {
  if (!ETA_SERVICE_URL) return null;
  try {
    const res = await fetch(`${ETA_SERVICE_URL}/eta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        driverCoords: params.driverCoords,
        pickupCoords: params.pickupCoords,
        routeId: params.routeMeta?.id ?? null,
        availableSeats: params.availableSeats ?? null,
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json || typeof json.minMinutes !== 'number') return null;
    return {
      minMinutes: json.minMinutes,
      maxMinutes: json.maxMinutes,
      distanceKm: json.distanceKm ?? null,
      confidence: json.confidence ?? 'remote',
      label: json.label ?? formatEtaRange(json.minMinutes, json.maxMinutes),
    };
  } catch (e) {
    console.warn('[etaService] remote fetch failed, using local heuristic:', e?.message ?? e);
    return null;
  }
}

/**
 * Synchronous ETA accessor for hot paths (every render of every list row).
 *
 *  • Returns a fresh cached value when present (<60s old).
 *  • Otherwise computes the local heuristic synchronously and returns it,
 *    while kicking off an async remote refresh that updates the cache for
 *    the next call. This is "stale-while-revalidate" semantics.
 */
export function getEta(params) {
  const key = makeKey(params);
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.value;

  const local = localEstimatePickupEta(params);
  cache.set(key, { value: local, expiresAt: now + TTL_MS });
  pruneIfFull(now);

  // Async revalidate from remote service, if configured.
  if (ETA_SERVICE_URL && !inflight.has(key)) {
    const p = fetchRemoteEta(params).then((remote) => {
      if (remote) {
        cache.set(key, { value: remote, expiresAt: Date.now() + TTL_MS });
      }
      inflight.delete(key);
    });
    inflight.set(key, p);
  }

  return local;
}

/**
 * Async variant when the caller is OK awaiting the remote response.
 * Useful for one-shot details views (ride sheet, reservation confirmation).
 */
export async function getEtaAsync(params) {
  const key = makeKey(params);
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.value;

  if (inflight.has(key)) return inflight.get(key);

  const p = (async () => {
    const remote = await fetchRemoteEta(params);
    const value = remote ?? localEstimatePickupEta(params);
    cache.set(key, { value, expiresAt: Date.now() + TTL_MS });
    pruneIfFull(Date.now());
    inflight.delete(key);
    return value;
  })();

  inflight.set(key, p);
  return p;
}

export function clearEtaCache() {
  cache.clear();
  inflight.clear();
}

export function _debugCacheStats() {
  return {
    size: cache.size,
    inflight: inflight.size,
  };
}
