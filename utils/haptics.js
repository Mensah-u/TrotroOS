import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { getAppPreferences } from '@/services/appPreferences';

let hapticsEnabled = true;

getAppPreferences()
  .then((p) => { hapticsEnabled = p.haptics !== false; })
  .catch(() => {});

export async function refreshHapticsPreference() {
  const p = await getAppPreferences();
  hapticsEnabled = p.haptics !== false;
}

function run(fn) {
  if (Platform.OS === 'web' || !hapticsEnabled) return;
  fn().catch(() => {});
}

export function hapticLight() {
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

export function hapticMedium() {
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

export function hapticSuccess() {
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

export function hapticSelect() {
  run(() => Haptics.selectionAsync());
}
