import { API_BASE_URL } from '../config/api';

/**
 * §4.20 Real permissions CRUD.
 *
 * Backend: PermissionController. NOTE — that controller did not exist in the
 * uploaded snapshot (routes/api.php registered 6 routes pointing at a class
 * that was missing entirely, which would 500 with "class not found"). It was
 * written from the existing PermissionGrant/CapabilityFlag models and
 * PermissionCatalog support class, which were already present. This service
 * matches that controller's request/response shape. None of this has been
 * executed against a live server.
 *
 * UI gating only — same rule as src/services/permissions.ts: Laravel is the
 * source of truth and re-checks every request itself.
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
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
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

export interface PermissionCatalogData {
  permission_keys: Record<string, string>;
  module_keys: Record<string, string>;
  roles: Record<string, string>;
  scope_types: string[];
}

export interface PermissionGrant {
  id: number;
  school_id: number;
  role_id: number;
  permission_key: string;
  scope_type: 'campus' | 'department' | null;
  scope_id: number | null;
  can_access: boolean;
  can_approve: boolean;
  can_override: boolean;
  is_active: boolean;
}

export interface GrantDraft {
  id?: number;
  role_id: number;
  permission_key: string;
  scope_type?: 'campus' | 'department' | null;
  scope_id?: number | null;
  can_access: boolean;
  can_approve?: boolean;
  can_override?: boolean;
  is_active?: boolean;
}

export interface CapabilityFlag {
  id: number | null;
  module_key: string;
  label: string;
  is_enabled: boolean;
  config: Record<string, any> | null;
}

// --- Catalog ---

export async function fetchPermissionCatalog(token: string): Promise<PermissionCatalogData> {
  return authedPost('/admin_permission_catalog', token);
}

// --- Grants ---

export async function fetchPermissionGrants(
  token: string,
  filters: { roleId?: number | null; permissionKey?: string | null } = {}
): Promise<PermissionGrant[]> {
  const data = await authedPost('/admin_permission_list', token, {
    role_id: filters.roleId ?? null,
    permission_key: filters.permissionKey ?? null,
  });
  return data.grants ?? [];
}

export async function savePermissionGrant(token: string, draft: GrantDraft): Promise<PermissionGrant> {
  const data = await authedPost('/admin_permission_save', token, draft);
  return data.grant;
}

export async function deletePermissionGrant(token: string, id: number): Promise<void> {
  await authedPost('/admin_permission_delete', token, { id });
}

// --- Capability flags (optional modules) ---

export async function fetchCapabilityFlags(token: string): Promise<CapabilityFlag[]> {
  const data = await authedPost('/admin_capability_flag_list', token);
  return data.flags ?? [];
}

export async function saveCapabilityFlag(
  token: string,
  moduleKey: string,
  isEnabled: boolean,
  config?: Record<string, any> | null
): Promise<CapabilityFlag> {
  const data = await authedPost('/admin_capability_flag_save', token, {
    module_key: moduleKey,
    is_enabled: isEnabled,
    config: config ?? null,
  });
  return data.flag;
}
