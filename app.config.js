/** @type {import('expo/config').ExpoConfig} */

const DEFAULT_PRIVACY_POLICY_URL = 'https://trotroos.com/privacy';
const SENTRY_ORG = 'trotroos';
const SENTRY_PROJECT = 'react-native';
const EAS_PROJECT_ID = 'e5b35d55-67bc-4136-b257-1d9886669ad8';

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

/** Push + notifications plugins are EAS-only — they crash Expo Go (SDK 53+). */
const isEasBuild = process.env.EAS_BUILD === 'true';

const basePlugins = [
  [
    'expo-splash-screen',
    {
      image: './assets/images/splash-icon.png',
      imageWidth: 200,
      resizeMode: 'contain',
      backgroundColor: '#121212',
      dark: { backgroundColor: '#121212' },
    },
  ],
  [
    'expo-location',
    {
      locationWhenInUsePermission:
        'TrotroOS uses your location only while the app is open, so mates can see where to pick you up and you can see nearby vehicles in real time.',
      isAndroidBackgroundLocationEnabled: false,
      isIosBackgroundLocationEnabled: false,
    },
  ],
  'expo-font',
];

if (isEasBuild) {
  basePlugins.push([
    'expo-notifications',
    {
      icon: './assets/images/icon.png',
      color: '#F36F21',
    },
  ]);
}

if (isEasBuild && sentryDsn) {
  basePlugins.push([
    '@sentry/react-native/expo',
    {
      url: 'https://sentry.io/',
      organization: process.env.SENTRY_ORG || SENTRY_ORG,
      project: process.env.SENTRY_PROJECT || SENTRY_PROJECT,
    },
  ]);
}

module.exports = () => ({
  name: 'TrotroOS',
  slug: 'TrotroOSv2',
  version: '1.5.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'trotrops',
  userInterfaceStyle: 'dark',
  newArchEnabled: true,

  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.trotro.os',
  },

  android: {
    package: 'com.trotro.os',
    versionCode: 9,
    adaptiveIcon: {
      backgroundColor: '#121212',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    edgeToEdgeEnabled: false,
    predictiveBackGestureEnabled: false,
    permissions: [
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.INTERNET',
      'android.permission.ACCESS_NETWORK_STATE',
    ],
    blockedPermissions: [
      'android.permission.ACCESS_BACKGROUND_LOCATION',
      'android.permission.FOREGROUND_SERVICE',
    ],
    config: {
      googleMaps: {
        apiKey: pick('EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY', secrets, 'GOOGLE_MAPS_ANDROID_KEY'),
      },
    },
  },

  web: {
    output: 'single',
    favicon: './assets/images/favicon.png',
    name: 'TrotroOS',
    themeColor: '#121212',
    backgroundColor: '#121212',
  },

  plugins: basePlugins,

  experiments: {},

  owner: 'mensah-u',

  extra: {
    eas: { projectId: EAS_PROJECT_ID },
    supabaseUrl:     pick('EXPO_PUBLIC_SUPABASE_URL',      secrets, 'SUPABASE_URL'),
    supabaseAnonKey: pick('EXPO_PUBLIC_SUPABASE_ANON_KEY', secrets, 'SUPABASE_ANON_KEY'),
    googleMapsAndroidKey: pick('EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY', secrets, 'GOOGLE_MAPS_ANDROID_KEY'),
    googleMapsWebKey:     pick('EXPO_PUBLIC_GOOGLE_MAPS_WEB_KEY',     secrets, 'GOOGLE_MAPS_WEB_KEY'),
    privacyPolicyUrl:
      pick('EXPO_PUBLIC_PRIVACY_POLICY_URL', secrets, 'PRIVACY_POLICY_URL') || DEFAULT_PRIVACY_POLICY_URL,
    sentryDsn,
    apiBaseUrl: pick('EXPO_PUBLIC_API_BASE_URL', secrets, 'API_BASE_URL'),
    apiKey:     pick('EXPO_PUBLIC_API_KEY',      secrets, 'API_KEY'),
    paymentsEnabled:
      pick('EXPO_PUBLIC_PAYMENTS_ENABLED', secrets, 'PAYMENTS_ENABLED') || 'true',
  },
});
