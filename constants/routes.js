/** Kumasi trotro routes with map anchors and default fares (GHS). */
import { tripMatchesRoute as matchRouteFlexible } from '../utils/routeMatching';

export const placeCoords = {
  'Tech Junction': { latitude: 6.678, longitude: -1.558 },
  'Ayeduase': { latitude: 6.682, longitude: -1.552 },
  'KNUST Campus': { latitude: 6.674, longitude: -1.571 },
  'Kejetia': { latitude: 6.690, longitude: -1.624 },
  'Bantama': { latitude: 6.695, longitude: -1.635 },
  'KNUST Gate': { latitude: 6.676, longitude: -1.568 },
  'Ayeduase Junction': { latitude: 6.680, longitude: -1.555 },
  // City anchors for intercity / custom routes
  Kumasi: { latitude: 6.688, longitude: -1.624 },
  Accra: { latitude: 5.603, longitude: -0.187 },
  KNUST: { latitude: 6.674, longitude: -1.571 },
  Suame: { latitude: 6.710, longitude: -1.625 },
  Tafo: { latitude: 6.718, longitude: -1.592 },
  Asafo: { latitude: 6.696, longitude: -1.628 },
  Adum: { latitude: 6.692, longitude: -1.621 },
  'Kumasi City': { latitude: 6.690, longitude: -1.624 },
};

/** Named pickup stops (stages) per route corridor. */
export const pickupStops = {
  '1': ['Tech Junction', 'Ayeduase Junction', 'Ayeduase'],
  '2': ['Tech Junction', 'KNUST Gate', 'KNUST Campus'],
  '3': ['Ayeduase', 'Ayeduase Junction', 'Tech Junction'],
  '4': ['Kejetia', 'Bantama', 'Ayeduase'],
  '5': ['Bantama', 'Tech Junction'],
  '6': ['KNUST Campus', 'KNUST Gate', 'Ayeduase'],
};

export const routes = [
  {
    id: '1',
    origin: 'Tech Junction',
    destination: 'Ayeduase',
    fareGhs: 4,
    mapCenter: { latitude: 6.678, longitude: -1.558 },
    pickupEta: { min: 4, max: 12 },
    tripEta: { min: 10, max: 18 },
  },
  {
    id: '2',
    origin: 'Tech Junction',
    destination: 'KNUST Campus',
    fareGhs: 3,
    mapCenter: { latitude: 6.674, longitude: -1.571 },
    pickupEta: { min: 3, max: 10 },
    tripEta: { min: 8, max: 15 },
  },
  {
    id: '3',
    origin: 'Ayeduase',
    destination: 'Tech Junction',
    fareGhs: 4,
    mapCenter: { latitude: 6.682, longitude: -1.552 },
    pickupEta: { min: 5, max: 14 },
    tripEta: { min: 10, max: 20 },
  },
  {
    id: '4',
    origin: 'Kejetia',
    destination: 'Ayeduase',
    fareGhs: 6,
    mapCenter: { latitude: 6.690, longitude: -1.624 },
    pickupEta: { min: 8, max: 20 },
    tripEta: { min: 25, max: 40 },
  },
  {
    id: '5',
    origin: 'Bantama',
    destination: 'Tech Junction',
    fareGhs: 5,
    mapCenter: { latitude: 6.695, longitude: -1.635 },
    pickupEta: { min: 6, max: 16 },
    tripEta: { min: 18, max: 30 },
  },
  {
    id: '6',
    origin: 'KNUST Campus',
    destination: 'Ayeduase',
    fareGhs: 3,
    mapCenter: { latitude: 6.676, longitude: -1.565 },
    pickupEta: { min: 4, max: 11 },
    tripEta: { min: 9, max: 16 },
  },
];

export const DEFAULT_MAP_REGION = {
  latitude: 6.673,
  longitude: -1.565,
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
};

export function formatRoute(route) {
  if (!route) return '';
  if (typeof route === 'string') return route;
  return `${route.origin} → ${route.destination}`;
}

export function findRouteById(id) {
  return routes.find((r) => r.id === id) ?? null;
}

