import {
  DEFAULT_MAP_REGION,
  findRouteByPlaces,
  getRouteFare,
  resolvePlaceCoords,
} from '@/constants/routes';

function isLiveOrCustomRoute(route) {
  if (!route) return false;
  if (route.isCustom) return true;
  const id = String(route.id ?? '');
  return id.startsWith('custom_') || id.startsWith('live_');
}

/** Mate-side fare: trip DB value → route fare → catalog only for built-in routes. */
export function resolveMateRouteFare(route, persistedFare = null) {
  if (persistedFare != null && Number(persistedFare) > 0) return Number(persistedFare);
  if (route?.fareGhs != null && Number(route.fareGhs) > 0) return Number(route.fareGhs);
  if (isLiveOrCustomRoute(route)) return null;
  if (route?.id) return getRouteFare(route);
  return null;
}

export function formatMateRouteFare(route, persistedFare = null) {
  const ghs = resolveMateRouteFare(route, persistedFare);
  if (ghs == null) return 'Fare on board';
  const rounded = Number.isInteger(ghs) ? ghs : Number(ghs.toFixed(2));
  return `GHS ${rounded}`;
}

/** Build route state from a live trips row — never attach wrong catalog metadata. */
export function buildRouteFromTripRow(tripRow, customRoutes = []) {
  if (!tripRow) return null;

  const origin = tripRow.origin ?? '';
  const destination = tripRow.destination ?? '';
  const dbFare =
    tripRow.fare_ghs != null && Number(tripRow.fare_ghs) > 0
      ? Number(tripRow.fare_ghs)
      : null;

  const exact = findRouteByPlaces(origin, destination);
  if (exact) {
    return {
      ...exact,
      fareGhs: dbFare ?? exact.fareGhs,
    };
  }

  const customMatch = customRoutes.find(
    (r) => r.origin === origin && r.destination === destination,
  );
  if (customMatch) {
    return {
      ...customMatch,
      fareGhs: dbFare ?? customMatch.fareGhs ?? null,
      isCustom: true,
    };
  }

  return {
    id: `live_${tripRow.id}`,
    origin,
    destination,
    fareGhs: dbFare,
    mapCenter:
      resolvePlaceCoords(origin) ??
      resolvePlaceCoords(destination) ??
      DEFAULT_MAP_REGION,
    isCustom: true,
  };
}
