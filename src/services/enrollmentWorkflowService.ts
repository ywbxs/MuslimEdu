import { API_BASE_URL } from '../config/api';

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

export interface WorkflowStage {
  id: number;
  school_id: number;
  name: string;
  code: string | null;
  order: number;
  is_terminal: boolean;
  status: 'active' | 'inactive';
  created_at?: string;
  updated_at?: string;
}

export interface WorkflowStageInput {
  name: string;
  code?: string | null;
  order?: number;
  is_terminal?: boolean;
  status?: 'active' | 'inactive';
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

export interface StudentEnrollmentWorkflowStatus {
  started: boolean;
  message?: string;
  record: StudentWorkflowRecord | null;
  stages: StudentWorkflowStage[];
  history: StudentWorkflowHistoryEntry[];
}

export async function fetchStudentEnrollmentWorkflowStatus(
  token: string
): Promise<StudentEnrollmentWorkflowStatus> {
  return authedPost('/student_enrollment_workflow_status', token, {});
}
