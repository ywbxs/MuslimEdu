import { API_BASE_URL } from '../config/api';

/**
 * M4 dedicated examinations module. Backend: ExaminationController — the
 * `examinations`/`examination_results` tables and models already existed
 * (see that model's own docblock, "spec: teacher examinations module") but
 * had no controller or routes until this round. Distinct from the legacy
 * exam_list used elsewhere in the app.
 *
 * A teacher can create/manage an exam only for a section+subject they're
 * actually assigned to teach; admins can do everything in their school.
 * Once published, only an admin can edit the exam's definition — the
 * owning teacher can still grade and release results after that point.
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

export type ExaminationStatus = 'draft' | 'published' | 'archived';

export interface ExaminationAssignment {
  section_id: number;
  subject_id: number;
  subject_name: string | null;
  teacher_id: number;
  teacher_name: string | null;
}

export interface ExaminationResult {
  id: number;
  examination_id: number;
  student_id: number;
  marks_obtained: number | null;
  is_absent: boolean;
  remarks: string | null;
  graded_at: string | null;
  released_at: string | null;
}

export interface Examination {
  id: number;
  section_id: number | null;
  subject_id: number | null;
  exam_category_id: number | null;
  teacher_id: number;
  title: string;
  title_ar: string | null;
  description: string | null;
  exam_type: string;
  scheduled_date: string | null;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  room: string | null;
  total_marks: number;
  passing_marks: number | null;
  weight: number | null;
  instructions: string | null;
  status: ExaminationStatus;
  published_at: string | null;
  results?: ExaminationResult[];
}

export interface ExaminationDraft {
  id?: number;
  section_id: number;
  subject_id: number;
  exam_category_id?: number | null;
  title: string;
  description?: string | null;
  exam_type?: string;
  scheduled_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  duration_minutes?: number | null;
  room?: string | null;
  total_marks?: number;
  passing_marks?: number | null;
  weight?: number | null;
  instructions?: string | null;
}

export interface ResultDraft {
  student_id: number;
  marks_obtained: number | null;
  is_absent?: boolean;
  remarks?: string | null;
}

// --- Assignments (picker support) ---

export async function fetchMyExamAssignments(token: string): Promise<ExaminationAssignment[]> {
  const data = await authedPost('/examination_my_assignments', token);
  return data.assignments ?? [];
}

// --- Examinations ---

export async function fetchExaminations(
  token: string,
  filters: { sectionId?: number | null; subjectId?: number | null; status?: ExaminationStatus | null } = {}
): Promise<Examination[]> {
  const data = await authedPost('/examination_list', token, {
    section_id: filters.sectionId ?? null,
    subject_id: filters.subjectId ?? null,
    status: filters.status ?? null,
  });
  return data.examinations ?? [];
}

export async function saveExamination(token: string, draft: ExaminationDraft): Promise<Examination> {
  const data = await authedPost('/examination_save', token, draft);
  return data.examination;
}

export async function publishExamination(token: string, id: number): Promise<Examination> {
  const data = await authedPost('/examination_publish', token, { id });
  return data.examination;
}

export async function deleteExamination(token: string, id: number): Promise<void> {
  await authedPost('/examination_delete', token, { id });
}

// --- Results ---

export async function fetchExaminationResults(token: string, examinationId: number): Promise<ExaminationResult[]> {
  const data = await authedPost('/examination_results_list', token, { examination_id: examinationId });
  return data.results ?? [];
}

export async function saveExaminationResults(
  token: string,
  examinationId: number,
  results: ResultDraft[]
): Promise<ExaminationResult[]> {
  const data = await authedPost('/examination_results_save', token, { examination_id: examinationId, results });
  return data.results ?? [];
}

export async function releaseExaminationResults(token: string, examinationId: number): Promise<void> {
  await authedPost('/examination_results_release', token, { examination_id: examinationId });
}
