import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, absoluteUrl } from '../config/api';

// Per-account cache of the last successfully fetched enrollment status, so a
// student stuck mid-workflow (not yet `completed`, so MainTabs' gate can't
// rely on the "already completed" fast path) still sees their real progress
// offline instead of just an error - see fetchStudentEnrollmentWorkflowStatus.
const ENROLLMENT_STATUS_CACHE_PREFIX = '@student_enrollment_status_cache_v1';

function enrollmentStatusCacheKey(token: string): string {
  return `${ENROLLMENT_STATUS_CACHE_PREFIX}:${token.slice(-12)}`;
}

/**
 * Types + API wrappers for spec §4.16 "Enrollment Workflow Management".
 * Backend: EnrollmentWorkflowController.php (admin_enrollment_stages_*,
 * admin_enrollment_workflow_*), all routed inside the auth:sanctum group.
 *
 * Scope of this file: full coverage of every admin endpoint the controller
 * exposes. Only the stage-builder screens consume this today
 * (EnrollmentStagesScreen / EnrollmentStageFormScreen) - the workflow-record
 * functions (list/start/advance/withdraw/history) are included now so the
 * next slice (assigning/moving students through the stages) doesn't have to
 * duplicate this typing work.
 */

// Which role can view/advance a record while it's at this stage. Null means
// admin-only (the original behavior, still the default for every existing
// stage). Matches EnrollmentWorkflowController's approverRoleFor() mapping.
export type StageApproverRole = 'accountant' | 'registrar' | null;

export interface WorkflowStage {
  id: number;
  school_id: number;
  name: string;
  code: string | null;
  order: number;
  is_terminal: boolean;
  status: 'active' | 'inactive';
  // Shown to the student on EnrollmentStatusScreen while they're on this
  // stage (e.g. "Pay the enrollment fee at the Cashier's office"). Null/
  // empty means no extra instruction is shown for this stage.
  student_instructions: string | null;
  approver_role: StageApproverRole;
  created_at?: string;
  updated_at?: string;
}

export interface WorkflowStageInput {
  name: string;
  code?: string | null;
  order?: number;
  is_terminal?: boolean;
  status?: 'active' | 'inactive';
  student_instructions?: string | null;
  approver_role?: StageApproverRole;
}

export interface WorkflowStudentSummary {
  id: number;
  name: string;
  photo?: string | null;
}

export interface WorkflowRecord {
  id: number;
  user_id: number;
  school_id: number;
  session_id: number;
  current_stage_id: number;
  status: 'in_progress' | 'completed' | 'withdrawn';
  started_at: string;
  completed_at: string | null;
  notes: string | null;
  student?: WorkflowStudentSummary;
  currentStage?: WorkflowStage;
}

export interface WorkflowHistoryEntry {
  from_stage_id: number | null;
  to_stage_id: number;
  changed_by: number;
  notes: string | null;
  created_at: string;
  fromStage?: { id: number; name: string } | null;
  toStage?: { id: number; name: string } | null;
  changedByUser?: { id: number; name: string };
}

class ApiError extends Error {
  errors?: Record<string, string[]>;
}

async function authedPost<T = any>(
  path: string,
  token: string,
  body: Record<string, any> = {}
): Promise<T> {
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
    const message =
      (typeof data.message === 'string' && data.message) ||
      (data.errors && (Object.values(data.errors)[0] as string[])?.[0]) ||
      `Request failed (${response.status})`;
    const err = new ApiError(message);
    err.errors = data.errors;
    throw err;
  }

  return data as T;
}

/* --------------------------------------------------------------------- */
/* Stage configuration (per-school, ordered list)                        */
/* --------------------------------------------------------------------- */

export async function fetchEnrollmentStages(
  token: string,
  status?: 'active' | 'inactive'
): Promise<WorkflowStage[]> {
  const data = await authedPost<{ stages: WorkflowStage[] }>(
    '/admin_enrollment_stages_list',
    token,
    status ? { status } : {}
  );
  return data.stages ?? [];
}

export async function createEnrollmentStage(
  token: string,
  input: WorkflowStageInput
): Promise<WorkflowStage> {
  const data = await authedPost<{ stage: WorkflowStage; message: string }>(
    '/admin_enrollment_stages_create',
    token,
    input
  );
  return data.stage;
}

export async function updateEnrollmentStage(
  token: string,
  stageId: number,
  input: Partial<WorkflowStageInput>
): Promise<WorkflowStage> {
  const data = await authedPost<{ stage: WorkflowStage; message: string }>(
    '/admin_enrollment_stages_update',
    token,
    { stage_id: stageId, ...input }
  );
  return data.stage;
}

// Pass the FULL ordered list of stage_ids for the school - the backend
// re-numbers `order` by array position in one call (see controller comment).
export async function reorderEnrollmentStages(
  token: string,
  stageIds: number[]
): Promise<WorkflowStage[]> {
  const data = await authedPost<{ stages: WorkflowStage[]; message: string }>(
    '/admin_enrollment_stages_reorder',
    token,
    { stage_ids: stageIds }
  );
  return data.stages ?? [];
}

