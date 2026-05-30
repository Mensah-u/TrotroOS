import {
  findRouteById,
  findRouteByPlaces,
  findRouteIdByLabel,
  getRouteFare,
  routes,
} from '@/constants/routes';
import { tripMatchesRoute } from '@/utils/routeMatching';

/** Combine trip row + live driver broadcast into one fare lookup object. */
export function mergeTripFareSources(trip, driver = null) {
  if (!trip && !driver) return null;
  const fare =
    trip?.fare_ghs ??
    trip?.fareGhs ??
    driver?.fare_ghs ??
    driver?.fareGhs ??
    null;
  return {
    ...(trip ?? {}),
    fare_ghs: fare,
    fareGhs: fare,
  };
}

/**
 * Resolve GHS fare for a trip card or live row.
 * Live rides use mate-set fare only (trip row or driver GPS row) — no catalog default.
 */
export function resolveTripFareGhs(trip, options = {}) {
  const { driver = null, allowCatalogFallback = false } = options;
  const merged = mergeTripFareSources(trip, driver) ?? trip ?? driver ?? {};
  const explicit = merged.fare_ghs ?? merged.fareGhs;
  if (explicit != null && Number(explicit) > 0) {
    return Number(explicit);
  }

  if (!allowCatalogFallback) return null;

  const origin = merged.origin ?? merged.originStation ?? '';
  const destination = merged.destination ?? '';
  if (!origin || !destination) return null;

  const exact = findRouteByPlaces(origin, destination);
  if (exact) return getRouteFare(exact);

  const catalogMatch = routes.find((r) =>
    tripMatchesRoute({ origin, destination, route: merged.route }, r.origin, r.destination),
  );
  if (catalogMatch) return getRouteFare(catalogMatch);

  const routeLabel = merged.route ?? `${origin} → ${destination}`;
  const routeId = findRouteIdByLabel(routeLabel);
  if (routeId) return getRouteFare(findRouteById(routeId));

  return null;
}

export function formatTripFare(trip, options = {}) {
  const ghs = resolveTripFareGhs(trip, options);
  if (ghs == null || ghs <= 0) return 'Fare on board';
  const rounded = Number.isInteger(ghs) ? ghs : Number(ghs.toFixed(2));
  return `GHS ${rounded}`;
}
