import { API_BASE_URL } from '../config/api';

/**
 * Update the logged-in user's own basic profile info (name, phone).
 * Cross-role (not admin-specific) - lives here rather than in
 * academicSetupService.ts, which is scoped to the school's setup wizard.
 * Email is intentionally not editable via this endpoint: it's the login
 * identity, set by whoever created the account.
 */

export interface OwnProfileInput {
  name?: string;
  phone?: string | null;
}

export interface OwnProfileResult {
  id: number;
  name: string;
  email: string;
  phone: string | null;
}

export async function updateOwnProfile(token: string, input: OwnProfileInput): Promise<OwnProfileResult> {
  const response = await fetch(`${API_BASE_URL}/admin_own_profile_update`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      (typeof data.message === 'string' && data.message) ||
      (data.errors && (Object.values(data.errors)[0] as string[])?.[0]) ||
      `Request failed (${response.status})`;
    throw new Error(message);
  }

  return data.user as OwnProfileResult;
}
