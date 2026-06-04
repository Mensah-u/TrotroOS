import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import { upsertPushToken } from '@/services/featuresV14';

/** Remote push was removed from Expo Go in SDK 53 — never load the native module there. */
const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient
  || Constants.appOwnership === 'expo';

let Notifications = null;
if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');
  } catch {
    Notifications = null;
  }
}

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export function isPushAvailable() {
  return !isExpoGo && Boolean(Notifications) && Platform.OS !== 'web';
}

/** Request permission and register Expo push token with Supabase. */
export async function registerPushNotifications({ userId, userRole }) {
  if (!isPushAvailable() || !userId) {
    return { ok: false, reason: 'unavailable' };
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    return { ok: false, reason: 'denied' };
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  const tokenData = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );
  const token = tokenData?.data;
  if (!token) return { ok: false, reason: 'no_token' };

  await upsertPushToken({
    userId,
    userRole,
    expoPushToken: token,
    platform: Platform.OS,
  });

  return { ok: true, token };
}

export async function scheduleLocalReminder(title, body, secondsFromNow = 60) {
  if (!Notifications) return null;
  return Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: { seconds: Math.max(5, secondsFromNow) },
  });
}
