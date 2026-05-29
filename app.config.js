/** @type {import('expo/config').ExpoConfig} */
const base = require('./app.json');

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

module.exports = () => ({
  ...base.expo,
  extra: {
    ...base.expo.extra,
    supabaseUrl: pick('EXPO_PUBLIC_SUPABASE_URL', secrets, 'SUPABASE_URL'),
    supabaseAnonKey: pick('EXPO_PUBLIC_SUPABASE_ANON_KEY', secrets, 'SUPABASE_ANON_KEY'),
    googleMapsAndroidKey: pick(
      'EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY',
      secrets,
      'GOOGLE_MAPS_ANDROID_KEY',
    ),
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
