import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';

/**
 * Bridges AuthContext and LocaleContext (separate providers, LocaleProvider
 * sits above AuthProvider in App.tsx so both hooks are reachable from one
 * component here) - re-fetches the locale bundle whenever the signed-in
 * account changes (login, logout, switching accounts).
 *
 * Without this, a fresh login never re-syncs the account's own saved
 * language preference: LocaleProvider's own initial refresh() runs once at
 * app launch, before a brand-new login even has a token yet, so the
 * account's default_locale (set via AccountSettingsScreen or the
 * superadmin/admin Localization screen) would otherwise only take effect
 * the NEXT time the app cold-starts with an already-saved session.
 *
 * Called with no explicit locale - the backend resolves the account's own
 * saved default_locale server-side (see AcademicLocaleService::bundle).
 */
export default function LocaleAccountSync() {
  const { token } = useAuth();
  const { refresh } = useLocale();
  const prevTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (token !== prevTokenRef.current) {
      prevTokenRef.current = token;
      refresh();
    }
  }, [token, refresh]);

  return null;
}
