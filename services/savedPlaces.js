import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'savedPlacesV1';

const DEFAULT_PLACES = [
  { id: 'home', kind: 'home', label: 'Home', name: '', icon: 'home-outline' },
  { id: 'work', kind: 'work', label: 'Work / School', name: '', icon: 'briefcase-outline' },
];

export async function getSavedPlaces() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [...DEFAULT_PLACES];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_PLACES];
    const hasHome = parsed.some((p) => p.kind === 'home');
    const hasWork = parsed.some((p) => p.kind === 'work');
    const merged = [
      ...(!hasHome ? [DEFAULT_PLACES[0]] : []),
      ...(!hasWork ? [DEFAULT_PLACES[1]] : []),
      ...parsed,
    ];
    return merged;
  } catch {
    return [...DEFAULT_PLACES];
  }
}

async function persist(list) {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

export async function updateSavedPlace(id, patch) {
  const list = await getSavedPlaces();
  const next = list.map((p) => (p.id === id ? { ...p, ...patch } : p));
  await persist(next);
  return next;
}

export async function addCustomPlace({ label, name }) {
  const list = await getSavedPlaces();
  const place = {
    id: `place_${Date.now()}`,
    kind: 'custom',
    label: label?.trim() || 'Saved place',
    name: name?.trim() || '',
    icon: 'bookmark-outline',
  };
  const next = [...list, place];
  await persist(next);
  return next;
}

export async function removeSavedPlace(id) {
  const list = await getSavedPlaces();
  const target = list.find((p) => p.id === id);
  if (!target || target.kind !== 'custom') return list;
  const next = list.filter((p) => p.id !== id);
  await persist(next);
  return next;
}

export async function clearSavedPlaces() {
  await AsyncStorage.removeItem(KEY);
}
