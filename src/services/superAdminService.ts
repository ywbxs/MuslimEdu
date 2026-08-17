import { API_BASE_URL } from '../config/api';

/**
 * Superadmin-only screens: dashboard overview, school management, admins
 * per school, the API Locker (3rd-party keys + user session revoke),
 * backend health, and cross-school post/comment moderation. Backend:
 * SuperAdminApiController - every endpoint checks role_id === 1 itself
 * and 403s otherwise, so these calls only work for a superadmin token.
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

export interface DashboardOverview {
  schools: { total: number; active: number; disabled: number };
  users_by_role: Record<string, number>;
  posts: { total: number; comments: number };
  api_keys_active: number;
  trash: { schools: number; admins: number };
}

export type SchoolType = 'regular' | 'orphanage';

export interface School {
  id: number;
  title: string;
  email: string;
  phone: number | string;
  address: string;
  description: string | null;
  school_type: SchoolType;
  school_code: string | null;
  status: 0 | 1;
  admin_count: number | null;
  created_at: string;
}

export interface SchoolListResult {
  schools: School[];
  current_page: number;
  last_page: number;
  total: number;
}

export interface SchoolAdmin {
  id: number;
  name: string;
  email: string;
  school_id: number;
  status: number;
  created_at: string;
}

export interface ApiKeyRecord {
  id: number;
  name: string;
  key_prefix: string;
  school: { id: number; title: string } | null;
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface UserSession {
  id: number;
  name: string;
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
}

export interface BackendHealth {
  checked_at: string;
  database: { ok: boolean; driver: string; error: string | null };
  cache: { ok: boolean; driver: string };
  queue: { driver: string; failed_jobs: number };
  disk: { free_bytes: number | null; total_bytes: number | null; free_percent: number | null };
  app: { php_version: string; laravel_version: string; debug_mode: boolean; environment: string };
  totals: { schools: number; users: number; posts: number };
}

export interface ModeratedPost {
  id: number;
  content: string | null;
  privacy: string;
  school_id: number;
  created_at: string;
  author: { id: number; name: string } | null;
  images: string[];
  likes_count: number;
  comments_count: number;
}

export interface ModeratedPostListResult {
  posts: ModeratedPost[];
  next_before_id: number | null;
  has_more: boolean;
}

export interface ModeratedComment {
  id: number;
  parent_id: number | null;
  content: string;
  created_at: string;
  author: { id: number; name: string } | null;
  likes_count: number;
  replies: ModeratedComment[];
}

export interface TrashedSchool extends School {
  deleted_at: string;
  days_remaining: number;
}

export interface TrashedAdmin extends SchoolAdmin {
  deleted_at: string;
  days_remaining: number;
}

export interface ActivityLogEntry {
  id: number;
  school_id: number | null;
  user: { id: number; name: string; email: string } | null;
  auditable_type: string;
  auditable_id: number;
  action: 'created' | 'updated' | 'deleted';
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  created_at: string;
}

export interface ActivityLogResult {
  logs: ActivityLogEntry[];
  current_page: number;
  last_page: number;
  total: number;
}

// --- Subscription packages (plans) + per-school fee management ---

export type PackageInterval = 'days' | 'monthly' | 'yearly' | 'life_time';

export interface SubscriptionPackage {
  id: number;
  name: string;
  price: number;
  package_type: string;
  interval: PackageInterval;
  days: number;
  student_limit: string | null;
  features: string[];
  status: 0 | 1;
  description: string | null;
}

export interface SchoolSubscription {
  school_id: number;
  active: boolean;
  reason: 'no_subscription' | 'expired' | null;
  package: string | null;
  package_id: number | null;
  expire_date: string | number | null;
  student_limit: string | number | null;
  paid_amount: number | string | null;
  payment_method: string | null;
  date_added: string | number | null;
  features: string[];
}

// --- Dashboard ---

export async function fetchDashboardOverview(token: string): Promise<DashboardOverview> {
  return authedPost('/superadmin_dashboard_overview', token, {});
}

// --- School management ---

export async function fetchSchools(token: string, search = '', page = 1): Promise<SchoolListResult> {
  return authedPost('/superadmin_school_list', token, { search, page });
}

export interface SchoolCreateInput {
  title: string;
  email: string;
  phone: string;
  address: string;
  description?: string;
  school_type: SchoolType;
  admin_name: string;
  admin_email: string;
  admin_password: string;
}

export async function createSchool(token: string, input: SchoolCreateInput): Promise<School> {
  const data = await authedPost('/superadmin_school_create', token, input);
  return data.school;
}

export interface SchoolUpdateInput {
  school_id: number;
  title?: string;
  email?: string;
  phone?: string;
  address?: string;
  description?: string;
  school_type?: SchoolType;
}

export async function updateSchool(token: string, input: SchoolUpdateInput): Promise<School> {
  const data = await authedPost('/superadmin_school_update', token, input);
  return data.school;
}

export async function setSchoolStatus(token: string, schoolId: number, status: 0 | 1): Promise<School> {
  const data = await authedPost('/superadmin_school_set_status', token, { school_id: schoolId, status });
  return data.school;
}

// --- School trash (30-day delete, restore, or permanent purge) ---

export async function trashSchool(token: string, schoolId: number): Promise<void> {
  await authedPost('/superadmin_school_trash', token, { school_id: schoolId });
}

export async function restoreSchool(token: string, schoolId: number): Promise<School> {
  const data = await authedPost('/superadmin_school_restore', token, { school_id: schoolId });
  return data.school;
}

export async function purgeSchool(token: string, schoolId: number): Promise<void> {
  await authedPost('/superadmin_school_purge', token, { school_id: schoolId });
}

export async function fetchTrashedSchools(token: string): Promise<TrashedSchool[]> {
  const data = await authedPost('/superadmin_trashed_schools', token, {});
  return data.schools;
}

// --- Admins per school ---

export async function fetchSchoolAdmins(token: string, schoolId: number): Promise<SchoolAdmin[]> {
  const data = await authedPost('/superadmin_school_admins', token, { school_id: schoolId });
  return data.admins;
}

export async function createSchoolAdmin(
  token: string,
  input: { school_id: number; name: string; email: string; password: string },
): Promise<SchoolAdmin> {
  const data = await authedPost('/superadmin_admin_create', token, input);
  return data.admin;
}

/** Moves the admin to trash (recoverable for 30 days) - not an instant hard delete. */
export async function deleteSchoolAdmin(token: string, userId: number): Promise<void> {
  await authedPost('/superadmin_admin_delete', token, { user_id: userId });
}

