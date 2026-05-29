/** App-wide contact, version, and legal copy. */
export const APP_NAME = 'TrotroOS';
export const APP_VERSION = '1.3.0';
export const APP_TAGLINE = 'Real-time trotro seats for Kumasi';
export const APP_CITY = 'Kumasi, Ghana';

export const SUPPORT_PHONE = '+233256238825';
export const SUPPORT_PHONE_DISPLAY = '+233 25 623 8825';
export const SUPPORT_EMAIL = 'support@trotroos.com';
export const FEEDBACK_EMAIL = 'feedback@trotroos.com';

export const SUPPORT_HOURS = 'Mon–Sat · 7:00 AM – 9:00 PM GMT';

/**
 * Public HTTPS URL for Google Play Console (required before submission).
 * Set EXPO_PUBLIC_PRIVACY_POLICY_URL in EAS secrets or .env when hosting
 * docs/PRIVACY_POLICY.md (e.g. GitHub Pages, trotroos.com/privacy).
 */
export const PRIVACY_POLICY_URL =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_PRIVACY_POLICY_URL) || '';
