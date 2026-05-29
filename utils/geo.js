/**
 * Geospatial helpers used to scope realtime queries to a small radius
 * around the passenger. Keeps Supabase read costs flat as the fleet grows.
 *
 * Two layers:
 *   1. Bounding box (lat/lng ranges) — works without any DB extension,
 *      uses normal B-tree indexes on `latitude` / `longitude`.
 *   2. Geohash prefix — optional, requires a `geohash5` column in the DB.
 *      Useful when bounding-box scans become hot and you want a single
 *      indexed equality / `like 'gc%'` filter instead of four range filters.
 */

const EARTH_RADIUS_KM = 6371;
const KM_PER_DEG_LAT = 110.574;

function kmPerDegLng(lat) {
  return 111.32 * Math.cos((lat * Math.PI) / 180);
}

export function haversineKm(a, b) {
  if (!a || !b) return null;
  if (a.latitude == null || b.latitude == null) return null;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) *
      Math.cos((b.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/**
 * Build a bounding box around `center` covering `radiusKm` in every direction.
 * Returns numeric bounds that can be plugged into Supabase range filters.
 */
export function boundingBox(center, radiusKm = 2) {
  if (!center?.latitude || !center?.longitude) return null;
  const dLat = radiusKm / KM_PER_DEG_LAT;
  const dLng = radiusKm / Math.max(0.001, kmPerDegLng(center.latitude));
  return {
    minLat: center.latitude - dLat,
    maxLat: center.latitude + dLat,
    minLng: center.longitude - dLng,
    maxLng: center.longitude + dLng,
  };
}

/** Returns true if a row's lat/lng is within the bbox (post-filter on realtime payloads). */
export function withinBbox(row, bbox) {
  if (!bbox) return true;
  const lat = row?.latitude;
  const lng = row?.longitude;
  if (lat == null || lng == null) return false;
  return (
    lat >= bbox.minLat &&
    lat <= bbox.maxLat &&
    lng >= bbox.minLng &&
    lng <= bbox.maxLng
  );
}

/** Coarse cache key for a center; rounds to ~120 m so we don't churn subscriptions on every GPS tick. */
export function bboxKey(center, radiusKm = 2) {
  if (!center?.latitude || !center?.longitude) return null;
  const lat = Math.round(center.latitude * 1000) / 1000;
  const lng = Math.round(center.longitude * 1000) / 1000;
  return `${lat},${lng}@${radiusKm}`;
}

// ─── Geohash (base-32) ────────────────────────────────────────────────────────
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/**
 * Encode {lat,lng} to a geohash of the requested length (1–12).
 * Precision rough guide:
 *   3 -> ~156 km, 4 -> ~39 km, 5 -> ~4.9 km, 6 -> ~1.2 km, 7 -> ~150 m.
 */
export function geohashEncode(latitude, longitude, precision = 5) {
  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;

  let hash = '';
  let bits = 0;
  let bit = 0;
  let evenBit = true;

  while (hash.length < precision) {
    if (evenBit) {
      const mid = (lngMin + lngMax) / 2;
      if (longitude >= mid) { bits = (bits << 1) | 1; lngMin = mid; }
      else { bits = bits << 1; lngMax = mid; }
    } else {
      const mid = (latMin + latMax) / 2;
      if (latitude >= mid) { bits = (bits << 1) | 1; latMin = mid; }
      else { bits = bits << 1; latMax = mid; }
    }
    evenBit = !evenBit;
    if (++bit === 5) {
      hash += BASE32[bits];
      bits = 0;
      bit = 0;
    }
  }
  return hash;
}

/**
 * Return the geohash of `center` plus its eight neighbours, suitable for
 * a `.in('geohash5', [...])` query. Precision 5 covers ~5 km cells so a
 * 3×3 grid (~15 km wide) safely contains every vehicle within 2 km.
 */
export function neighbourhoodHashes(center, precision = 5) {
  if (!center?.latitude || !center?.longitude) return [];
  const set = new Set();
  // Step roughly half a cell in each axis so we always hit neighbours.
  const step = precision === 5 ? 0.045 : 0.005;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      set.add(
        geohashEncode(center.latitude + dy * step, center.longitude + dx * step, precision),
      );
    }
  }
  return Array.from(set);
}
