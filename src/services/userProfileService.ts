import { API_BASE_URL, absoluteUrl } from '../config/api';
import { AuthUser } from './authService';

/**
 * Update the logged-in user's own basic profile info (name, phone).
 * Admin-only (admin_own_profile_update's backend guard) - used by the
 * first-login onboarding wizard's "Your Info" step. Email is intentionally
 * not editable via this endpoint: it's the login identity, set by whoever
 * created the account. For the generic, all-roles profile editor (Menu
 * screen's edit-profile entry point), use updateMyProfile below instead.
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

/**
 * Update the logged-in user's own name, email, address, and profile
 * photo - available to every role (student, teacher, cashier, registrar,
 * admin, etc), used by the Menu screen's edit-profile entry point.
 * Backend: ApiController::me_profile_update (no role guard beyond being
 * authenticated).
 */

export interface MyProfileInput {
  name?: string;
  email?: string;
  address?: string | null;
  photo?: { uri: string; fileName?: string; type?: string } | null;
}

export async function updateMyProfile(token: string, input: MyProfileInput): Promise<AuthUser> {
  const hasPhoto = !!input.photo;

  let response: Response;
  if (hasPhoto) {
    const form = new FormData();
    if (input.name !== undefined) form.append('name', input.name);
    if (input.email !== undefined) form.append('email', input.email);
    if (input.address !== undefined && input.address !== null) form.append('address', input.address);
    // @ts-ignore - React Native FormData file shape
    form.append('photo', { uri: input.photo!.uri, name: input.photo!.fileName ?? 'photo.jpg', type: input.photo!.type ?? 'image/jpeg' });

    response = await fetch(`${API_BASE_URL}/me_profile_update`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
  } else {
    response = await fetch(`${API_BASE_URL}/me_profile_update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: input.name,
        email: input.email,
        address: input.address,
      }),
    });
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      (typeof data.message === 'string' && data.message) ||
      (data.errors && (Object.values(data.errors)[0] as string[])?.[0]) ||
      `Request failed (${response.status})`;
    throw new Error(message);
  }

  const user = data.user as AuthUser;
  return { ...user, photo: absoluteUrl(user.photo) };
}
