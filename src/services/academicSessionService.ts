import { API_BASE_URL } from '../config/api';

/**
 * Minimal wrapper for AcademicSetupController's session (academic year)
 * endpoints - only what the enrollment-workflow screens need (listing
 * sessions and knowing which one is current). Full CRUD
 * (admin_sessions_create/update/delete) belongs to a future Academic Year
 * management screen, not duplicated here.
 */

export interface AcademicSession {
  id: number;
  school_id: number;
  session_title: string;
  status: number; // 1 = current session for the school, 0 = not current
}

async function authedPost<T = any>(path: string, token: string, body: Record<string, any> = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message ?? `Request failed (${response.status})`);
  }
  return data as T;
}

export async function fetchAcademicSessions(token: string): Promise<AcademicSession[]> {
  const data = await authedPost<{ sessions: AcademicSession[] }>('/admin_sessions_list', token);
  return data.sessions ?? [];
}

// Convenience: the session flagged status === 1, or the most recent one if
// none is flagged current (defensive - a school mid-setup may not have set
// a current year yet).
export function pickCurrentSession(sessions: AcademicSession[]): AcademicSession | null {
  return sessions.find((s) => s.status === 1) ?? sessions[0] ?? null;
}
