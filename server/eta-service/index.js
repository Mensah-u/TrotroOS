/**
 * TrotroOS ETA service.
 *
 * Single endpoint: `POST /eta` → `{ minMinutes, maxMinutes, distanceKm, confidence, label }`.
 *
 * Acts as a thin in-memory cache (60s TTL) in front of whichever routing API
 * you want to use server-side (Google Routes, Mapbox Directions, OSRM, etc).
 * The mobile client only ever talks to this service, never to the routing
 * provider directly. That means:
 *   • API keys stay on the server.
 *   • Per-route calls are deduplicated (one upstream call per key per minute).
 *   • If the upstream is down, we still return the local heuristic.
 *
 * Set ROUTING_PROVIDER=google + GOOGLE_ROUTES_API_KEY to enable real routing.
 * Otherwise the service falls back to the same Haversine heuristic the app
 * uses today (so you can deploy first and switch on routing later).
 */

const express = require('express');
const morgan = require('morgan');

const PORT = process.env.PORT || 8787;
const TTL_MS = Number(process.env.ETA_TTL_MS || 60_000);
const MAX_ENTRIES = Number(process.env.ETA_CACHE_MAX || 5000);

const ROUTING_PROVIDER = (process.env.ROUTING_PROVIDER || 'heuristic').toLowerCase();
const GOOGLE_ROUTES_API_KEY = process.env.GOOGLE_ROUTES_API_KEY || '';

const cache = new Map();
const inflight = new Map();

const EARTH_RADIUS_KM = 6371;
const SPEED_FAST_KMH = 22;
const SPEED_SLOW_KMH = 12;
const BOARDING_BUFFER_MIN = 2;
const TRAFFIC_BUFFER_MIN = 3;

function haversineKm(a, b) {
  if (!a || !b) return null;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) *
      Math.cos((b.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function formatRange(minM, maxM) {
  if (minM == null || maxM == null) return 'Estimating…';
  if (minM === maxM) return `~${minM} min`;
  return `${minM}–${maxM} min`;
}

function heuristicEta({ driverCoords, pickupCoords, availableSeats }) {
  if (!driverCoords?.latitude || !pickupCoords?.latitude) {
    return {
      minMinutes: 5,
      maxMinutes: 15,
      distanceKm: null,
      confidence: 'approx',
      label: formatRange(5, 15),
    };
  }
  const distanceKm = haversineKm(driverCoords, pickupCoords);
  let minMinutes = Math.ceil((distanceKm / SPEED_FAST_KMH) * 60) + BOARDING_BUFFER_MIN;
  let maxMinutes =
    Math.ceil((distanceKm / SPEED_SLOW_KMH) * 60) + BOARDING_BUFFER_MIN + TRAFFIC_BUFFER_MIN;
  if ((availableSeats ?? 0) <= 2) maxMinutes += 4;
  minMinutes = Math.max(2, minMinutes);
  maxMinutes = Math.max(minMinutes + 2, maxMinutes);
  return {
    minMinutes,
    maxMinutes,
    distanceKm,
    confidence: 'heuristic',
    label: formatRange(minMinutes, maxMinutes),
  };
}

async function googleRoutesEta({ driverCoords, pickupCoords, availableSeats }) {
  if (!GOOGLE_ROUTES_API_KEY) return null;
  if (!driverCoords?.latitude || !pickupCoords?.latitude) return null;
  try {
    const url = `https://routes.googleapis.com/directions/v2:computeRoutes`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_ROUTES_API_KEY,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters',
      },
      body: JSON.stringify({
        origin: { location: { latLng: driverCoords } },
        destination: { location: { latLng: pickupCoords } },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const route = json?.routes?.[0];
    if (!route) return null;
    const seconds = Number(String(route.duration).replace('s', ''));
    const minMinutes = Math.max(2, Math.ceil(seconds / 60) + BOARDING_BUFFER_MIN);
    let maxMinutes = minMinutes + TRAFFIC_BUFFER_MIN;
    if ((availableSeats ?? 0) <= 2) maxMinutes += 4;
    return {
      minMinutes,
      maxMinutes,
      distanceKm: (route.distanceMeters ?? 0) / 1000,
      confidence: 'live',
      label: formatRange(minMinutes, maxMinutes),
    };
  } catch (e) {
    console.warn('[eta-service] google routes failed:', e.message);
    return null;
  }
}

async function computeEta(params) {
  if (ROUTING_PROVIDER === 'google') {
    const remote = await googleRoutesEta(params);
    if (remote) return remote;
  }
  return heuristicEta(params);
}

function round(n, digits = 3) {
  if (n == null) return 'x';
  const factor = 10 ** digits;
  return Math.round(n * factor) / factor;
}

function makeKey({ driverCoords, pickupCoords, routeId, availableSeats }) {
  const driver = driverCoords ? `${round(driverCoords.latitude)},${round(driverCoords.longitude)}` : 'nodrv';
  const pickup = pickupCoords ? `${round(pickupCoords.latitude)},${round(pickupCoords.longitude)}` : 'nopu';
  return `${driver}|${pickup}|${routeId ?? 'nor'}|${availableSeats ?? 0}`;
}

function pruneExpired(now) {
  for (const [k, v] of cache) {
    if (v.expiresAt <= now) cache.delete(k);
    if (cache.size <= MAX_ENTRIES * 0.85) break;
  }
}

const app = express();
app.use(express.json({ limit: '32kb' }));
app.use(morgan('tiny'));

app.get('/health', (_req, res) => res.json({ ok: true, cacheSize: cache.size }));

app.post('/eta', async (req, res) => {
  const { driverCoords, pickupCoords, routeId, availableSeats } = req.body ?? {};

  const params = { driverCoords, pickupCoords, routeId, availableSeats };
  const key = makeKey(params);
  const now = Date.now();

  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) {
    res.set('x-cache', 'hit');
    return res.json(hit.value);
  }

  if (inflight.has(key)) {
    res.set('x-cache', 'inflight');
    const value = await inflight.get(key);
    return res.json(value);
  }

  const p = computeEta(params).then((value) => {
    cache.set(key, { value, expiresAt: Date.now() + TTL_MS });
    if (cache.size > MAX_ENTRIES) pruneExpired(Date.now());
    inflight.delete(key);
    return value;
  });
  inflight.set(key, p);

  res.set('x-cache', 'miss');
  const value = await p;
  return res.json(value);
});

app.listen(PORT, () => {
  console.log(`[eta-service] listening on :${PORT} (provider=${ROUTING_PROVIDER}, ttl=${TTL_MS}ms)`);
});
