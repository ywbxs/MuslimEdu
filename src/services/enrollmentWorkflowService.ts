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
  // Populated from the actual roster Enrollment row for this student+session
  // (if any) - null until "Place in Section" has been done, even for a
  // 'completed' record. Lets the list show placement state at a glance.
  class_name?: string | null;
  section_name?: string | null;
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

// Multipart variant for admin_enrollment_workflow_payment_update - the only
// call in this file that can carry a file (the optional receipt photo).
async function authedPostForm<T = any>(path: string, token: string, form: FormData): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
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
  // Backend photo paths are relative to the asset host - every other
  // service absolutizes at the fetch layer (see UserAvatar's own comment),
  // this one just hadn't needed a student photo until the list card grew
  // an avatar.
  return (data.records ?? []).map((r) => ({
    ...r,
    student: r.student ? { ...r.student, photo: absoluteUrl(r.student.photo) } : r.student,
  }));
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
/* Fee types (per-school, admin-managed: Tuition, Miscellaneous, ...)    */
/* --------------------------------------------------------------------- */

export interface FeeType {
  id: number;
  school_id: number;
  name: string;
  code: string | null;
  amount: string | number | null;
  is_required: boolean;
  sort_order: number;
  is_active: boolean;
}

export interface FeeTypeInput {
  name: string;
  code?: string | null;
  amount?: number | null;
  is_required?: boolean;
  sort_order?: number;
  is_active?: boolean;
}

export async function fetchFeeTypes(token: string, status?: 'active' | 'inactive'): Promise<FeeType[]> {
  const data = await authedPost<{ fee_types: FeeType[] }>(
    '/admin_enrollment_fee_types_list',
    token,
    status ? { status } : {}
  );
  return data.fee_types ?? [];
}

export async function createFeeType(token: string, input: FeeTypeInput): Promise<FeeType> {
  const data = await authedPost<{ fee_type: FeeType; message: string }>('/admin_enrollment_fee_types_create', token, input);
  return data.fee_type;
}

export async function updateFeeType(token: string, feeTypeId: number, input: Partial<FeeTypeInput>): Promise<FeeType> {
  const data = await authedPost<{ fee_type: FeeType; message: string }>('/admin_enrollment_fee_types_update', token, {
    fee_type_id: feeTypeId,
    ...input,
  });
  return data.fee_type;
}

export async function deleteFeeType(token: string, feeTypeId: number): Promise<void> {
  await authedPost('/admin_enrollment_fee_types_delete', token, { fee_type_id: feeTypeId });
}

/* --------------------------------------------------------------------- */
/* Payments (per student, per fee type - the "recibo" the approver checks) */
/* --------------------------------------------------------------------- */

export type PaymentStatus = 'unpaid' | 'paid' | 'waived';
export type PaymentMode = 'cash' | 'bank_transfer' | 'gcash' | 'check' | 'other';

export interface WorkflowPayment {
  id: number;
  record_id: number;
  fee_type_id: number;
  amount: string | number | null;
  status: PaymentStatus;
  payment_mode: PaymentMode | null;
  receipt_number: string | null;
  receipt_photo: string | null;
  paid_at: string | null;
  notes: string | null;
  feeType?: FeeType;
}

export async function fetchWorkflowPayments(token: string, recordId: number): Promise<WorkflowPayment[]> {
  const data = await authedPost<{ payments: WorkflowPayment[] }>('/admin_enrollment_workflow_payments_list', token, {
    record_id: recordId,
  });
  return data.payments ?? [];
}

export interface PaymentUpdateInput {
  status: PaymentStatus;
  amount?: number | null;
  payment_mode?: PaymentMode | null;
  receipt_number?: string | null;
  notes?: string | null;
  receiptPhoto?: { uri: string; fileName?: string; type?: string } | null;
}

export async function updateWorkflowPayment(
  token: string,
  recordId: number,
  feeTypeId: number,
  input: PaymentUpdateInput
): Promise<WorkflowPayment> {
  const form = new FormData();
  form.append('record_id', String(recordId));
  form.append('fee_type_id', String(feeTypeId));
  form.append('status', input.status);
  if (input.amount != null) form.append('amount', String(input.amount));
  if (input.payment_mode) form.append('payment_mode', input.payment_mode);
  if (input.receipt_number) form.append('receipt_number', input.receipt_number);
  if (input.notes) form.append('notes', input.notes);
  if (input.receiptPhoto) {
    // @ts-ignore - React Native's FormData accepts this shape for file uploads
    form.append('receipt_photo', {
      uri: input.receiptPhoto.uri,
      name: input.receiptPhoto.fileName ?? 'receipt.jpg',
      type: input.receiptPhoto.type ?? 'image/jpeg',
    });
  }

  const data = await authedPostForm<{ payment: WorkflowPayment; message: string }>(
    '/admin_enrollment_workflow_payment_update',
    token,
    form
  );
  return data.payment;
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
