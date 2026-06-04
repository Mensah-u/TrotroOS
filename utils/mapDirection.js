/** Geographic bearing and helpers for map direction arrows. */

export function bearingDegrees(from, to) {
  if (!from?.latitude || !to?.latitude) return 0;

  const lat1 = (from.latitude * Math.PI) / 180;
  const lat2 = (to.latitude * Math.PI) / 180;
  const dLon = ((to.longitude - from.longitude) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

/** Point `fraction` (0–1) along the straight line from → to. */
export function pointAlongRoute(from, to, fraction = 0.62) {
  if (!from?.latitude || !to?.latitude) return null;
  const t = Math.min(1, Math.max(0, fraction));
  return {
    latitude: from.latitude + (to.latitude - from.latitude) * t,
    longitude: from.longitude + (to.longitude - from.longitude) * t,
  };
}

export function hasRouteDirection(from, to) {
  if (!from?.latitude || !to?.latitude) return false;
  const dLat = Math.abs(from.latitude - to.latitude);
  const dLng = Math.abs(from.longitude - to.longitude);
  return dLat + dLng > 0.00005;
}
