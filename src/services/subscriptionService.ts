import { API_BASE_URL } from '../config/api';

// Same authed-POST pattern as orphanService.ts.
async function authedPost(path: string, token: string, body: Record<string, any> = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message ?? `Request failed (${response.status})`);
  }

  return data;
}

// --- Types (mirror the exact response shape of ApiController.php) ---

export interface AdminSubscriptionStatus {
  active: boolean;
  reason: 'no_subscription' | 'expired' | null;
  package: string | null;
  expire_date: string | number | null;
  student_limit?: number | string;
}

export interface StudentAcademicStatus {
  enrolled: boolean;
  paid: boolean;
  unlocked: boolean;
  class_id: number | null;
  section_id: number | null;
  session_id: number | null;
  unpaid_count: number;
}

// admin: gates the "Academic" card on AdminDashboard
export async function fetchAdminSubscriptionStatus(token: string): Promise<AdminSubscriptionStatus> {
  return authedPost('/admin_subscription_status', token);
}

// student: gates the "Academic" card on StudentDashboard
export async function fetchStudentAcademicStatus(token: string): Promise<StudentAcademicStatus> {
  return authedPost('/student_academic_status', token);
}
