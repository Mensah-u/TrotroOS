/**
 * Corridor-first launch — show these routes first in Find Ride.
 * Set to null or [] to show all routes.
 */
export const LAUNCH_CORRIDOR_ROUTE_IDS = ['1', '2', '3'];

export function filterLaunchRoutes(allRoutes) {
  if (!LAUNCH_CORRIDOR_ROUTE_IDS?.length) return allRoutes;
  const set = new Set(LAUNCH_CORRIDOR_ROUTE_IDS);
  const filtered = allRoutes.filter((r) => set.has(r.id));
  return filtered.length ? filtered : allRoutes;
}

export function isLaunchCorridorRoute(routeId) {
  if (!LAUNCH_CORRIDOR_ROUTE_IDS?.length) return true;
  return LAUNCH_CORRIDOR_ROUTE_IDS.includes(routeId);
}
