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

export interface PendingSubscriptionRequest {
  id: number;
  package: string | null;
  requested_at: string;
}

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
  // Non-null while a self-serve request (see submitSubscriptionRequest
  // below) is awaiting superadmin review - SubscriptionStatusCard shows
  // this instead of a "Subscribe" button while it's set.
  pending_request?: PendingSubscriptionRequest | null;
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

// --- Self-serve subscription requests (SubscribeScreen) ---

export interface AdminSubscriptionPackage {
  id: number;
  name: string;
  price: number;
  package_type: string;
  interval: 'days' | 'monthly' | 'yearly' | 'life_time';
  days: number;
  student_limit: string | null;
  features: string[];
  description: string | null;
}

// admin: the catalog SubscribeScreen picks from - active packages only.
export async function fetchAdminSubscriptionPackages(token: string): Promise<AdminSubscriptionPackage[]> {
  const data = await authedPost('/admin_subscription_packages', token);
  return data.packages;
}

// admin: submit a request for a package - superadmin reviews it from
// SubscriptionRequestsScreen. Rejected server-side if one is already
// pending for this school.
export async function submitSubscriptionRequest(
  token: string,
  input: { package_id: number; payment_reference?: string },
): Promise<PendingSubscriptionRequest> {
  const data = await authedPost('/admin_subscription_request_create', token, input);
  return data.request;
}
