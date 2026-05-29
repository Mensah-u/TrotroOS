import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  removeFavoriteRouteRemote,
  syncFavoriteRouteRemote,
} from '@/services/featuresV14';
import { getOrCreateDeviceId } from '@/services/passengerProfile';

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
    getOrCreateDeviceId()
      .then((id) => removeFavoriteRouteRemote(id, routeId))
      .catch(() => {});
  } else {
    next = [{ routeId, label, savedAt: new Date().toISOString() }, ...list];
    getOrCreateDeviceId()
      .then((id) => syncFavoriteRouteRemote({ passengerId: id, routeId, routeLabel: label }))
      .catch(() => {});
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

/** Default favorite for quick-open (most recent star). */
export async function getDefaultFavoriteRoute() {
  const list = await getFavoriteRoutes();
  return list[0] ?? null;
}
