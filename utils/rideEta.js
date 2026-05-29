/** Pickup ETA helpers for Kumasi trotro rides. */

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
  const fallback = routeMeta?.pickupEta ?? { min: 5, max: 15 };

  if (!driverCoords?.latitude || !pickupCoords?.latitude) {
    return {
      minMinutes: fallback.min,
      maxMinutes: fallback.max,
      distanceKm: null,
      confidence: 'approx',
      label: formatEtaRange(fallback.min, fallback.max),
    };
  }

  const distanceKm = haversineKm(driverCoords, pickupCoords);
  if (distanceKm == null) {
    return {
      minMinutes: fallback.min,
      maxMinutes: fallback.max,
      distanceKm: null,
      confidence: 'approx',
      label: formatEtaRange(fallback.min, fallback.max),
    };
  }

  let minMinutes = minutesForDistance(distanceKm, SPEED_FAST_KMH) + BOARDING_BUFFER_MIN;
  let maxMinutes =
    minutesForDistance(distanceKm, SPEED_SLOW_KMH) + BOARDING_BUFFER_MIN + TRAFFIC_BUFFER_MIN;

  // Nearly full trotros may stop longer to fill seats.
  if (availableSeats <= 2) {
    maxMinutes += 4;
  }

  minMinutes = Math.max(2, minMinutes);
  maxMinutes = Math.max(minMinutes + 2, maxMinutes);

  return {
    minMinutes,
    maxMinutes,
    distanceKm,
    confidence: 'live',
    label: formatEtaRange(minMinutes, maxMinutes),
  };
}

/** Full trip duration from origin to destination (for ride details). */
export function estimateTripDuration(routeMeta) {
  const trip = routeMeta?.tripEta ?? { min: 12, max: 25 };
  return {
    minMinutes: trip.min,
    maxMinutes: trip.max,
    label: formatEtaRange(trip.min, trip.max),
  };
}

export function formatEtaRange(minMinutes, maxMinutes) {
  if (minMinutes == null || maxMinutes == null) return 'Estimating…';
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
