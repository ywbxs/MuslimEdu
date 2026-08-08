import { API_BASE_URL } from '../config/api';

/**
 * School-scoped localization management - Academic Locale module
 * (AcademicLocaleController/AcademicLocaleService on the backend, already
 * live). Gated admin-or-superadmin server-side (role_id in [1,2]), scoped
 * to the calling user's own school_id - a superadmin without a specific
 * school context has nothing meaningful to manage here, so this screen is
 * reached from AdminDashboard (school admins), not SuperAdminDashboard.
 *
 * There's no endpoint that enumerates every t('key', 'fallback') call this
 * app makes - translations are free-form key/value overrides an admin adds
 * for whatever keys they want to customize, not a fixed checklist. The
 * bundle endpoint only returns keys that already have a saved row.
 */
const DEFAULT_TIMEOUT_MS = 15000;

export interface LocaleOption {
  id: number;
  code: string;
  name: string;
  is_rtl: boolean;
  is_active?: boolean;
}

export interface LocaleBundle {
  locale: string;
  is_rtl: boolean;
  calendar_type: string;
  timezone: string;
  translations: Record<string, string>;
}

export interface TranslationEntry {
  locale: string;
  key: string;
  value: string;
}

async function authedPost(path: string, token: string, body: Record<string, any> = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timed out. Check your connection and try again.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message ?? data?.errors?.[Object.keys(data?.errors ?? {})[0]]?.[0] ?? `Request failed (${response.status})`);
  }
  return data;
}

/** POST /academic_locale_bundle - translations for one locale (defaults to the school's own default_locale if omitted). */
export async function fetchLocaleBundle(token: string, locale?: string): Promise<LocaleBundle> {
  return authedPost('/academic_locale_bundle', token, locale ? { locale } : {});
}

/**
 * POST /admin_locale_list_save - admin/superadmin only. Pass an empty
 * array to "peek" at the school's currently configured locales without
 * changing anything (saveLocales() on the backend is a no-op over an
 * empty list, but still returns the full current list) - there's no
 * separate list-only endpoint.
 */
export async function saveLocales(token: string, locales: { code: string; name: string; is_rtl?: boolean }[]): Promise<LocaleOption[]> {
  const data = await authedPost('/admin_locale_list_save', token, { locales });
  return data.locales ?? [];
}

/** POST /admin_translations_save - admin/superadmin only. Upserts each {locale, key, value} row. */
export async function saveTranslations(token: string, translations: TranslationEntry[]): Promise<void> {
  await authedPost('/admin_translations_save', token, { translations });
}
