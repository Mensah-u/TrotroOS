/**
 * Runtime configuration. Prefer EXPO_PUBLIC_* env vars in EAS builds.
 * See docs/PLAY_STORE.md and server/api/.env.example.
 */

export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://siwzjxwholmoassrdtwx.supabase.co';

export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpd3pqeHdob2xtb2Fzc3JkdHd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MTYxMzIsImV4cCI6MjA5NTM5MjEzMn0.GNTD-6U69gFCh6cKI0HjETH35sb9g3vxJfKlTI1RfKY';

/** Restrict this key to com.trotro.os + release SHA-1 in Google Cloud Console. */
export const GOOGLE_MAPS_ANDROID_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY ??
  'AIzaSyB2ikuzHxXpKO3KeTXsLYP6yiZUyUauf0s';

/** Optional ETA cache service — see server/eta-service/README.md */
export const ETA_SERVICE_URL = process.env.EXPO_PUBLIC_ETA_SERVICE_URL ?? '';

/** Optional backend API — see server/api/README.md */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

/** Gate for server/api routes — set APP_API_KEY on the server. */
export const API_KEY = process.env.EXPO_PUBLIC_API_KEY ?? '';

/** Optional Sentry DSN — see services/monitoring.js */
export const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';
