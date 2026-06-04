import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { DEFAULT_LANG, translate } from '@/constants/translations';
import { getAppPreferences, saveAppPreferences } from '@/services/appPreferences';

const I18nContext = createContext({ lang: DEFAULT_LANG, t: (k) => k, setLang: async () => {} });

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(DEFAULT_LANG);

  useEffect(() => {
    getAppPreferences().then((p) => setLangState(p.language || DEFAULT_LANG)).catch(() => {});
  }, []);

  const setLang = useCallback(async (code) => {
    await saveAppPreferences({ language: code });
    setLangState(code);
  }, []);

  const t = useCallback((key) => translate(lang, key), [lang]);

  const value = useMemo(() => ({ lang, t, setLang }), [lang, t, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
