/**
 * TrotroOS push notification registration + helpers.
 *
 * Push is only available in device builds (EAS / APK), NOT Expo Go.
 * All calls silently no-op in Expo Go / web.
 */
import { Platform } from 'react-native';

import { registerPushNotifications } from '@/services/notifications';
import { supabase } from '@/services/supabase';

let _registered = false;

/**
 * Call once after the user session is established (App.js phase === 'app').
 * Safe to call multiple times — skips if already registered this session.
 */
export async function autoRegisterPush({ userId, userRole }) {
  if (_registered || !userId || Platform.OS === 'web') return;
  _registered = true;
  try {
    await registerPushNotifications({ userId, userRole });
  } catch {
    // never crash the app for push failures
  }
}

export function resetPushRegistration() {
  _registered = false;
}

/**
 * Send a push notification to any user via the send-push Edge Function.
 * Only works from the server side (or Edge Function context).
 * On the client, use scheduleLocalNotification for local alerts instead.
 */
export async function sendPushToUser({ recipientId, title, body, data = {} }) {
  try {
    const { error } = await supabase.functions.invoke('send-push', {
      body: { recipientId, title, body, data },
    });
    if (error) {
      if (__DEV__) console.warn('[push] send-push failed:', error.message);
    }
  } catch (e) {
    if (__DEV__) console.warn('[push] sendPushToUser threw:', e?.message);
  }
}

/** Schedule a local notification (works in Expo Go too via built-in alert). */
export async function scheduleLocalNotification(title, body, secondsFromNow = 5) {
  try {
    const { scheduleLocalReminder } = await import('@/services/notifications');
    await scheduleLocalReminder(title, body, secondsFromNow);
  } catch {
    // no-op if notifications unavailable
  }
}