export async function resetSchoolAdminPassword(token: string, userId: number, password: string): Promise<void> {
  await authedPost('/superadmin_admin_reset_password', token, { user_id: userId, password });
}

// --- Admin trash (restore, or permanent purge) ---

export async function restoreSchoolAdmin(token: string, userId: number): Promise<SchoolAdmin> {
  const data = await authedPost('/superadmin_admin_restore', token, { user_id: userId });
  return data.admin;
}

export async function purgeSchoolAdmin(token: string, userId: number): Promise<void> {
  await authedPost('/superadmin_admin_purge', token, { user_id: userId });
}

export async function fetchTrashedAdmins(token: string): Promise<TrashedAdmin[]> {
  const data = await authedPost('/superadmin_trashed_admins', token, {});
  return data.admins;
}

// --- API Locker ---

export async function fetchApiKeys(token: string): Promise<ApiKeyRecord[]> {
  const data = await authedPost('/superadmin_api_key_list', token, {});
  return data.keys;
}

export async function createApiKey(
  token: string,
  input: { name: string; school_id?: number | null; expires_in_days?: number },
): Promise<{ rawKey: string; record: ApiKeyRecord }> {
  const data = await authedPost('/superadmin_api_key_create', token, input);
  return { rawKey: data.key, record: data.record };
}

export async function revokeApiKey(token: string, keyId: number): Promise<void> {
  await authedPost('/superadmin_api_key_revoke', token, { key_id: keyId });
}

