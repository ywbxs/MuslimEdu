import { API_BASE_URL, absoluteUrl } from '../config/api';

// Shared fetch helpers — same pattern as announcementService.ts /
// teacherGradebookService.ts.

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

async function authedPostForm(path: string, token: string, form: FormData) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
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

export type LessonPlanStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export interface LessonPlanTarget {
  section_id: number;
  section_name: string;
  subject_id: number;
  subject_name: string | null;
}

export interface LessonPlan {
  id: number;
  title: string;
  week_label: string | null;
  lesson_date: string | null;
  objectives: string | null;
  competencies: string | null;
  activities: string | null;
  strategies: string | null;
  materials_notes: string | null;
  homework: string | null;
  reflections: string | null;
  status: LessonPlanStatus;
  admin_comment: string | null;
  decided_by_name: string | null;
  decided_at: string | null;
  section_id: number;
  section_name: string | null;
  subject_id: number;
  subject_name: string | null;
  teacher_id: number;
  teacher_name: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewLessonPlanInput {
  section_id: number;
  subject_id: number;
  title: string;
  week_label?: string;
  lesson_date?: string;
  objectives?: string;
  competencies?: string;
  activities?: string;
  strategies?: string;
  materials_notes?: string;
  homework?: string;
  submit?: boolean; // true = submit for approval now, false = save as draft
  attachment?: { uri: string; name: string; type: string } | null;
}

export interface LessonPlanUpdateInput {
  plan_id: number;
  title?: string;
  week_label?: string;
  lesson_date?: string;
  objectives?: string;
  competencies?: string;
  activities?: string;
  strategies?: string;
  materials_notes?: string;
  homework?: string;
  reflections?: string;
  submit?: boolean;
}

function mapPlan(p: any): LessonPlan {
  return {
    ...p,
    attachment_url: absoluteUrl(p.attachment_url ?? null),
  };
}

// --- Teacher ---

export async function fetchLessonPlanTargets(token: string): Promise<LessonPlanTarget[]> {
  const data = await authedPost('/teacher_lesson_plan_targets', token);
  return data.targets ?? [];
}

export async function fetchTeacherLessonPlans(
  token: string,
  filters: { status?: LessonPlanStatus; section_id?: number; subject_id?: number } = {}
): Promise<LessonPlan[]> {
  const data = await authedPost('/teacher_lesson_plan_list', token, filters);
  return (data.plans ?? []).map(mapPlan);
}

export async function createLessonPlan(token: string, input: NewLessonPlanInput): Promise<LessonPlan> {
  let data: any;

  if (input.attachment) {
    const form = new FormData();
    form.append('section_id', String(input.section_id));
    form.append('subject_id', String(input.subject_id));
    form.append('title', input.title);
    if (input.week_label) form.append('week_label', input.week_label);
    if (input.lesson_date) form.append('lesson_date', input.lesson_date);
    if (input.objectives) form.append('objectives', input.objectives);
    if (input.competencies) form.append('competencies', input.competencies);
    if (input.activities) form.append('activities', input.activities);
    if (input.strategies) form.append('strategies', input.strategies);
    if (input.materials_notes) form.append('materials_notes', input.materials_notes);
    if (input.homework) form.append('homework', input.homework);
    form.append('submit', input.submit ? '1' : '0');
    form.append('attachment', input.attachment as any);
    data = await authedPostForm('/teacher_lesson_plan_store', token, form);
  } else {
    data = await authedPost('/teacher_lesson_plan_store', token, {
      section_id: input.section_id,
      subject_id: input.subject_id,
      title: input.title,
      week_label: input.week_label,
      lesson_date: input.lesson_date,
      objectives: input.objectives,
      competencies: input.competencies,
      activities: input.activities,
      strategies: input.strategies,
      materials_notes: input.materials_notes,
      homework: input.homework,
      submit: input.submit ?? false,
    });
  }

  return mapPlan(data.plan);
}

export async function updateLessonPlan(token: string, input: LessonPlanUpdateInput): Promise<LessonPlan> {
  const data = await authedPost('/teacher_lesson_plan_update', token, input);
  return mapPlan(data.plan);
}

export async function deleteLessonPlan(token: string, planId: number): Promise<void> {
  await authedPost('/teacher_lesson_plan_delete', token, { plan_id: planId });
}

// --- Admin ---

export async function fetchAdminLessonPlanReview(
  token: string,
  filters: { section_id?: number; status?: LessonPlanStatus } = {}
): Promise<LessonPlan[]> {
  const data = await authedPost('/admin_lesson_plan_review', token, filters);
  return (data.plans ?? []).map(mapPlan);
}

export async function decideLessonPlan(
  token: string,
  planId: number,
  decision: 'approved' | 'rejected',
  adminComment?: string
): Promise<LessonPlan> {
  const data = await authedPost('/admin_lesson_plan_decide', token, {
    plan_id: planId,
    decision,
    admin_comment: adminComment,
  });
  return mapPlan(data.plan);
}
