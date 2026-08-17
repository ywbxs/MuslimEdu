import { API_BASE_URL } from '../config/api';

/**
 * Spec §4.9 Grading System Builder + §4.10 Grade Scale Builder.
 *
 * The backend for this (AcademicCatalogController::admin_grading_systems_* /
 * admin_grade_scales_*) and its routes were already built and wired in
 * routes/api.php before any RN screen existed to call them - this service
 * is the first thing in the app that actually calls them. Same authed-POST
 * pattern as subscriptionService.ts / academicSetupService.ts.
 */

function firstErrorMessage(data: any): string | null {
  if (!data) return null;
  if (typeof data.message === 'string') return data.message;
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

// --- Types (mirror AcademicCatalogController.php response shapes) ---

// 'quarterly' added here - a grading system whose scores are computed and
// reported per academic quarter (distinct from the other types, which are
// all scoring *methods* rather than reporting *periods*). The backend's
// admin_grading_systems_create/_update validation (Laravel `in:` rule on
// `type`, per this file's own top-of-file note that the routes predate any
// RN screen calling them) needs to accept this value too, or creating/
// saving a Quarterly grading system will fail server-side even though the
// UI offers it.
export type GradingSystemType =
  | 'percentage' | 'letter' | 'gpa' | 'competency' | 'pass_fail' | 'memorization'
  | 'behavior' | 'attendance' | 'oral' | 'written' | 'practical'
  | 'islamic_studies' | 'arabic' | 'quarterly' | 'custom';

export interface GradeScaleBand {
  id?: number;
  grade_scale_id?: number;
  min_score: number;
  max_score: number;
  label: string;
  gpa_value?: number | null;
  remarks?: string | null;
  is_passing?: boolean;
  honors_eligible?: boolean;
  promotion_eligible?: boolean;
  order?: number;
}

export interface GradeScale {
  id: number;
  school_id: number;
  grading_system_id: number;
  name: string;
  version: number;
  effective_date: string | null;
  is_current: boolean;
  status: 'active' | 'archived';
  bands?: GradeScaleBand[];
}

export interface GradingSystem {
  id: number;
  school_id: number;
  name: string;
  type: GradingSystemType;
  description: string | null;
  program_id: number | null;
  department_id: number | null;
  subject_id: number | null;
  is_default: boolean;
  status: 'active' | 'inactive';
  current_scale?: GradeScale | null;
}

export const GRADING_SYSTEM_TYPES: GradingSystemType[] = [
  'percentage', 'letter', 'gpa', 'competency', 'pass_fail', 'memorization',
  'behavior', 'attendance', 'oral', 'written', 'practical',
  'islamic_studies', 'arabic', 'quarterly', 'custom',
];

// --- Grading systems ---

export async function fetchGradingSystems(token: string): Promise<GradingSystem[]> {
  const data = await authedPost('/admin_grading_systems_list', token);
  return data?.grading_systems ?? [];
}

export interface GradingSystemInput {
  name: string;
  type: GradingSystemType;
  description?: string | null;
  program_id?: number | null;
  department_id?: number | null;
  subject_id?: number | null;
  is_default?: boolean;
  status?: 'active' | 'inactive';
}

export async function createGradingSystem(token: string, input: GradingSystemInput): Promise<GradingSystem> {
  const data = await authedPost('/admin_grading_systems_create', token, input);
  return data.grading_system;
}

export async function updateGradingSystem(
  token: string,
  gradingSystemId: number,
  input: Partial<GradingSystemInput>
): Promise<GradingSystem> {
  const data = await authedPost('/admin_grading_systems_update', token, {
    grading_system_id: gradingSystemId,
    ...input,
  });
  return data.grading_system;
}

// Throws with the backend's exact message when scales still exist under it.
export async function deleteGradingSystem(token: string, gradingSystemId: number): Promise<void> {
  await authedPost('/admin_grading_systems_delete', token, { grading_system_id: gradingSystemId });
}

// --- Grade scales ---

export async function fetchGradeScales(token: string, gradingSystemId: number): Promise<GradeScale[]> {
  const data = await authedPost('/admin_grade_scales_list', token, { grading_system_id: gradingSystemId });
  return data?.grade_scales ?? [];
}

export interface BandInput {
  min_score: number;
  max_score: number;
  label: string;
  gpa_value?: number | null;
  remarks?: string | null;
  is_passing?: boolean;
  honors_eligible?: boolean;
  promotion_eligible?: boolean;
}

// Creates version 1 of a scale under a grading system.
export async function createGradeScale(
  token: string,
  gradingSystemId: number,
  name: string,
  bands: BandInput[],
  effectiveDate?: string | null
): Promise<GradeScale> {
  const data = await authedPost('/admin_grade_scales_create', token, {
    grading_system_id: gradingSystemId,
    name,
    effective_date: effectiveDate ?? null,
    bands,
  });
  return data.grade_scale;
}

// Creates a new version (bands can't be edited in place once a scale
// exists - preserves history for any grade recorded against a version).
export async function createGradeScaleNewVersion(
  token: string,
  gradeScaleId: number,
  bands: BandInput[],
  name?: string | null,
  effectiveDate?: string | null
): Promise<GradeScale> {
  const data = await authedPost('/admin_grade_scales_new_version', token, {
    grade_scale_id: gradeScaleId,
    name: name ?? null,
    effective_date: effectiveDate ?? null,
    bands,
  });
  return data.grade_scale;
}

export async function updateGradeScaleMeta(
  token: string,
  gradeScaleId: number,
  input: { name?: string; effective_date?: string | null; status?: 'active' | 'archived' }
): Promise<GradeScale> {
  const data = await authedPost('/admin_grade_scales_update', token, {
    grade_scale_id: gradeScaleId,
    ...input,
  });
  return data.grade_scale;
}

export async function deleteGradeScale(token: string, gradeScaleId: number): Promise<void> {
  await authedPost('/admin_grade_scales_delete', token, { grade_scale_id: gradeScaleId });
}

// --- Programs (spec §4.3/§4.6) ---

export interface Program {
  id: number;
  school_id: number;
  department_id: number | null;
  name: string;
  name_ar: string | null;
  code: string | null;
  description: string | null;
  duration_terms: number | null;
  head_of_program_id: number | null;
  status: 'active' | 'inactive';
}

export interface ProgramInput {
  name: string;
  name_ar?: string | null;
  code?: string | null;
  description?: string | null;
  department_id?: number | null;
  duration_terms?: number | null;
  status?: 'active' | 'inactive';
}

export async function fetchPrograms(token: string, departmentId?: number | null): Promise<Program[]> {
  const data = await authedPost('/admin_programs_list', token, departmentId ? { department_id: departmentId } : {});
  return data?.programs ?? [];
}

export async function createProgram(token: string, input: ProgramInput): Promise<Program> {
  const data = await authedPost('/admin_programs_create', token, input);
  return data.program;
}

export async function updateProgram(token: string, programId: number, input: Partial<ProgramInput>): Promise<Program> {
  const data = await authedPost('/admin_programs_update', token, { program_id: programId, ...input });
  return data.program;
}

// Throws with the backend's exact message when subjects are still assigned to it.
export async function deleteProgram(token: string, programId: number): Promise<void> {
  await authedPost('/admin_programs_delete', token, { program_id: programId });
}

// --- Subject catalog (spec §4.7) - class_id stays null; assigning a
// catalog subject to an actual class/section is a separate existing flow. ---

export interface Subject {
  id: number;
  school_id: number;
  department_id: number | null;
  program_id: number | null;
  curriculum_id: number | null;
  name: string;
  name_ar: string | null;
  short_name: string | null;
  code: string | null;
  description: string | null;
  units: number | null;
  contact_hours: number | null;
  lecture_hours: number | null;
  laboratory_hours: number | null;
  practical_hours: number | null;
  weekly_hours: number | null;
  passing_score: number | null;
  display_order: number;
  color: string | null;
  status: 'active' | 'inactive';
  prerequisites?: Subject[];
  corequisites?: Subject[];
}

export interface SubjectInput {
  name: string;
  name_ar?: string | null;
  short_name?: string | null;
  code?: string | null;
  description?: string | null;
  department_id?: number | null;
  program_id?: number | null;
  curriculum_id?: number | null;
  units?: number | null;
  contact_hours?: number | null;
  lecture_hours?: number | null;
  laboratory_hours?: number | null;
  practical_hours?: number | null;
  weekly_hours?: number | null;
  passing_score?: number | null;
  display_order?: number | null;
  color?: string | null;
  status?: 'active' | 'inactive';
  prerequisite_subject_ids?: number[];
  corequisite_subject_ids?: number[];
}

export async function fetchSubjectsCatalog(
  token: string,
  filters?: { department_id?: number; program_id?: number; curriculum_id?: number; status?: string }
): Promise<Subject[]> {
  const data = await authedPost('/admin_subjects_catalog_list', token, filters ?? {});
  return data?.subjects ?? [];
}

export async function createSubject(token: string, input: SubjectInput): Promise<Subject> {
  const data = await authedPost('/admin_subjects_catalog_create', token, input);
  return data.subject;
}

export async function updateSubject(token: string, subjectId: number, input: Partial<SubjectInput>): Promise<Subject> {
  const data = await authedPost('/admin_subjects_catalog_update', token, { subject_id: subjectId, ...input });
  return data.subject;
}

// Throws with the backend's exact message when still assigned to a class.
export async function deleteSubject(token: string, subjectId: number): Promise<void> {
  await authedPost('/admin_subjects_catalog_delete', token, { subject_id: subjectId });
}

// --- Lightweight picker sources. Departments/curricula are owned by
// ApiController (admin_departments_list / admin_curricula_list), not this
// controller - these just give the Program/Subject forms a name + id list
// to pick from, same data DepartmentListScreen/CurriculumListScreen show. ---

export interface PickerDepartment {
  id: number;
  name: string;
}

export interface PickerCurriculum {
  id: number;
  name: string;
}

export async function fetchDepartmentsForPicker(token: string): Promise<PickerDepartment[]> {
  const data = await authedPost('/admin_departments_list', token);
  return (data?.departments ?? []).map((d: any) => ({ id: d.id, name: d.name }));
}

export async function fetchCurriculaForPicker(token: string): Promise<PickerCurriculum[]> {
  const data = await authedPost('/admin_curricula_list', token);
  return (data?.curricula ?? []).map((c: any) => ({ id: c.id, name: c.name }));
}
