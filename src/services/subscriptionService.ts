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
  // Feature keys the current package explicitly grants (see
  // SUBSCRIPTION_FEATURE_KEYS below). Empty/absent means the package
  // doesn't restrict by feature - AdminDashboard falls back to gating
  // everything by `active` alone, same as before this field existed.
  features?: string[];
}

// Feature keys a subscription package can list in its `features` array to
// grant access to specific admin-side capabilities. Shared between
// AdminDashboard (which gates cards by these) and the superadmin's package
// editor (which lets a package opt into granting them).
export const SUBSCRIPTION_FEATURE_KEYS = {
  gradingSystems: 'grading_systems',
  examCategories: 'exam_categories',
  gradebookReview: 'gradebook_review',
} as const;

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