export async function deleteEnrollmentStage(token: string, stageId: number): Promise<void> {
  await authedPost('/admin_enrollment_stages_delete', token, { stage_id: stageId });
}

/* --------------------------------------------------------------------- */
/* Workflow records (a student's progress through the stages)            */
/* --------------------------------------------------------------------- */

export async function fetchEnrollmentWorkflowList(
  token: string,
  filters: { session_id?: number; stage_id?: number; status?: string } = {}
): Promise<WorkflowRecord[]> {
  const data = await authedPost<{ records: WorkflowRecord[] }>(
    '/admin_enrollment_workflow_list',
    token,
    filters
  );
  return data.records ?? [];
}

export async function startEnrollmentWorkflow(
  token: string,
  userId: number,
  sessionId: number,
  notes?: string
): Promise<WorkflowRecord> {
  const data = await authedPost<{ record: WorkflowRecord; message: string }>(
    '/admin_enrollment_workflow_start',
    token,
    { user_id: userId, session_id: sessionId, notes }
  );
  return data.record;
}

export async function advanceEnrollmentWorkflow(
  token: string,
  recordId: number,
  stageId: number,
  notes?: string
): Promise<WorkflowRecord> {
  const data = await authedPost<{ record: WorkflowRecord; message: string }>(
    '/admin_enrollment_workflow_advance',
    token,
    { record_id: recordId, stage_id: stageId, notes }
  );
  return data.record;
}

export async function withdrawEnrollmentWorkflow(
  token: string,
  recordId: number,
  notes?: string
): Promise<WorkflowRecord> {
  const data = await authedPost<{ record: WorkflowRecord; message: string }>(
    '/admin_enrollment_workflow_withdraw',
    token,
    { record_id: recordId, notes }
  );
  return data.record;
}

export async function fetchEnrollmentWorkflowHistory(
  token: string,
  recordId: number
): Promise<{ record: WorkflowRecord; history: WorkflowHistoryEntry[] }> {
  return authedPost('/admin_enrollment_workflow_history', token, { record_id: recordId });
}

// Reaching a terminal stage only marks the workflow record 'completed' - it
// does not place the student in a class/section (see controller comment on
// EnrollmentWorkflowController::admin_enrollment_workflow_advance). This is
// the separate, deliberate action that actually creates the roster
// Enrollment row, callable once a record is 'completed'.
export async function placeEnrollmentWorkflowInSection(
  token: string,
  recordId: number,
  classId: number,
  sectionId: number
): Promise<void> {
  await authedPost('/admin_enrollment_workflow_place_in_section', token, {
    record_id: recordId,
    class_id: classId,
    section_id: sectionId,
  });
}

/* --------------------------------------------------------------------- */
/* Student-facing read (own progress only)                               */
/* --------------------------------------------------------------------- */

// Shape of GET-equivalent /student_enrollment_workflow_status. Deliberately
// separate from WorkflowRecord: the backend calls record->makeHidden('notes')
// on this endpoint (student view should never see admin's internal remarks -
// see controller comment on student_enrollment_workflow_status), and history
// entries here are pre-flattened to stage names only, not full stage objects.
export interface StudentWorkflowStage {
  id: number;
  name: string;
  order: number;
  is_terminal: boolean;
  student_instructions?: string | null;
}

export interface StudentWorkflowRecord {
  id: number;
  status: 'in_progress' | 'completed' | 'withdrawn';
  current_stage_id: number;
  currentStage?: StudentWorkflowStage;
}

export interface StudentWorkflowHistoryEntry {
  from_stage: string | null;
  to_stage: string | null;
  changed_at: string;
}

export interface StudentEnrollmentWorkflowSchoolInfo {
  name: string | null;
  logo: string | null;
}

export interface StudentEnrollmentWorkflowStatus {
  started: boolean;
  message?: string;
  record: StudentWorkflowRecord | null;
  stages: StudentWorkflowStage[];
  history: StudentWorkflowHistoryEntry[];
  school?: StudentEnrollmentWorkflowSchoolInfo;
}

/**
 * Cache-then-network, same reasoning as academicScheduleService's
 * fetchMySchedule: a successful fetch refreshes the on-disk cache, a failed
 * one (offline, timeout) falls back to it instead of throwing, so a student
 * mid-enrollment-workflow still sees their real progress while offline.
 * Only throws if there's truly nothing cached yet.
 */
export async function fetchStudentEnrollmentWorkflowStatus(
  token: string
): Promise<StudentEnrollmentWorkflowStatus> {
  const cacheKey = enrollmentStatusCacheKey(token);
  try {
    const data = await authedPost<StudentEnrollmentWorkflowStatus>('/student_enrollment_workflow_status', token, {});
    const result: StudentEnrollmentWorkflowStatus = {
      ...data,
      school: data.school ? { ...data.school, logo: absoluteUrl(data.school.logo) } : undefined,
    };
    AsyncStorage.setItem(cacheKey, JSON.stringify(result)).catch(() => {
      // Best-effort cache write.
    });
    return result;
  } catch (err) {
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) return JSON.parse(cached) as StudentEnrollmentWorkflowStatus;
    } catch {
      // Fall through to rethrow the original network error.
    }
    throw err;
  }
}
