import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const QUEUE_KEY = 'trotroos_offline_queue_v1';
const MAX_QUEUE = 50;

/** Persist an action when network/Supabase fails; flush on next app boot or manual retry. */
export async function enqueueOfflineAction(action) {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    list.push({ ...action, queuedAt: new Date().toISOString() });
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(list.slice(-MAX_QUEUE)));
    return true;
  } catch {
    return false;
  }
}

export async function getOfflineQueue() {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function clearOfflineQueue() {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

/** Run queued handlers; remove successful items. */
export async function flushOfflineQueue(handlers) {
  const queue = await getOfflineQueue();
  if (!queue.length) return { flushed: 0, remaining: 0 };

  const remaining = [];
  let flushed = 0;
  for (const item of queue) {
    const fn = handlers[item.type];
    if (!fn) {
      remaining.push(item);
      continue;
    }
    try {
      const ok = await fn(item.payload);
      if (ok) flushed += 1;
      else remaining.push(item);
    } catch {
      remaining.push(item);
    }
  }
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  return { flushed, remaining: remaining.length };
}

export function isLikelyOfflineError(error) {
  const msg = (error?.message ?? String(error ?? '')).toLowerCase();
  return (
    msg.includes('network') ||
    msg.includes('fetch') ||
    msg.includes('timeout') ||
    msg.includes('failed to fetch')
  );
}

export const offlineMeta = {
  platform: Platform.OS,
};
