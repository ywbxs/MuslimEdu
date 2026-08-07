import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { I18nManager } from 'react-native';
import localeService from '../services/localeService';

type LocaleContextValue = {
  locale: string;
  isRTL: boolean;
  calendarType: string;
  t: (key: string, fallback?: string) => string;
  refresh: (locale?: string) => Promise<void>;
};

const Context = createContext<LocaleContextValue>({
  locale: 'en',
  isRTL: false,
  calendarType: 'gregorian',
  t: (k, f) => f || k,
  refresh: async () => {},
});

// Locales this app treats as right-to-left regardless of what the backend's
// bundle response says - Arabic is the one RTL language actually offered in
// AccountSettingsScreen's language picker today. Exported so that screen can
// tell (before vs after saving) whether a language change flips RTL-ness,
// without duplicating this list.
export const RTL_LOCALES = new Set(['ar']);

export function LocaleProvider({ children }: any) {
  const [bundle, setBundle] = useState<any>({ locale: 'en', is_rtl: false, calendar_type: 'gregorian', translations: {} });

  const refresh = async (locale?: string) => {
    try {
      const next = await localeService.bundle(locale);
      setBundle(next);

      // React Native's RTL layout mirroring is a native-level setting
      // (I18nManager) applied once at bundle load, not something that
      // re-renders live the way translated strings do - flipping it here
      // only takes full visual effect on the NEXT app launch.
      // AccountSettingsScreen prompts the user to restart when a language
      // change actually flips this, using the same RTL_LOCALES check.
      const wantsRTL = !!next.is_rtl || RTL_LOCALES.has(next.locale);
      if (wantsRTL !== I18nManager.isRTL) {
        I18nManager.allowRTL(wantsRTL);
        I18nManager.forceRTL(wantsRTL);
      }
    } catch (e) {
      // Keep whatever locale was already loaded - a failed refresh
      // shouldn't blank out translations that were already showing.
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale: bundle.locale,
      isRTL: !!bundle.is_rtl || RTL_LOCALES.has(bundle.locale),
      calendarType: bundle.calendar_type || 'gregorian',
      t: (k: string, f?: string) => bundle.translations?.[k] || f || k,
      refresh,
    }),
    [bundle],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export const useLocale = () => useContext(Context);
export default Context;
