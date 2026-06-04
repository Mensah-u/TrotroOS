import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'passengerPaymentEmail';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidPaymentEmail(email) {
  return EMAIL_RE.test(String(email ?? '').trim().toLowerCase());
}

export async function getPaymentEmail() {
  const raw = await AsyncStorage.getItem(KEY);
  const email = raw?.trim().toLowerCase() ?? '';
  return isValidPaymentEmail(email) ? email : '';
}

export async function savePaymentEmail(email) {
  const normalized = String(email ?? '').trim().toLowerCase();
  if (!isValidPaymentEmail(normalized)) {
    return { ok: false, error: 'Enter a valid email for Paystack receipts' };
  }
  await AsyncStorage.setItem(KEY, normalized);
  return { ok: true, email: normalized };
}
