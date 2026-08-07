import { API_BASE_URL, absoluteUrl } from '../config/api';
import { cacheKeyFor, cacheThenNetwork } from '../utils/offlineCache';

const CACHE_PREFIX = '@teacher_gradebook_cache_v1';

// --- Shared fetch helper (same pattern as teacherAttendanceService.ts) ---

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
    throw new Error(firstErrorMessage(data) ?? `Request failed (${response.status})`);
  }

  return data;
}

// --- Types ---

export interface ExamCategoryOption {
  id: number;
  name: string;
  weight?: number | null;
}

export interface GradebookClassOption {
  section_id: number;
  section_name: string;
  class_id: number;
  class_name: string | null;
  subject_id: number;
  subject_name: string | null;
}

export interface GradebookRosterStudent {
  student_id: number;
  student_name: string;
  photo: string | null;
  mark: number | null;
  comment: string | null;
}

export interface GradebookRoster {
  section_id: number;
  section_name: string;
  subject_id: number;
  exam_category_id: number;
  total_marks: number | null;
  students: GradebookRosterStudent[];
}

export interface GradebookRecordInput {
  student_id: number;
  mark: number | null;
  comment?: string | null;
}

export interface AdminGradebookSubjectRow {
  subject_id: number;
  subject_name: string;
  mark: number | null;
  total_marks: number | null;
}

export interface AdminGradebookStudentRow {
  student_id: number;
  student_name: string;
  comment: string | null;
  subjects: AdminGradebookSubjectRow[];
}

// --- Teacher: which classes/subjects they can grade, plus exam categories ---

export async function fetchGradebookClasses(
  token: string
): Promise<{ classes: GradebookClassOption[]; examCategories: ExamCategoryOption[] }> {
  return cacheThenNetwork(cacheKeyFor(CACHE_PREFIX, token, 'classes'), async () => {
    const data = await authedPost('/teacher_gradebook_classes', token);
    return {
      classes: data.classes ?? [],
      examCategories: data.exam_categories ?? [],
    };
  });
}

// --- Teacher: roster for one section/subject/exam category ---

export async function fetchGradebookRoster(
  token: string,
  sectionId: number,
  subjectId: number,
  examCategoryId: number
): Promise<GradebookRoster> {
  const cacheKey = cacheKeyFor(CACHE_PREFIX, token, 'roster', sectionId, subjectId, examCategoryId);
  return cacheThenNetwork(cacheKey, async () => {
    const data = await authedPost('/teacher_gradebook_roster', token, {
      section_id: sectionId,
      subject_id: subjectId,
      exam_category_id: examCategoryId,
    });
    const students: any[] = data.students ?? [];
    return {
      section_id: data.section_id,
      section_name: data.section_name,
      subject_id: data.subject_id,
      exam_category_id: data.exam_category_id,
      total_marks: data.total_marks ?? null,
      students: students.map((s) => ({
        ...s,
        photo: absoluteUrl(s.photo ?? null),
      })),
    };
  });
}

// --- Teacher: save/update a batch of marks for a section/subject/exam category ---

export async function submitGradebook(
  token: string,
  sectionId: number,
  subjectId: number,
  examCategoryId: number,
  records: GradebookRecordInput[]
): Promise<{ message: string; count: number }> {
  return authedPost('/teacher_gradebook_submit', token, {
    section_id: sectionId,
    subject_id: subjectId,
    exam_category_id: examCategoryId,
    records,
  });
}

// --- Admin: exam categories for the review screen's picker ---

export async function fetchAdminGradebookExamCategories(token: string): Promise<ExamCategoryOption[]> {
  return cacheThenNetwork(cacheKeyFor(CACHE_PREFIX, token, 'adminExamCategories'), async () => {
    const data = await authedPost('/admin_gradebook_exam_categories', token);
    return data.exam_categories ?? [];
  });
}

// --- Admin: read-only review of entered grades for a class/section/exam category ---

export async function fetchAdminGradebookReview(
  token: string,
  classId: number,
  sectionId: number,
  examCategoryId: number,
  subjectId?: number | null
): Promise<{ students: AdminGradebookStudentRow[] }> {
  const cacheKey = cacheKeyFor(CACHE_PREFIX, token, 'adminReview', classId, sectionId, examCategoryId, subjectId ?? 'all');
  return cacheThenNetwork(cacheKey, async () => {
    const data = await authedPost('/admin_gradebook_review', token, {
      class_id: classId,
      section_id: sectionId,
      exam_category_id: examCategoryId,
      subject_id: subjectId ?? undefined,
    });
    return { students: data.students ?? [] };
  });
}

// --- Admin: manage exam categories / weights (Assessment Components, §4.11) ---
// First mobile-side write path for these — previously view-only here,
// creatable only through the legacy web portal.

export async function createExamCategory(
  token: string,
  input: { name: string; weight?: number | null }
): Promise<ExamCategoryOption> {
  const data = await authedPost('/admin_gradebook_exam_category_create', token, {
    name: input.name,
    weight: input.weight ?? undefined,
  });
  return data.exam_category;
}

export async function updateExamCategory(
  token: string,
  input: { exam_category_id: number; name?: string; weight?: number | null }
): Promise<ExamCategoryOption> {
  const data = await authedPost('/admin_gradebook_exam_category_update', token, input);
  return data.exam_category;
}

export async function deleteExamCategory(token: string, examCategoryId: number): Promise<void> {
  await authedPost('/admin_gradebook_exam_category_delete', token, { exam_category_id: examCategoryId });
}
