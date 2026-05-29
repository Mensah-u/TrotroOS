import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import {
  getPassengerProfileRemote,
  upsertPassengerProfileRemote,
} from '@/services/supabase';

const KEYS = {
  DISPLAY_NAME:     'passengerDisplayName',
  PHONE:            'passengerPhone',
  NOTIFY_TRIPS:     'passengerNotifyTrips',
  NOTIFY_RESERVE:   'passengerNotifyReserve',
  NOTIFY_PROMO:     'passengerNotifyPromo',
  PRIVACY_LOCATION: 'passengerPrivacyLocation',
  PRIVACY_ANON:     'passengerPrivacyAnon',
  DEVICE_ID:        'deviceId',
  ACTIVE_RESERVATION: 'passengerActiveReservation',
};

const DEFAULTS = {
  displayName:    'Passenger',
  phone:          '',
  notifyTrips:    true,
  notifyReserve:  true,
  notifyPromo:    false,
  shareLocation:  true,
  anonymousMode:  true,
};

function fromLocal(map) {
  return {
    displayName:    map[KEYS.DISPLAY_NAME] ?? DEFAULTS.displayName,
    phone:          map[KEYS.PHONE] ?? DEFAULTS.phone,
    notifyTrips:    map[KEYS.NOTIFY_TRIPS] !== 'false',
    notifyReserve:  map[KEYS.NOTIFY_RESERVE] !== 'false',
    notifyPromo:    map[KEYS.NOTIFY_PROMO] === 'true',
    shareLocation:  map[KEYS.PRIVACY_LOCATION] !== 'false',
    anonymousMode:  map[KEYS.PRIVACY_ANON] !== 'false',
  };
}

function fromRemote(row) {
  if (!row) return null;
  return {
    displayName:    row.display_name ?? DEFAULTS.displayName,
    phone:          row.phone ?? '',
    notifyTrips:    row.notify_trips ?? DEFAULTS.notifyTrips,
    notifyReserve:  row.notify_reserve ?? DEFAULTS.notifyReserve,
    notifyPromo:    row.notify_promo ?? DEFAULTS.notifyPromo,
    shareLocation:  row.share_location ?? DEFAULTS.shareLocation,
    anonymousMode:  row.anonymous_mode ?? DEFAULTS.anonymousMode,
  };
}

async function readLocal() {
  const entries = await AsyncStorage.multiGet(Object.values(KEYS));
  return fromLocal(Object.fromEntries(entries));
}

async function writeLocal(profile) {
  await AsyncStorage.multiSet([
    [KEYS.DISPLAY_NAME, profile.displayName.trim()],
    [KEYS.PHONE, profile.phone.trim()],
    [KEYS.NOTIFY_TRIPS, String(profile.notifyTrips)],
    [KEYS.NOTIFY_RESERVE, String(profile.notifyReserve)],
    [KEYS.NOTIFY_PROMO, String(profile.notifyPromo)],
    [KEYS.PRIVACY_LOCATION, String(profile.shareLocation)],
    [KEYS.PRIVACY_ANON, String(profile.anonymousMode)],
  ]);
}

export async function getOrCreateDeviceId() {
  let id = await AsyncStorage.getItem(KEYS.DEVICE_ID);
  if (!id) {
    id = Crypto.randomUUID();
    await AsyncStorage.setItem(KEYS.DEVICE_ID, id);
  }
  return id;
}

/** Load profile: Supabase first, fallback to local AsyncStorage. */
export async function getPassengerProfile() {
  const local = await readLocal();
  try {
    const deviceId = await getOrCreateDeviceId();
    const { data, error } = await getPassengerProfileRemote(deviceId);
    if (error) return local;
    const remote = fromRemote(data);
    if (remote) {
      await writeLocal(remote);
      return remote;
    }
    // First visit — seed Supabase from local defaults
    await upsertPassengerProfileRemote(deviceId, local).catch(() => {});
    return local;
  } catch {
    return local;
  }
}

/** Save profile locally and sync to Supabase. */
export async function savePassengerProfile(patch) {
  const current = await readLocal();
  const next = { ...current, ...patch };
  await writeLocal(next);

  try {
    const deviceId = await getOrCreateDeviceId();
    const { error } = await upsertPassengerProfileRemote(deviceId, next);
    if (error) console.warn('[Profile] Supabase sync failed:', error.message);
  } catch (e) {
    console.warn('[Profile] Supabase sync failed:', e?.message);
  }

  return next;
}

export { KEYS as PASSENGER_PROFILE_KEYS };

export async function saveActiveReservationCache(payload) {
  await AsyncStorage.setItem(KEYS.ACTIVE_RESERVATION, JSON.stringify(payload));
}

export async function getActiveReservationCache() {
  const raw = await AsyncStorage.getItem(KEYS.ACTIVE_RESERVATION);
  return raw ? JSON.parse(raw) : null;
}

export async function clearActiveReservationCache() {
  await AsyncStorage.removeItem(KEYS.ACTIVE_RESERVATION);
}

/** Export local passenger data (GDPR-style device export). */
export async function exportPassengerLocalData() {
  const deviceId = await getOrCreateDeviceId();
  const profile = await readLocal();
  const reservation = await getActiveReservationCache();
  const entries = await AsyncStorage.multiGet(Object.values(KEYS));
  return {
    exportedAt: new Date().toISOString(),
    deviceId,
    profile,
    activeReservationCache: reservation,
    rawKeys: Object.fromEntries(entries),
  };
}

/** Clear non-essential local cache; keeps device ID and profile. */
export async function clearPassengerLocalCache() {
  await AsyncStorage.multiRemove([
    KEYS.ACTIVE_RESERVATION,
  ]);
}
