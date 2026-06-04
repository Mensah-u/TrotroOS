/** No-op stub — Metro aliases expo-notifications here during Expo Go / local dev. */

module.exports = {
  setNotificationHandler: () => {},
  getPermissionsAsync: async () => ({ status: 'denied' }),
  requestPermissionsAsync: async () => ({ status: 'denied' }),
  getExpoPushTokenAsync: async () => ({ data: null }),
  scheduleNotificationAsync: async () => null,
};
