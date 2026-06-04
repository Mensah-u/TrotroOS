import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  fetchVerificationDocs,
  submitVerificationDoc,
} from '@/services/featuresV14';
import { getCurrentMate } from '@/services/supabase';

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

const DOC_MAP = { phone: 'phone', id: 'id', license: 'license', vehicle: 'vehicle' };

export async function getMateVerification() {
  try {
    const entries = await AsyncStorage.multiGet(Object.values(KEYS));
    const map = Object.fromEntries(entries);
    const local = {
      phone: map[KEYS.PHONE_VERIFIED] === 'true',
      id: map[KEYS.ID_CARD] === 'true',
      license: map[KEYS.LICENSE] === 'true',
      vehicle: map[KEYS.VEHICLE_DOC] === 'true',
    };

    const mate = await getCurrentMate().catch(() => null);
    if (!mate?.id) return local;

    const { data: docs } = await fetchVerificationDocs(mate.id);
    if (!docs?.length) return local;

    const merged = { ...local };
    for (const doc of docs) {
      const key = doc.doc_type;
      if (key in merged) {
        merged[key] = doc.status === 'approved' || doc.status === 'pending';
      }
    }
    return merged;
  } catch {
    return { phone: false, id: false, license: false, vehicle: false };
  }
}

export async function markVerificationStep(stepId, value) {
  const step = VERIFICATION_STEPS.find((s) => s.id === stepId);
  if (!step) return;
  await AsyncStorage.setItem(step.key, String(!!value));

  if (value) {
    const mate = await getCurrentMate().catch(() => null);
    if (mate?.id && DOC_MAP[stepId]) {
      await submitVerificationDoc(mate.id, DOC_MAP[stepId], 'Submitted from app').catch(() => {});
    }
  }
}

export function computeVerificationLevel(state) {
  const total = VERIFICATION_STEPS.length;
  const done = Object.values(state ?? {}).filter(Boolean).length;
  if (done === 0) return { level: 'unverified', label: 'Unverified', done, total, badge: null };
  if (done < total) return { level: 'partial', label: `${done}/${total} verified`, done, total, badge: 'partial' };
  return { level: 'verified', label: 'Verified mate', done, total, badge: 'verified' };
}

export function isVerifiedMate(state) {
  return computeVerificationLevel(state).level === 'verified';
}
