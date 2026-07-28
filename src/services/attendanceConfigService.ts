import { API_BASE_URL } from '../config/api';

/**
 * §4.13 Attendance configuration builder.
 *
 * Backend: AttendanceConfigController (app/Http/Controllers/AttendanceConfigController.php).
 * Verified against the actual controller — all 6 routes below have a matching
 * method on the controller (statusList/statusSave/statusDelete/methodList/
 * methodSave/methodDelete), so this service is wired to real endpoints, not
 * guessed ones. Not yet executed against a live server — see the project's
 * own definition of done.
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

// --- Types (mirror AttendanceStatusConfig / AttendanceMethodConfig models) ---

export interface AttendanceStatusConfig {
  id: number;
  school_id: number;
  code: string;
  label: string;
  color: string | null;
  counts_as_present: boolean;
  requires_remark: boolean;
  sort_order: number;
  is_active: boolean;
  is_system_default: boolean;
}

export interface AttendanceMethodConfig {
  id: number;
  school_id: number;
  code: string;
  label: string;
  config: Record<string, any> | null;
  sort_order: number;
  is_active: boolean;
  is_system_default: boolean;
}

export interface StatusDraft {
  id?: number;
  code?: string;
  label: string;
  color?: string | null;
  counts_as_present: boolean;
  requires_remark: boolean;
  sort_order?: number;
  is_active?: boolean;
}

export interface MethodDraft {
  id?: number;
  code?: string;
  label: string;
  config?: Record<string, any> | null;
  sort_order?: number;
  is_active?: boolean;
}

// --- Statuses ---

export async function fetchAttendanceStatuses(token: string): Promise<AttendanceStatusConfig[]> {
  const data = await authedPost('/admin_attendance_status_list', token);
  return data.statuses ?? [];
}

export async function saveAttendanceStatus(
  token: string,
  draft: StatusDraft
): Promise<AttendanceStatusConfig> {
  const data = await authedPost('/admin_attendance_status_save', token, draft);
  return data.status;
}

export async function deleteAttendanceStatus(token: string, id: number): Promise<void> {
  await authedPost('/admin_attendance_status_delete', token, { id });
}

// --- Capture methods ---

export async function fetchAttendanceMethods(token: string): Promise<AttendanceMethodConfig[]> {
  const data = await authedPost('/admin_attendance_method_list', token);
  return data.methods ?? [];
}

export async function saveAttendanceMethod(
  token: string,
  draft: MethodDraft
): Promise<AttendanceMethodConfig> {
  const data = await authedPost('/admin_attendance_method_save', token, draft);
  return data.method;
}

export async function deleteAttendanceMethod(token: string, id: number): Promise<void> {
  await authedPost('/admin_attendance_method_delete', token, { id });
}
