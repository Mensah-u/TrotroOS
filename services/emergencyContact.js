import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  NAME: 'emergencyContactName',
  PHONE: 'emergencyContactPhone',
  RELATION: 'emergencyContactRelation',
};

export const EMERGENCY_NUMBERS = [
  { label: 'Police', number: '191', icon: 'shield-outline' },
  { label: 'Ambulance', number: '193', icon: 'medkit-outline' },
  { label: 'Fire Service', number: '192', icon: 'flame-outline' },
  { label: 'National Emergency', number: '112', icon: 'call-outline' },
];

export async function getEmergencyContact() {
  try {
    const [[, name], [, phone], [, relation]] = await AsyncStorage.multiGet([
      KEYS.NAME,
      KEYS.PHONE,
      KEYS.RELATION,
    ]);
    return {
      name: name ?? '',
      phone: phone ?? '',
      relation: relation ?? '',
    };
  } catch {
    return { name: '', phone: '', relation: '' };
  }
}

export async function saveEmergencyContact({ name, phone, relation }) {
  await AsyncStorage.multiSet([
    [KEYS.NAME, name?.trim() ?? ''],
    [KEYS.PHONE, phone?.trim() ?? ''],
    [KEYS.RELATION, relation?.trim() ?? ''],
  ]);
}

export async function clearEmergencyContact() {
  await AsyncStorage.multiRemove(Object.values(KEYS));
}
