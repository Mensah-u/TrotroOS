/** Build per-route waiting counts from passenger_locations rows. */

const DEMAND_FRESH_MS = 20 * 60 * 1000;

export function shortenRouteLabel(label, maxLen = 24) {
  if (!label) return '';
  const t = label.replace(/\s*→\s*/g, ' → ').trim();
  return t.length > maxLen ? `${t.slice(0, maxLen - 1)}…` : t;
}

/**
 * @param {Array<{ queued_route?: string | null, updated_at?: string }>} locs
 * @returns {Record<string, number>}
 */
export function buildDemandFromLocations(locs) {
  const counts = {};
  const now = Date.now();
  for (const p of locs ?? []) {
    const route = p.queued_route?.trim();
    if (!route) continue;
    if (p.updated_at) {
      const age = now - new Date(p.updated_at).getTime();
      if (age > DEMAND_FRESH_MS) continue;
    }
    counts[route] = (counts[route] ?? 0) + 1;
  }
  return counts;
}

export function totalDemandCount(demand) {
  return Object.values(demand ?? {}).reduce((a, b) => a + b, 0);
}

export function topDemandRoute(demand) {
  const entries = Object.entries(demand ?? {}).sort((a, b) => b[1] - a[1]);
  return entries[0] ?? null;
}
