import * as Keychain from 'react-native-keychain';
import { ENDPOINTS, absoluteUrl } from '../config/api';

// A single service name so we always read/write the same keychain entry
const KEYCHAIN_SERVICE = 'muslimedu_auth_token';

export type UserRole =
  | 'superadmin'
  | 'admin'
  | 'teacher'
  | 'accountant'
  | 'librarian'
  | 'parent'
  | 'student'
  | 'warden';

export interface OrphanProfile {
  orphan_id_number: string | null;
  guardian_name: string | null;
  guardian_relation: string | null;
  guardian_phone: string | null;
  health_status: string | null;
  special_needs: string | null;
  admission_date: string | null;
  admission_reason: string | null;
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role_id: number;
  role: UserRole;
  school_id: number | null;
  code: string | null;
  photo?: string | null;
  is_orphan?: boolean;
  // The school's locked student-code prefix (e.g. "MLP2648"), set once by
  // the admin via SchoolCodeSetupScreen. Null/undefined means it hasn't
  // been set up yet - that's the signal AdminDashboard uses to show the
  // setup step instead of the normal cards.
  school_code?: string | null;
  orphan_profile?: OrphanProfile | null;
  // Phase 3 - Academic Setup Wizard. False only for a school that hasn't
  // finished the wizard yet; legacy schools are backfilled on the backend
  // migration so this is true for every school that existed before Phase 3.
  // Undefined (old cached token before this field existed) is treated as
  // complete by AdminDashboard, same fail-open default the backend uses.
  academic_setup_completed?: boolean;
  institution_type?: 'mahad' | 'madrasa' | 'markaz' | 'regular_school' | 'orphanage' | null;
  // Admin's own contact phone (distinct from the school's phone in
  // SchoolProfile) - set via the "Your Info" onboarding wizard step or
  // userProfileService.updateOwnProfile.
  phone?: string | null;
}

export interface LoginResponse {
  message: string;
  user: AuthUser;
  token: string;
}

export class AuthApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Thrown by loginRequest when the account has 2FA enabled and no/invalid
 * code was supplied yet - distinct from AuthApiError so the login screen
 * can show a code-entry step instead of a plain error. */
export class TwoFactorRequiredError extends Error {
  constructor() {
    super('Two-factor authentication code required.');
  }
}

// Ensures user.photo is a loadable absolute URL rather than a relative path
// (a relative path renders as nothing in <Image>, i.e. the avatar "doesn't sync").
function normalizeUser(user: AuthUser): AuthUser {
  return { ...user, photo: absoluteUrl(user.photo) };
}

/**
 * Calls POST /login with email + password.
 * Throws AuthApiError with the server's message on failure (401/403/etc).
 */
export async function loginRequest(
  email: string,
  password: string,
  twoFactorCode?: string,
): Promise<LoginResponse> {
  let response: Response;

  try {
    response = await fetch(ENDPOINTS.login, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        device_name: 'muslimedu-mobile',
        ...(twoFactorCode ? { two_factor_code: twoFactorCode } : {}),
      }),
    });
  } catch (networkError) {
    // Fetch itself failed (no internet, DNS, server unreachable, etc.)
    throw new AuthApiError(
      'Could not reach the server. Check your internet connection.',
      0,
    );
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    // The server didn't return JSON at all (commonly an HTML error page
    // from Laravel when a request is missing Accept: application/json).
    // Surface the status so it's clear this is a backend/server error,
    // not a bad password.
    throw new AuthApiError(
      `Server returned an unexpected response (status ${response.status}). Please try again or contact support.`,
      response.status,
    );
  }

  // The account has 2FA enabled and either no code, or the request got
  // here before a code was ready to send - the server responds 200 (not
  // an error status) with this flag rather than issuing a token.
  if (response.ok && data?.requires_two_factor) {
    throw new TwoFactorRequiredError();
  }

  if (!response.ok) {
    throw new AuthApiError(data?.message ?? 'Login failed.', response.status);
  }

  const parsed = data as LoginResponse;
  return { ...parsed, user: normalizeUser(parsed.user) };
}

/**
 * Calls POST /me using the stored token, to verify it's still valid
 * and rehydrate the user object on app launch.
 */
export async function fetchMe(token: string): Promise<AuthUser> {
  const response = await fetch(ENDPOINTS.me, {
    method: 'POST', // matches the api.php route registered as POST
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new AuthApiError('Session expired. Please log in again.', response.status);
  }

  const data = await response.json();
  return normalizeUser(data.user as AuthUser);
}

/** Calls POST /logout to revoke just this device's token on the server. */
export async function logoutRequest(token: string): Promise<void> {
  try {
    await fetch(ENDPOINTS.logout, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    // Even if this fails (offline, etc.), we still clear the local token below.
  }
}

/** Saves the token securely in the OS keychain/keystore. */
export async function saveToken(token: string): Promise<void> {
  await Keychain.setGenericPassword('muslimedu_token', token, {
    service: KEYCHAIN_SERVICE,
  });
}

/** Reads the saved token, or null if none exists. */
export async function getStoredToken(): Promise<string | null> {
  const credentials = await Keychain.getGenericPassword({
    service: KEYCHAIN_SERVICE,
  });
  if (!credentials) return null;
  return credentials.password;
}

/** Removes the token from the keychain (local logout). */
export async function clearToken(): Promise<void> {
  await Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE });
}
