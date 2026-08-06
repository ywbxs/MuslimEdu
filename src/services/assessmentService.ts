import { API_BASE_URL, absoluteUrl } from '../config/api';
import { cacheKeyFor, cacheThenNetwork } from '../utils/offlineCache';

const CACHE_PREFIX = '@assessment_cache_v1';

// --- Shared fetch helpers (same pattern as announcementService.ts/lessonPlanService.ts) ---

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

// Multipart variant, used only when an attachment is attached.
async function authedPostForm(path: string, token: string, form: FormData) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      // Content-Type intentionally omitted — RN sets the multipart
      // boundary itself when the body is a FormData instance.
    },
    body: form,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(firstErrorMessage(data) ?? `Request failed (${response.status})`);
  }

  return data;
}

// --- Types ---

export type AssessmentType = 'assignment' | 'quiz' | 'project' | 'exam';
export type AssessmentStatus = 'draft' | 'published';
export type SubmissionStatus = 'submitted' | 'graded' | 'resubmission_requested';

export interface AssessmentTarget {
  section_id: number;
  section_name: string;
  subject_id: number;
  subject_name: string | null;
}

// Admin-defined component an assessment can optionally be tagged with
// (spec §4.11 "Assessment components") — same shape as
// teacherGradebookService's ExamCategoryOption, duplicated here rather
// than imported to keep this service self-contained, same convention
// the rest of these service files already follow.
export interface AssessmentExamCategory {
  id: number;
  name: string;
  weight: number | null;
}

export interface AssessmentSubmission {
  id: number;
  assessment_id: number;
  student_id: number;
  student_name: string | null;
  attempt_number: number;
  text_response: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  status: SubmissionStatus;
  score: number | null;
  feedback: string | null;
  graded_by_name: string | null;
  graded_at: string | null;
  submitted_at: string | null;
}

export interface Assessment {
  id: number;
  type: AssessmentType;
  title: string;
  instructions: string | null;
  max_score: number | null;
  due_at: string | null;
  allow_resubmission: boolean;
  status: AssessmentStatus;
  section_id: number;
  section_name: string | null;
  subject_id: number;
  subject_name: string | null;
  exam_category_id: number | null;
  exam_category_name: string | null;
  exam_category_weight: number | null;
  teacher_id: number;
  teacher_name: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  created_at: string;
  updated_at: string;
  submission_count?: number;
  graded_count?: number;
  // Only present on student_assessment_list results.
  my_submission?: AssessmentSubmission | null;
  is_overdue?: boolean;
}

// One exam-category bucket within a subject's weighted-grade breakdown.
// `weight` is null when the admin never set one for that category (or
// for the synthetic "Uncategorized" bucket, exam_category_id null) —
// those buckets are excluded from `weighted_percentage` on the parent
// SubjectGrade, shown here only for transparency.
export interface AssessmentGradeCategory {
  exam_category_id: number | null;
  exam_category_name: string;
  weight: number | null;
  percentage: number | null;
  graded_count: number;
}

// One subject's computed grade for one student (§4.11 weights read into
// an actual grade). `calculation_method` tells you whether
// `weighted_percentage` came from admin-defined category weights
// ('weighted') or, when no weighted category has graded work yet, a
// flat average across everything graded so far ('flat'). Both null
// means nothing has been graded yet.
export interface AssessmentSubjectGrade {
  subject_id: number;
  subject_name: string | null;
  categories: AssessmentGradeCategory[];
  weighted_percentage: number | null;
  calculation_method: 'weighted' | 'flat' | null;
  graded_count: number;
  total_published: number;
}

export interface AssessmentStudentGradeRow {
  student_id: number;
  student_name: string;
  grade: AssessmentSubjectGrade | null;
}

export interface NewAssessmentInput {
  section_id: number;
  subject_id: number;
  exam_category_id?: number | null;
  type: AssessmentType;
  title: string;
  instructions?: string;
  max_score?: number | null;
  due_at?: string | null;
  allow_resubmission?: boolean;
  publish?: boolean;
  attachment?: { uri: string; name: string; type: string } | null;
}