export function findRouteIdByLabel(label) {
  if (!label) return null;
  const normalized = label.trim().toLowerCase();
  const exact = routes.find((r) => formatRoute(r).toLowerCase() === normalized);
  if (exact) return exact.id;
  const partial = routes.find(
    (r) =>
      normalized.includes(r.destination.toLowerCase()) ||
      normalized.includes(r.origin.toLowerCase()) ||
      normalized.includes(formatRoute(r).toLowerCase()),
  );
  return partial?.id ?? null;
}

export function getRouteFare(route) {
  if (!route) return 4;
  return route.fareGhs ?? 4;
}

/** All unique place names across Kumasi routes. */
export function getAllPlaces() {
  const set = new Set();
  for (const r of routes) {
    set.add(r.origin);
    set.add(r.destination);
  }
  return Array.from(set).sort();
}

/** Origins that appear in at least one route. */
export function getOrigins() {
  return [...new Set(routes.map((r) => r.origin))].sort();
}

/** Valid destinations when leaving from `origin`. */
export function getDestinationsForOrigin(origin) {
  if (!origin) return getAllPlaces();
  return routes.filter((r) => r.origin === origin).map((r) => r.destination);
}

export function findRouteByPlaces(origin, destination) {
  if (!origin || !destination) return null;
  return routes.find(
    (r) => r.origin === origin && r.destination === destination,
  ) ?? null;
}

export function getPlaceCoords(place) {
  if (!place) return null;
  return placeCoords[place] ?? null;
}

function normalizePlaceKey(place) {
  return String(place ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '');
}

/** Resolve map coords for typed or fuzzy place names (e.g. KNUST → campus). */
export function resolvePlaceCoords(place) {
  if (!place) return null;

  const direct = getPlaceCoords(place);
  if (direct) return direct;

  const needle = normalizePlaceKey(place);
  if (!needle) return null;

  for (const [name, coords] of Object.entries(placeCoords)) {
    if (normalizePlaceKey(name) === needle) return coords;
  }

  let best = null;
  let bestScore = 0;
  for (const [name, coords] of Object.entries(placeCoords)) {
    const key = normalizePlaceKey(name);
    if (needle.includes(key) || key.includes(needle)) {
      const score = Math.min(needle.length, key.length);
      if (score > bestScore) {
        best = coords;
        bestScore = score;
      }
    }
  }
  return best;
}

/** Pickup stops for a route id or origin→destination pair. */
export function getPickupStopsForRoute(routeOrId) {
  if (!routeOrId) return [];
  const id = typeof routeOrId === 'string' ? routeOrId : routeOrId.id;
  if (pickupStops[id]) return pickupStops[id];
  const route = typeof routeOrId === 'object' ? routeOrId : findRouteById(id);
  if (!route) return [];
  return [route.origin, route.destination].filter(Boolean);
}

export function getAllPickupStops() {
  return [...new Set(Object.values(pickupStops).flat())].sort();
}

/** Historical ETA averages per route id (minutes). */
export const historicalEta = {
  '1': { pickup: { min: 4, max: 12 }, trip: { min: 10, max: 18 } },
  '2': { pickup: { min: 3, max: 10 }, trip: { min: 8, max: 15 } },
  '3': { pickup: { min: 5, max: 14 }, trip: { min: 10, max: 20 } },
  '4': { pickup: { min: 8, max: 20 }, trip: { min: 25, max: 40 } },
  '5': { pickup: { min: 6, max: 16 }, trip: { min: 18, max: 30 } },
  '6': { pickup: { min: 4, max: 11 }, trip: { min: 9, max: 16 } },
};

export function getHistoricalEta(routeId) {
  return historicalEta[routeId] ?? { pickup: { min: 5, max: 15 }, trip: { min: 12, max: 25 } };
}

export function tripMatchesRoute(trip, origin, destination) {
  return matchRouteFlexible(trip, origin, destination);
}

/** Quick-pick popular routes for the planner. */
export const popularRoutes = routes.slice(0, 4);
