import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiPost, ApiClientError } from './apiClient';

/**
 * Thin wrapper over apiClient.apiPost that resolves the auth token itself.
 *
 * Why not just use apiPost directly: every existing service either threads a
 * token down from the caller or re-implements the AsyncStorage lookup inline
 * (see portalService.ts). This centralises the key-scan once so the next-phase
 * screens do not each grow their own copy.
 *
 * The key list matches the one portalService.ts already scans, so it works
 * regardless of which key AuthContext happens to persist under.
 */
const TOKEN_KEYS = ['token', 'auth_token', 'authToken', 'user_token'];

let cachedToken: string | null = null;

export async function resolveToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;

  for (const key of TOKEN_KEYS) {
    const value = await AsyncStorage.getItem(key);
    if (value) {
      cachedToken = value;
      return value;
    }
  }
  return null;
}

/** Call after login/logout so a stale token is not reused. */
export function clearTokenCache(): void {
  cachedToken = null;
}

export async function post<T>(route: string, body: Record<string, unknown> = {}): Promise<T> {
  const token = await resolveToken();

  try {
    return await apiPost<T>(`/${route}`, { token, body });
  } catch (error) {
    if (error instanceof ApiClientError && error.code === 'unauthorized') {
      clearTokenCache();
    }
    throw error;
  }
}

/** Multipart variant for the two endpoints that accept a file. */
export async function postForm<T>(route: string, form: FormData): Promise<T> {
  const token = await resolveToken();
  return apiPost<T>(`/${route}`, { token, body: form, timeoutMs: 60000 });
}

export { ApiClientError };