export interface AssessmentUpdateInput {
  assessment_id: number;
  exam_category_id?: number | null;
  title?: string;
  instructions?: string;
  max_score?: number | null;
  due_at?: string | null;
  allow_resubmission?: boolean;
  publish?: boolean;
}

function mapAssessment(a: any): Assessment {
  return {
    ...a,
    attachment_url: absoluteUrl(a.attachment_url ?? null),
    my_submission: a.my_submission ? mapSubmission(a.my_submission) : a.my_submission ?? undefined,
  };
}

function mapSubmission(s: any): AssessmentSubmission {
  return {
    ...s,
    attachment_url: absoluteUrl(s.attachment_url ?? null),
  };
}

// --- Teacher ---

export async function fetchAssessmentTargets(
  token: string
): Promise<{ targets: AssessmentTarget[]; examCategories: AssessmentExamCategory[] }> {
  return cacheThenNetwork(cacheKeyFor(CACHE_PREFIX, token, 'targets'), async () => {
    const data = await authedPost('/teacher_assessment_targets', token);
    return {
      targets: data.targets ?? [],
      examCategories: data.exam_categories ?? [],
    };
  });
}

export async function fetchTeacherAssessments(
  token: string,
  filters: { status?: AssessmentStatus; section_id?: number; subject_id?: number; type?: AssessmentType } = {}
): Promise<Assessment[]> {
  const cacheKey = cacheKeyFor(CACHE_PREFIX, token, 'teacherList', JSON.stringify(filters));
  return cacheThenNetwork(cacheKey, async () => {
    const data = await authedPost('/teacher_assessment_list', token, filters);
    return (data.assessments ?? []).map(mapAssessment);
  });
}

export async function createAssessment(token: string, input: NewAssessmentInput): Promise<Assessment> {
  let data: any;

  if (input.attachment) {
    const form = new FormData();
    form.append('section_id', String(input.section_id));
    form.append('subject_id', String(input.subject_id));
    if (input.exam_category_id != null) form.append('exam_category_id', String(input.exam_category_id));
    form.append('type', input.type);
    form.append('title', input.title);
    if (input.instructions) form.append('instructions', input.instructions);
    if (input.max_score != null) form.append('max_score', String(input.max_score));
    if (input.due_at) form.append('due_at', input.due_at);
    form.append('allow_resubmission', input.allow_resubmission ? '1' : '0');
    form.append('publish', input.publish ? '1' : '0');
    form.append('attachment', input.attachment as any);
    data = await authedPostForm('/teacher_assessment_store', token, form);
  } else {
    data = await authedPost('/teacher_assessment_store', token, {
      section_id: input.section_id,
      subject_id: input.subject_id,
      exam_category_id: input.exam_category_id ?? undefined,
      type: input.type,
      title: input.title,
      instructions: input.instructions ?? undefined,
      max_score: input.max_score ?? undefined,
      due_at: input.due_at ?? undefined,
      allow_resubmission: input.allow_resubmission ?? false,
      publish: input.publish ?? false,
    });
  }

  return mapAssessment(data.assessment);
}

export async function updateAssessment(token: string, input: AssessmentUpdateInput): Promise<Assessment> {
  const data = await authedPost('/teacher_assessment_update', token, input);
  return mapAssessment(data.assessment);
}

export async function deleteAssessment(token: string, assessmentId: number): Promise<void> {
  await authedPost('/teacher_assessment_delete', token, { assessment_id: assessmentId });
}

export async function fetchAssessmentSubmissions(
  token: string,
  assessmentId: number
): Promise<{ assessment: Assessment; submissions: AssessmentSubmission[] }> {
  return cacheThenNetwork(cacheKeyFor(CACHE_PREFIX, token, 'submissions', assessmentId), async () => {
    const data = await authedPost('/teacher_assessment_submissions', token, { assessment_id: assessmentId });
    return {
      assessment: mapAssessment(data.assessment),
      submissions: (data.submissions ?? []).map(mapSubmission),
    };
  });
}