export async function fetchUserSessions(
  token: string,
  userId: number,
): Promise<{ user: { id: number; name: string; role_id: number }; sessions: UserSession[] }> {
  return authedPost('/superadmin_user_sessions', token, { user_id: userId });
}

export async function revokeUserSession(token: string, tokenId: number): Promise<void> {
  await authedPost('/superadmin_session_revoke', token, { token_id: tokenId });
}

export async function revokeAllUserSessions(token: string, userId: number): Promise<void> {
  await authedPost('/superadmin_session_revoke_all', token, { user_id: userId });
}

// --- Backend status ---

export async function fetchBackendHealth(token: string): Promise<BackendHealth> {
  return authedPost('/superadmin_backend_health', token, {});
}

// --- Post / comment moderation ---

export async function fetchModeratedPosts(
  token: string,
  opts: { search?: string; schoolId?: number; beforeId?: number } = {},
): Promise<ModeratedPostListResult> {
  return authedPost('/superadmin_post_list', token, {
    search: opts.search ?? '',
    school_id: opts.schoolId,
    before_id: opts.beforeId,
  });
}

export async function fetchPostComments(token: string, postId: number): Promise<ModeratedComment[]> {
  const data = await authedPost('/superadmin_post_comments', token, { post_id: postId });
  return data.comments;
}

export async function deleteModeratedPost(token: string, postId: number): Promise<void> {
  await authedPost('/superadmin_post_delete', token, { post_id: postId });
}

export async function deleteModeratedComment(token: string, commentId: number): Promise<void> {
  await authedPost('/superadmin_comment_delete', token, { comment_id: commentId });
}

// --- Activity log ---

export async function fetchActivityLog(
  token: string,
  opts: { schoolId?: number; userId?: number; auditableType?: string; action?: 'created' | 'updated' | 'deleted'; page?: number } = {},
): Promise<ActivityLogResult> {
  return authedPost('/superadmin_activity_log', token, {
    school_id: opts.schoolId,
    user_id: opts.userId,
    auditable_type: opts.auditableType,
    action: opts.action,
    page: opts.page,
  });
}

// --- Subscription packages (plans) ---

export async function fetchPackages(token: string): Promise<SubscriptionPackage[]> {
  const data = await authedPost('/superadmin_package_list', token, {});
  return data.packages;
}

export interface PackageCreateInput {
  name: string;
  price: number;
  package_type: string;
  interval: PackageInterval;
  days?: number;
  student_limit?: string;
  features?: string[];
  description?: string;
}

export async function createPackage(token: string, input: PackageCreateInput): Promise<SubscriptionPackage> {
  const data = await authedPost('/superadmin_package_create', token, input);
  return data.package;
}

export interface PackageUpdateInput {
  package_id: number;
  name?: string;
  price?: number;
  package_type?: string;
  interval?: PackageInterval;
  days?: number;
  student_limit?: string;
  features?: string[];
  description?: string;
}

export async function updatePackage(token: string, input: PackageUpdateInput): Promise<SubscriptionPackage> {
  const data = await authedPost('/superadmin_package_update', token, input);
  return data.package;
}

export async function setPackageStatus(token: string, packageId: number, status: 0 | 1): Promise<SubscriptionPackage> {
  const data = await authedPost('/superadmin_package_set_status', token, { package_id: packageId, status });
  return data.package;
}

// --- Per-school subscription (fee management) ---

export async function fetchSchoolSubscription(token: string, schoolId: number): Promise<SchoolSubscription> {
  const data = await authedPost('/superadmin_school_subscription', token, { school_id: schoolId });
  return data.subscription;
}

export interface SchoolSubscriptionSetInput {
  school_id: number;
  package_id: number;
  paid_amount?: number;
  payment_method?: string;
  student_limit?: string;
  expire_date?: number;
}

export async function setSchoolSubscription(
  token: string,
  input: SchoolSubscriptionSetInput,
): Promise<SchoolSubscription> {
  const data = await authedPost('/superadmin_school_subscription_set', token, input);
  return data.subscription;
}
