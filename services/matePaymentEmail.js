import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/services/supabase';

const STORAGE_KEY = '@trotro/mate_payment_email';

export function isValidMatePaymentEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email ?? '').trim());
}

/** Prefer saved MoMo email, then mate auth email. */
export async function getMatePaymentEmail() {
  const saved = (await AsyncStorage.getItem(STORAGE_KEY))?.trim();
  if (isValidMatePaymentEmail(saved)) return saved.toLowerCase();

  const { data } = await supabase.auth.getUser();
  const authEmail = data?.user?.email?.trim();
  if (isValidMatePaymentEmail(authEmail)) return authEmail.toLowerCase();

  return '';
}

export async function saveMatePaymentEmail(email) {
  const trimmed = email?.trim().toLowerCase();
  if (!isValidMatePaymentEmail(trimmed)) return false;
  await AsyncStorage.setItem(STORAGE_KEY, trimmed);
  return true;
}