export async function gradeSubmission(
  token: string,
  input: { submission_id: number; score?: number | null; feedback?: string; request_resubmission?: boolean }
): Promise<AssessmentSubmission> {
  const data = await authedPost('/teacher_assessment_grade', token, input);
  return mapSubmission(data.submission);
}

// Weighted grade for every enrolled student in one section/subject —
// reads Assessment scores + ExamCategory weight, doesn't touch Gradebook.
export async function fetchTeacherAssessmentGrades(
  token: string,
  sectionId: number,
  subjectId: number
): Promise<AssessmentStudentGradeRow[]> {
  return cacheThenNetwork(cacheKeyFor(CACHE_PREFIX, token, 'teacherGrades', sectionId, subjectId), async () => {
    const data = await authedPost('/teacher_assessment_grades', token, {
      section_id: sectionId,
      subject_id: subjectId,
    });
    return data.students ?? [];
  });
}

// --- Student ---

export async function fetchStudentAssessments(token: string): Promise<Assessment[]> {
  return cacheThenNetwork(cacheKeyFor(CACHE_PREFIX, token, 'studentList'), async () => {
    const data = await authedPost('/student_assessment_list', token);
    return (data.assessments ?? []).map(mapAssessment);
  });
}

// The student's own weighted grade for every subject with at least one
// published assessment in their current section — powers a "My Grades"
// view without needing a section/subject picker first.
export async function fetchStudentAssessmentGrades(token: string): Promise<AssessmentSubjectGrade[]> {
  return cacheThenNetwork(cacheKeyFor(CACHE_PREFIX, token, 'studentGrades'), async () => {
    const data = await authedPost('/student_assessment_grades', token);
    return data.subjects ?? [];
  });
}

export async function submitAssessmentWork(
  token: string,
  input: {
    assessment_id: number;
    text_response?: string;
    attachment?: { uri: string; name: string; type: string } | null;
  }
): Promise<AssessmentSubmission> {
  let data: any;

  if (input.attachment) {
    const form = new FormData();
    form.append('assessment_id', String(input.assessment_id));
    if (input.text_response) form.append('text_response', input.text_response);
    form.append('attachment', input.attachment as any);
    data = await authedPostForm('/student_assessment_submit', token, form);
  } else {
    data = await authedPost('/student_assessment_submit', token, {
      assessment_id: input.assessment_id,
      text_response: input.text_response ?? undefined,
    });
  }

  return mapSubmission(data.submission);
}

// --- Admin ---

export async function fetchAdminAssessmentReview(
  token: string,
  filters: { section_id?: number; status?: AssessmentStatus; type?: AssessmentType } = {}
): Promise<Assessment[]> {
  const cacheKey = cacheKeyFor(CACHE_PREFIX, token, 'adminReview', JSON.stringify(filters));
  return cacheThenNetwork(cacheKey, async () => {
    const data = await authedPost('/admin_assessment_review', token, filters);
    return (data.assessments ?? []).map(mapAssessment);
  });
}

export async function fetchAdminAssessmentSubmissions(
  token: string,
  assessmentId: number
): Promise<{ assessment: Assessment; submissions: AssessmentSubmission[] }> {
  return cacheThenNetwork(cacheKeyFor(CACHE_PREFIX, token, 'adminSubmissions', assessmentId), async () => {
    const data = await authedPost('/admin_assessment_submissions', token, { assessment_id: assessmentId });
    return {
      assessment: mapAssessment(data.assessment),
      submissions: (data.submissions ?? []).map(mapSubmission),
    };
  });
}

// Read-only counterpart to fetchTeacherAssessmentGrades, for admin
// spot-checking one section/subject without teacher credentials.
export async function fetchAdminAssessmentGrades(
  token: string,
  sectionId: number,
  subjectId: number
): Promise<AssessmentStudentGradeRow[]> {
  const cacheKey = cacheKeyFor(CACHE_PREFIX, token, 'adminGrades', sectionId, subjectId);
  return cacheThenNetwork(cacheKey, async () => {
    const data = await authedPost('/admin_assessment_grades', token, {
      section_id: sectionId,
      subject_id: subjectId,
    });
    return data.students ?? [];
  });
}
