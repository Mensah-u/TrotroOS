import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'favoriteRoutesV1';

export async function getFavoriteRoutes() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function persist(list) {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

export async function toggleFavoriteRoute(routeId, label) {
  const list = await getFavoriteRoutes();
  const exists = list.find((r) => r.routeId === routeId);
  let next;
  if (exists) {
    next = list.filter((r) => r.routeId !== routeId);
  } else {
    next = [{ routeId, label, savedAt: new Date().toISOString() }, ...list];
  }
  await persist(next);
  return next;
}

export async function isFavoriteRoute(routeId) {
  const list = await getFavoriteRoutes();
  return list.some((r) => r.routeId === routeId);
}

export async function clearFavoriteRoutes() {
  await AsyncStorage.removeItem(KEY);
}
