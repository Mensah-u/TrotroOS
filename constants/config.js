/**
 * Runtime configuration — values come from .env (gitignored) or EAS secrets.
 * Copy .env.example → .env and fill in your keys for local development.
 */

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** Restrict in Google Cloud Console to com.trotro.os + your release SHA-1. */
export const GOOGLE_MAPS_ANDROID_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY ?? '';

export const ETA_SERVICE_URL = process.env.EXPO_PUBLIC_ETA_SERVICE_URL ?? '';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

export const API_KEY = process.env.EXPO_PUBLIC_API_KEY ?? '';

export const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';

export function assertClientConfig() {
  const missing = [];
  if (!SUPABASE_URL) missing.push('EXPO_PUBLIC_SUPABASE_URL');
  if (!SUPABASE_ANON_KEY) missing.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  if (missing.length) {
    throw new Error(
      `Missing ${missing.join(', ')}. Copy .env.example to .env and add your Supabase credentials.`,
    );
  }
}
