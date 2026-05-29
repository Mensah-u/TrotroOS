import AsyncStorage from '@react-native-async-storage/async-storage';

export const ROLES = {
  MATE: 'mate',
  PASSENGER: 'passenger',
};

const ROLE_KEY = 'trotroos_app_role';
const PASSENGER_ONBOARDED_KEY = 'trotroos_passenger_onboarded';

export async function getAppRole() {
  const role = await AsyncStorage.getItem(ROLE_KEY);
  return role === ROLES.MATE || role === ROLES.PASSENGER ? role : null;
}

export async function setAppRole(role) {
  await AsyncStorage.setItem(ROLE_KEY, role);
}

export async function clearAppRole() {
  await AsyncStorage.multiRemove([ROLE_KEY, PASSENGER_ONBOARDED_KEY]);
}

export async function isPassengerOnboarded() {
  return (await AsyncStorage.getItem(PASSENGER_ONBOARDED_KEY)) === 'true';
}

export async function setPassengerOnboarded(value) {
  await AsyncStorage.setItem(PASSENGER_ONBOARDED_KEY, value ? 'true' : 'false');
}
