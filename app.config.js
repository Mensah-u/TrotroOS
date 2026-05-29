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

function mapsKey() {
  const fromEnv = process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY?.trim();
  if (fromEnv) return fromEnv;
  const secrets = loadLocalSecrets();
  return secrets.GOOGLE_MAPS_ANDROID_KEY?.trim() ?? '';
}

module.exports = () => ({
  ...base.expo,
  android: {
    ...base.expo.android,
    config: {
      ...base.expo.android?.config,
      googleMaps: {
        apiKey: mapsKey(),
      },
    },
  },
});
