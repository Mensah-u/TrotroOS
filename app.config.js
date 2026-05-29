/** @type {import('expo/config').ExpoConfig} */
const base = require('./app.json');

module.exports = () => ({
  ...base.expo,
  android: {
    ...base.expo.android,
    config: {
      ...base.expo.android?.config,
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY ?? '',
      },
    },
  },
});
