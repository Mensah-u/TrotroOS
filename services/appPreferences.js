import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  LANGUAGE: 'appLanguage',
  CURRENCY: 'appCurrency',
  DATA_SAVER: 'appDataSaver',
  HAPTICS: 'appHaptics',
};

export const LANGUAGES = [
  { code: 'en', label: 'English', greeting: 'Welcome' },
  { code: 'tw', label: 'Twi (Asante)', greeting: 'Akwaaba' },
  { code: 'ga', label: 'Ga', greeting: 'Ojekoo' },
  { code: 'pidgin', label: 'Pidgin', greeting: 'How be?' },
  { code: 'ee', label: 'Ewe', greeting: 'Woezɔ' },
];

const DEFAULTS = {
  language: 'en',
  currency: 'GHS',
  dataSaver: false,
  haptics: true,
};

export async function getAppPreferences() {
  try {
    const entries = await AsyncStorage.multiGet(Object.values(KEYS));
    const map = Object.fromEntries(entries);
    return {
      language: map[KEYS.LANGUAGE] ?? DEFAULTS.language,
      currency: map[KEYS.CURRENCY] ?? DEFAULTS.currency,
      dataSaver: map[KEYS.DATA_SAVER] === 'true',
      haptics: map[KEYS.HAPTICS] !== 'false',
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveAppPreferences(patch) {
  const current = await getAppPreferences();
  const next = { ...current, ...patch };
  await AsyncStorage.multiSet([
    [KEYS.LANGUAGE, String(next.language)],
    [KEYS.CURRENCY, String(next.currency)],
    [KEYS.DATA_SAVER, String(next.dataSaver)],
    [KEYS.HAPTICS, String(next.haptics)],
  ]);
  return next;
}

export function getLanguageByCode(code) {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}
