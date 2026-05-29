import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'recentTypedPlacesV1';
const MAX_RECENT = 6;

export async function getRecentPlaces() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function rememberRecentPlace(rawName) {
  const name = String(rawName ?? '').trim();
  if (!name) return [];
  try {
    const list = await getRecentPlaces();
    const deduped = list.filter((p) => p.toLowerCase() !== name.toLowerCase());
    const next = [name, ...deduped].slice(0, MAX_RECENT);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    return next;
  } catch {
    return [];
  }
}

export async function clearRecentPlaces() {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
