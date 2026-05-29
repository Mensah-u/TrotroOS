import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  NOTIFY_TRIPS: 'mateNotifyTrips',
  NOTIFY_RESERVE: 'mateNotifyReserve',
  NOTIFY_EARN: 'mateNotifyEarn',
  SHARE_LOCATION: 'mateShareLocation',
  SHOW_PLATE: 'mateShowPlate',
};

const DEFAULTS = {
  notifyTrips: true,
  notifyReserve: true,
  notifyEarn: true,
  shareLocation: true,
  showPlate: true,
};

async function read() {
  const entries = await AsyncStorage.multiGet(Object.values(KEYS));
  const map = Object.fromEntries(entries);
  return {
    notifyTrips: map[KEYS.NOTIFY_TRIPS] !== 'false',
    notifyReserve: map[KEYS.NOTIFY_RESERVE] !== 'false',
    notifyEarn: map[KEYS.NOTIFY_EARN] !== 'false',
    shareLocation: map[KEYS.SHARE_LOCATION] !== 'false',
    showPlate: map[KEYS.SHOW_PLATE] !== 'false',
  };
}

export async function getMateSettings() {
  try {
    return await read();
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveMateSettings(patch) {
  const current = await getMateSettings();
  const next = { ...current, ...patch };
  await AsyncStorage.multiSet([
    [KEYS.NOTIFY_TRIPS, String(next.notifyTrips)],
    [KEYS.NOTIFY_RESERVE, String(next.notifyReserve)],
    [KEYS.NOTIFY_EARN, String(next.notifyEarn)],
    [KEYS.SHARE_LOCATION, String(next.shareLocation)],
    [KEYS.SHOW_PLATE, String(next.showPlate)],
  ]);
  return next;
}
