import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  ID_CARD: 'mateVerifyIdCard',
  LICENSE: 'mateVerifyLicense',
  VEHICLE_DOC: 'mateVerifyVehicleDoc',
  PHONE_VERIFIED: 'mateVerifyPhone',
};

export const VERIFICATION_STEPS = [
  {
    id: 'phone',
    label: 'Phone number',
    description: 'Confirm the mobile number on your profile.',
    icon: 'call-outline',
    key: KEYS.PHONE_VERIFIED,
  },
  {
    id: 'id',
    label: 'Government ID',
    description: 'Ghana Card or other valid national ID.',
    icon: 'card-outline',
    key: KEYS.ID_CARD,
  },
  {
    id: 'license',
    label: 'Driver license',
    description: 'Valid Ghanaian commercial driver license.',
    icon: 'document-outline',
    key: KEYS.LICENSE,
  },
  {
    id: 'vehicle',
    label: 'Vehicle documents',
    description: 'DVLA registration and insurance.',
    icon: 'car-outline',
    key: KEYS.VEHICLE_DOC,
  },
];

export async function getMateVerification() {
  try {
    const entries = await AsyncStorage.multiGet(Object.values(KEYS));
    const map = Object.fromEntries(entries);
    return {
      phone: map[KEYS.PHONE_VERIFIED] === 'true',
      id: map[KEYS.ID_CARD] === 'true',
      license: map[KEYS.LICENSE] === 'true',
      vehicle: map[KEYS.VEHICLE_DOC] === 'true',
    };
  } catch {
    return { phone: false, id: false, license: false, vehicle: false };
  }
}

export async function markVerificationStep(stepId, value) {
  const step = VERIFICATION_STEPS.find((s) => s.id === stepId);
  if (!step) return;
  await AsyncStorage.setItem(step.key, String(!!value));
}

export function computeVerificationLevel(state) {
  const total = VERIFICATION_STEPS.length;
  const done = Object.values(state ?? {}).filter(Boolean).length;
  if (done === 0) return { level: 'unverified', label: 'Unverified', done, total };
  if (done < total) return { level: 'partial', label: `${done}/${total} verified`, done, total };
  return { level: 'verified', label: 'Verified mate', done, total };
}
