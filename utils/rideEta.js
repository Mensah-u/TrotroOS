/** Pickup ETA and trip-duration helpers for Kumasi trotro rides. */

import { resolvePlaceCoords } from '@/constants/routes';

const EARTH_RADIUS_KM = 6371;

/** Typical trotro speeds in city traffic (km/h). */
const SPEED_FAST_KMH = 22;
const SPEED_SLOW_KMH = 12;

/** Extra minutes for stops, boarding, and traffic variance. */
const BOARDING_BUFFER_MIN = 2;
const TRAFFIC_BUFFER_MIN = 3;

export function haversineKm(from, to) {
  if (!from?.latitude || !to?.latitude) return null;
  const dLat = ((to.latitude - from.latitude) * Math.PI) / 180;
  const dLon = ((to.longitude - from.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((from.latitude * Math.PI) / 180) *
      Math.cos((to.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function minutesForDistance(km, speedKmh) {
  return Math.ceil((km / speedKmh) * 60);
}

function durationFromDistanceKm(distanceKm, { kind = 'trip' } = {}) {
  if (distanceKm == null || distanceKm <= 0) return null;

  let minSpeed;
  let maxSpeed;
  let stopBufferMin;

  if (distanceKm < 12) {
    minSpeed = kind === 'pickup' ? SPEED_SLOW_KMH : 14;
    maxSpeed = kind === 'pickup' ? SPEED_FAST_KMH : 24;
    stopBufferMin = kind === 'pickup' ? BOARDING_BUFFER_MIN : 5;
  } else if (distanceKm < 40) {
    minSpeed = 22;
    maxSpeed = 38;
    stopBufferMin = 8;
  } else if (distanceKm < 100) {
    minSpeed = 42;
    maxSpeed = 62;
    stopBufferMin = 12;
  } else {
    minSpeed = 52;
    maxSpeed = 72;
    stopBufferMin = 18;
  }

  let minMinutes = minutesForDistance(distanceKm, maxSpeed) + Math.floor(stopBufferMin / 2);
  let maxMinutes =
    minutesForDistance(distanceKm, minSpeed) + stopBufferMin + (kind === 'pickup' ? TRAFFIC_BUFFER_MIN : 0);

  minMinutes = Math.max(2, minMinutes);
  maxMinutes = Math.max(minMinutes + 2, maxMinutes);

  return {
    minMinutes,
    maxMinutes,
    distanceKm,
    confidence: 'distance',
    label: formatEtaRange(minMinutes, maxMinutes),
  };
}

function catalogDuration(routeMeta, field) {
  const block = routeMeta?.[field] ?? routeMeta?.tripEta ?? routeMeta?.pickupEta;
  if (!block?.min || !block?.max) return null;
  return {
    minMinutes: block.min,
    maxMinutes: block.max,
    distanceKm: null,
    confidence: 'catalog',
    label: formatEtaRange(block.min, block.max),
  };
}

/**
 * Estimate when a trotro will reach the passenger at the route origin.
 * Uses live driver GPS when available; falls back to route defaults.
 */
export function estimatePickupEta({
  driverCoords,
  pickupCoords,
  routeMeta,
  availableSeats = 1,
}) {
  if (driverCoords?.latitude && pickupCoords?.latitude) {
    const distanceKm = haversineKm(driverCoords, pickupCoords);
    if (distanceKm != null) {
      let result = durationFromDistanceKm(distanceKm, { kind: 'pickup' });
      if (result && availableSeats <= 2) {
        const maxMinutes = result.maxMinutes + 4;
        result = {
          ...result,
          maxMinutes,
          label: formatEtaRange(result.minMinutes, maxMinutes),
        };
      }
      if (result) return { ...result, confidence: 'live' };
    }
  }

  const catalog = catalogDuration(routeMeta, 'pickupEta');
  if (catalog) return { ...catalog, confidence: 'approx' };

  return {
    minMinutes: 5,
    maxMinutes: 15,
    distanceKm: null,
    confidence: 'approx',
    label: formatEtaRange(5, 15),
  };
}

/**
 * Full trip duration from origin to destination.
 * Prefers distance from resolved place coords; falls back to catalog tripEta.
 */
export function estimateTripDuration({
  origin,
  destination,
  originCoords,
  destCoords,
  routeMeta,
} = {}) {
  const from = originCoords ?? resolvePlaceCoords(origin);
  const to = destCoords ?? resolvePlaceCoords(destination);

  if (from?.latitude && to?.latitude) {
    const distanceKm = haversineKm(from, to);
    const computed = durationFromDistanceKm(distanceKm, { kind: 'trip' });
    if (computed) {
      const catalog = catalogDuration(routeMeta, 'tripEta');
      if (catalog && routeMeta?.id) {
        const catalogMid = (catalog.minMinutes + catalog.maxMinutes) / 2;
        const computedMid = (computed.minMinutes + computed.maxMinutes) / 2;
        if (Math.abs(catalogMid - computedMid) <= 8) {
          return { ...catalog, confidence: 'catalog' };
        }
      }
      return computed;
    }
  }

  const catalog = catalogDuration(routeMeta, 'tripEta');
  if (catalog) return catalog;

  return {
    minMinutes: 12,
    maxMinutes: 25,
    distanceKm: null,
    confidence: 'approx',
    label: formatEtaRange(12, 25),
  };
}

function formatDurationPart(totalMinutes) {
  const mins = Math.max(0, Math.round(totalMinutes));
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  if (rem === 0) return `${hours} hr`;
  return `${hours} hr ${rem} min`;
}

export function formatEtaRange(minMinutes, maxMinutes) {
  if (minMinutes == null || maxMinutes == null) return 'Estimating…';
  if (minMinutes >= 60 || maxMinutes >= 60) {
    if (minMinutes === maxMinutes) return `~${formatDurationPart(minMinutes)}`;
    return `${formatDurationPart(minMinutes)}–${formatDurationPart(maxMinutes)}`;
  }
  if (minMinutes === maxMinutes) return `~${minMinutes} min`;
  return `${minMinutes}–${maxMinutes} min`;
}

export function formatDistance(km) {
  if (km == null) return null;
  if (km < 1) return `${Math.round(km * 1000)} m away`;
  return `${km.toFixed(1)} km away`;
}

export function summarizeRoutePickup(etas) {
  if (!etas?.length) return null;
  const min = Math.min(...etas.map((e) => e.minMinutes));
  const max = Math.max(...etas.map((e) => e.maxMinutes));
  const liveCount = etas.filter((e) => e.confidence === 'live').length;
  return {
    minMinutes: min,
    maxMinutes: max,
    label: formatEtaRange(min, max),
    liveCount,
  };
}
