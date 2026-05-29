import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'mateCustomRoutesV1';
const MAX_RECENT = 8;

function makeId(origin, destination) {
  const slug = `${origin}__${destination}`.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  return `custom_${slug}`;
}

export async function getCustomRoutes() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function persist(list) {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

export async function saveCustomRoute({ origin, destination, fareGhs }) {
  if (!origin?.trim() || !destination?.trim()) return null;
  const trimmedOrigin = origin.trim();
  const trimmedDestination = destination.trim();
  const fare = Number.isFinite(Number(fareGhs)) && Number(fareGhs) > 0
    ? Number(fareGhs)
    : null;

  const id = makeId(trimmedOrigin, trimmedDestination);
  const entry = {
    id,
    origin: trimmedOrigin,
    destination: trimmedDestination,
    fareGhs: fare ?? 4,
    isCustom: true,
    savedAt: new Date().toISOString(),
  };

  const list = await getCustomRoutes();
  const next = [entry, ...list.filter((r) => r.id !== id)].slice(0, MAX_RECENT);
  await persist(next);
  return entry;
}

export async function removeCustomRoute(id) {
  const list = await getCustomRoutes();
  const next = list.filter((r) => r.id !== id);
  await persist(next);
  return next;
}

export async function clearCustomRoutes() {
  await AsyncStorage.removeItem(KEY);
}
