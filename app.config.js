/** @type {import('expo/config').ExpoConfig} */
const base = require('./app.json');

const DEFAULT_PRIVACY_POLICY_URL = 'https://trotroos.com/privacy';
const SENTRY_ORG = 'trotroos';
const SENTRY_PROJECT = 'react-native';

function loadLocalSecrets() {
  try {
    const mod = require('./constants/config.secrets.js');
    return mod.default ?? mod;
  } catch {
    return {};
  }
}

function pick(envKey, secrets, secretKey) {
  const fromEnv = process.env[envKey]?.trim();
  if (fromEnv) return fromEnv;
  const fromSecrets = secrets[secretKey]?.trim();
  return fromSecrets ?? '';
}

const secrets = loadLocalSecrets();
const sentryDsn = pick('EXPO_PUBLIC_SENTRY_DSN', secrets, 'SENTRY_DSN');

/** Push plugin is for EAS builds only — it triggers a hard ERROR in Expo Go (SDK 53+). */
const isEasBuild = process.env.EAS_BUILD === 'true';

const plugins = (base.expo.plugins ?? []).filter((entry) => {
  const name = Array.isArray(entry) ? entry[0] : entry;
  if (name === 'expo-notifications' && !isEasBuild) return false;
  return true;
});

/** Source maps + debug symbols upload on EAS (requires SENTRY_AUTH_TOKEN in EAS secrets). */
if (isEasBuild && sentryDsn) {
  plugins.push([
    '@sentry/react-native/expo',
    {
      url: 'https://sentry.io/',
      organization: process.env.SENTRY_ORG || SENTRY_ORG,
      project: process.env.SENTRY_PROJECT || SENTRY_PROJECT,
    },
  ]);
}

module.exports = () => ({
  ...base.expo,
  plugins,
  extra: {
    ...base.expo.extra,
    supabaseUrl: pick('EXPO_PUBLIC_SUPABASE_URL', secrets, 'SUPABASE_URL'),
    supabaseAnonKey: pick('EXPO_PUBLIC_SUPABASE_ANON_KEY', secrets, 'SUPABASE_ANON_KEY'),
    googleMapsAndroidKey: pick(
      'EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY',
      secrets,
      'GOOGLE_MAPS_ANDROID_KEY',
    ),
    googleMapsWebKey: pick(
      'EXPO_PUBLIC_GOOGLE_MAPS_WEB_KEY',
      secrets,
      'GOOGLE_MAPS_WEB_KEY',
    ),
    privacyPolicyUrl:
      pick('EXPO_PUBLIC_PRIVACY_POLICY_URL', secrets, 'PRIVACY_POLICY_URL')
      || DEFAULT_PRIVACY_POLICY_URL,
    sentryDsn,
    apiBaseUrl: pick('EXPO_PUBLIC_API_BASE_URL', secrets, 'API_BASE_URL'),
    apiKey: pick('EXPO_PUBLIC_API_KEY', secrets, 'API_KEY'),
  },
  android: {
    ...base.expo.android,
    config: {
      ...base.expo.android?.config,
      googleMaps: {
        apiKey: pick('EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY', secrets, 'GOOGLE_MAPS_ANDROID_KEY'),
      },
    },
  },
});
