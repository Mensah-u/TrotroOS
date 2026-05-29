/**
 * Runtime configuration — public repo safe.
 * Keys load from (in order): EXPO_PUBLIC_* env vars, then gitignored config.secrets.js.
 * For local dev: copy config.secrets.example.js → config.secrets.js
 * For EAS builds: set EXPO_PUBLIC_* secrets in EAS.
 */

let localSecrets = {};
try {
  const mod = require('./config.secrets.js');
  localSecrets = mod.default ?? mod;
} catch {
  // config.secrets.js is optional until you copy the example file
}

function pick(envKey, secretKey) {
  const fromEnv = process.env[envKey];
  if (fromEnv?.trim()) return fromEnv.trim();
  const fromSecret = localSecrets[secretKey];
  if (fromSecret?.trim()) return fromSecret.trim();
  return '';
}

export const SUPABASE_URL = pick('EXPO_PUBLIC_SUPABASE_URL', 'SUPABASE_URL');

export const SUPABASE_ANON_KEY = pick('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY');

/** Restrict in Google Cloud Console to com.trotro.os + your release SHA-1. */
export const GOOGLE_MAPS_ANDROID_KEY = pick(
  'EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY',
  'GOOGLE_MAPS_ANDROID_KEY',
);

export const ETA_SERVICE_URL = pick('EXPO_PUBLIC_ETA_SERVICE_URL', 'ETA_SERVICE_URL');

export const API_BASE_URL = pick('EXPO_PUBLIC_API_BASE_URL', 'API_BASE_URL');

export const API_KEY = pick('EXPO_PUBLIC_API_KEY', 'API_KEY');

export const SENTRY_DSN = pick('EXPO_PUBLIC_SENTRY_DSN', 'SENTRY_DSN');

export function assertClientConfig() {
  const missing = [];
  if (!SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!SUPABASE_ANON_KEY) missing.push('SUPABASE_ANON_KEY');
  if (missing.length) {
    throw new Error(
      `Missing ${missing.join(', ')}. Copy constants/config.secrets.example.js to config.secrets.js or set EXPO_PUBLIC_* in .env.`,
    );
  }
}
