import { API_BASE_URL } from '../config/api';

/**
 * M4 teacher/staff two-factor authentication + device sessions.
 *
 * Backend: TwoFactorController (app/Http/Controllers/TwoFactorController.php),
 * built and verified live this session — full setup/confirm/disable/login
 * flow run against a real seeded database, not guessed. Session management
 * reuses Sanctum's existing personal_access_tokens (each device_name at
 * login already becomes a token name, so device_sessions_list is just a
 * read over what already exists, not a new concept to keep in sync).
 */

function firstErrorMessage(data: any): string | null {
  if (!data) return null;
  if (typeof data.message === 'string') return data.message;
  if (typeof data.error === 'string') return data.error;
  if (data.errors && typeof data.errors === 'object') {
    const first = Object.values(data.errors)[0];
    if (Array.isArray(first) && typeof first[0] === 'string') return first[0];
  }
  return null;
}

async function authedPost(path: string, token: string, body: Record<string, any> = {}) {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('You appear to be offline. Check your connection and try again.');
  }

  const data = await response.json().catch(() => ({}));

  if (response.status === 401 || response.status === 403) {
    throw new Error(firstErrorMessage(data) ?? 'You do not have permission to do this.');
  }
  if (!response.ok) {
    throw new Error(firstErrorMessage(data) ?? `Request failed (${response.status})`);
  }
  return data;
}

// --- Types ---

export interface TwoFactorStatus {
  enabled: boolean;
  pending: boolean;
}

export interface TwoFactorSetup {
  secret: string;
  otpauth_url: string;
}

export interface DeviceSession {
  id: number;
  device_name: string;
  last_used_at: string | null;
  created_at: string;
  is_current: boolean;
}

// --- Two-factor authentication ---

export async function fetchTwoFactorStatus(token: string): Promise<TwoFactorStatus> {
  return authedPost('/two_factor_status', token) as Promise<TwoFactorStatus>;
}

export async function startTwoFactorSetup(token: string): Promise<TwoFactorSetup> {
  return authedPost('/two_factor_setup', token) as Promise<TwoFactorSetup>;
}

export async function confirmTwoFactorSetup(
  token: string,
  code: string,
): Promise<{ message: string; recovery_codes: string[] }> {
  return authedPost('/two_factor_confirm', token, { code });
}

export async function disableTwoFactor(token: string, password: string): Promise<{ message: string }> {
  return authedPost('/two_factor_disable', token, { password });
}

// --- Device sessions ---

export async function fetchDeviceSessions(token: string): Promise<DeviceSession[]> {
  const data = await authedPost('/device_sessions_list', token);
  return data.sessions ?? [];
}

export async function revokeDeviceSession(token: string, id: number): Promise<void> {
  await authedPost('/device_sessions_revoke', token, { id });
}
