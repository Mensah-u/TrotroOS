import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'mateEarningsTotal';
const LOG_KEY = 'mateEarningsLog';

export async function getMateEarningsTotal() {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? Number(raw) : 0;
}

export async function recordTripEarnings({ amountGhs, route, passengers }) {
  if (!amountGhs || amountGhs <= 0) return getMateEarningsTotal();

  const prev = await getMateEarningsTotal();
  const next = prev + amountGhs;
  await AsyncStorage.setItem(KEY, String(next));

  const logRaw = await AsyncStorage.getItem(LOG_KEY);
  const log = logRaw ? JSON.parse(logRaw) : [];
  log.unshift({
    amountGhs,
    route,
    passengers,
    at: new Date().toISOString(),
  });
  await AsyncStorage.setItem(LOG_KEY, JSON.stringify(log.slice(0, 50)));
  return next;
}

export async function getMateEarningsLog() {
  const logRaw = await AsyncStorage.getItem(LOG_KEY);
  return logRaw ? JSON.parse(logRaw) : [];
}
