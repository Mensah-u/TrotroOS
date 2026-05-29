import * as Location from 'expo-location';

import { getAllPlaces, getPlaceCoords } from '@/constants/routes';

/**
 * Try to resolve a friendly Kumasi place name for given coords.
 * 1. Snap to the nearest known place if it's within ~600m.
 * 2. Else use expo's reverse geocoding (street, district, city).
 */
async function resolveLabel({ latitude, longitude }) {
  const snap = nearestKnownPlace({ latitude, longitude });
  if (snap) return snap.name;

  try {
    const results = await Location.reverseGeocodeAsync({ latitude, longitude });
    const r = results?.[0];
    if (r) {
      const parts = [
        r.name && !/^\d+$/.test(r.name) ? r.name : null,
        r.street,
        r.district ?? r.subregion,
        r.city,
      ]
        .filter(Boolean)
        .filter((v, i, a) => a.indexOf(v) === i);
      if (parts.length) return parts.slice(0, 2).join(', ');
    }
  } catch {
    // ignore reverse geocode failure
  }
  return `My location (${latitude.toFixed(3)}, ${longitude.toFixed(3)})`;
}

function nearestKnownPlace({ latitude, longitude }, maxKm = 0.6) {
  let best = null;
  let bestKm = Infinity;
  for (const name of getAllPlaces()) {
    const coords = getPlaceCoords(name);
    if (!coords) continue;
    const km = haversineKm({ latitude, longitude }, coords);
    if (km < bestKm) {
      best = { name, coords, km };
      bestKm = km;
    }
  }
  if (best && best.km <= maxKm) return best;
  return null;
}

function haversineKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Returns: { ok, label, coords, error }
 * - ok=true means we have a friendly label the caller can drop into From/To.
 */
export async function getMyLocationLabel({ existingCoords } = {}) {
  try {
    let coords = existingCoords;
    if (!coords) {
      const perm = await Location.getForegroundPermissionsAsync();
      let status = perm.status;
      if (status !== 'granted') {
        const ask = await Location.requestForegroundPermissionsAsync();
        status = ask.status;
      }
      if (status !== 'granted') {
        return { ok: false, error: 'Location permission denied' };
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    }

    const label = await resolveLabel(coords);
    return { ok: true, label, coords };
  } catch (e) {
    return { ok: false, error: e?.message ?? 'Could not get your location' };
  }
}

export { nearestKnownPlace };
