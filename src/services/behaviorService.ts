import { API_BASE_URL } from '../config/api';
import { cacheKeyFor, cacheThenNetwork } from '../utils/offlineCache';

const CACHE_PREFIX = '@behavior_cache_v1';

/**
 * M4 Behavior & discipline module. Backend: BehaviorController (newly
 * written this round — no table/routes/screens existed before). Category
 * management is admin-only; incident logging is teacher-or-admin.
 * Visibility: admins see every incident in their school; teachers see
 * incidents they reported plus incidents for sections where they're the
 * homeroom teacher — see the controller's own comments.
 *
 * NOT built here: actually sending a parent notification.
 * `notifyParent` only records that a human marked it done.
 *
 * Never executed against a live server.
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

export type BehaviorPolarity = 'positive' | 'negative';
export type BehaviorSeverity = 'minor' | 'moderate' | 'major';
export type BehaviorStatus = 'open' | 'reviewed' | 'resolved' | 'escalated';

export interface BehaviorCategory {
  id: number;
  code: string;
  label: string;
  polarity: BehaviorPolarity;
  default_severity: BehaviorSeverity | null;
  is_active: boolean;
  is_system_default: boolean;
}

export interface CategoryDraft {
  id?: number;
  code?: string;
  label: string;
  polarity?: BehaviorPolarity;
  default_severity?: BehaviorSeverity | null;
  is_active?: boolean;
}

export interface RefRow {
  id: number;
  name: string;
}

export interface BehaviorIncident {
  id: number;
  student_id: number;
  section_id: number | null;
  behavior_category_id: number;
  severity: BehaviorSeverity;
  description: string;
  action_taken: string | null;
  incident_date: string;
  status: BehaviorStatus;
  parent_notified_at: string | null;
  reported_by: number;
  student?: RefRow & { email?: string };
  section?: RefRow | null;
  category?: BehaviorCategory;
  reporter?: RefRow;
}

export interface IncidentDraft {
  id?: number;
  student_id?: number;
  section_id?: number | null;
  behavior_category_id: number;
  severity: BehaviorSeverity;
  description: string;
  action_taken?: string | null;
  incident_date: string;
  status?: BehaviorStatus;
}

export interface IncidentFilters {
  studentId?: number | null;
  sectionId?: number | null;
  status?: BehaviorStatus | null;
  severity?: BehaviorSeverity | null;
  categoryId?: number | null;
}

// --- Categories ---

export async function fetchBehaviorCategories(token: string): Promise<BehaviorCategory[]> {
  return cacheThenNetwork(cacheKeyFor(CACHE_PREFIX, token, 'categories'), async () => {
    const data = await authedPost('/admin_behavior_category_list', token);
    return data.categories ?? [];
  });
}

export async function saveBehaviorCategory(token: string, draft: CategoryDraft): Promise<BehaviorCategory> {
  const data = await authedPost('/admin_behavior_category_save', token, draft);
  return data.category;
}

export async function deleteBehaviorCategory(token: string, id: number): Promise<void> {
  await authedPost('/admin_behavior_category_delete', token, { id });
}

// --- Incidents ---

export async function fetchBehaviorIncidents(token: string, filters: IncidentFilters = {}): Promise<BehaviorIncident[]> {
  return cacheThenNetwork(cacheKeyFor(CACHE_PREFIX, token, 'incidents', JSON.stringify(filters)), async () => {
    const data = await authedPost('/behavior_incident_list', token, {
      student_id: filters.studentId ?? null,
      section_id: filters.sectionId ?? null,
      status: filters.status ?? null,
      severity: filters.severity ?? null,
      category_id: filters.categoryId ?? null,
    });
    return data.incidents ?? [];
  });
}

export async function saveBehaviorIncident(token: string, draft: IncidentDraft): Promise<BehaviorIncident> {
  const data = await authedPost('/behavior_incident_save', token, draft);
  return data.incident;
}

export async function deleteBehaviorIncident(token: string, id: number): Promise<void> {
  await authedPost('/behavior_incident_delete', token, { id });
}

export async function notifyParentOfIncident(token: string, id: number): Promise<BehaviorIncident> {
  const data = await authedPost('/behavior_incident_notify_parent', token, { id });
  return data.incident;
}
