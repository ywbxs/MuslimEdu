import { API_BASE_URL, absoluteUrl } from '../config/api';
import { cacheKeyFor, cacheThenNetwork } from '../utils/offlineCache';

const CACHE_PREFIX = '@teacher_class_cache_v1';

// --- Shared fetch helper (same pattern as adminService.ts / adminTeacherService.ts) ---

function extractRecord(data: any): any {
  if (!data) return null;
  if (data.sections || data.classes || data.students || data.teachers) return data;
  return null;
}

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
    const record = extractRecord(data);
    if (record) return data;
    throw new Error(firstErrorMessage(data) ?? `Request failed (${response.status})`);
  }

  return data;
}

// --- Types ---

export interface ClassSection {
  section_id: number;
  section_name: string;
  class_id: number;
  class_name: string | null;
  student_count?: number;
  // present only on the admin assignment list
  class_teacher_id?: number | null;
  class_teacher_name?: string | null;
}

export interface AssignableTeacher {
  id: number;
  name: string;
}

export interface ClassStudent {
  id: number;
  name: string;
  email: string;
  photo: string | null;
  phone: string | null;
  gender: string | null;
  address: string | null;
}

export interface ClassRoster {
  section_id: number;
  section_name: string;
  class_name: string | null;
  students: ClassStudent[];
}

export interface SubjectOption {
  id: number;
  name: string;
}

export interface RoomOption {
  id: number;
  name: string;
}

export interface SemesterTermOption {
  id: number;
  name: string;
}

export interface ClassSubjectRow {
  id: number;
  subject_id: number;
  subject_name: string | null;
  teacher_id: number | null;
  teacher_name: string | null;
  day_of_week: string | null;
  start_time: string | null;
  end_time: string | null;
  room_id: number | null;
  room_name: string | null;
  semester_term_id: number | null;
  semester_term_name: string | null;
}

export interface DashboardStats {
  departments: number;
  curricula: number;
  classes: number;
  sections: number;
  teachers: number;
  subjects: number;
  students: number;
}

export async function fetchAcademicDashboardStats(token: string): Promise<DashboardStats> {
  return cacheThenNetwork(cacheKeyFor(CACHE_PREFIX, token, 'dashboardStats'), async () => {
    const data = await authedPost('/admin_academic_dashboard_stats', token);
    return {
      departments: data.departments ?? 0,
      curricula: data.curricula ?? 0,
      classes: data.classes ?? 0,
      sections: data.sections ?? 0,
      teachers: data.teachers ?? 0,
      subjects: data.subjects ?? 0,
      students: data.students ?? 0,
    };
  });
}

// --- Admin: class teacher assignment ---

export async function fetchClassTeacherAssignments(
  token: string
): Promise<{ sections: ClassSection[]; teachers: AssignableTeacher[] }> {
  return cacheThenNetwork(cacheKeyFor(CACHE_PREFIX, token, 'teacherAssignments'), async () => {
    const data = await authedPost('/admin_class_teacher_list', token);
    return {
      sections: data.sections ?? [],
      teachers: data.teachers ?? [],
    };
  });
}

export async function assignClassTeacher(
  token: string,
  sectionId: number,
  teacherId: number | null
): Promise<void> {
  await authedPost('/admin_class_teacher_assign', token, {
    section_id: sectionId,
    teacher_id: teacherId,
  });
}

// --- Teacher: my classes & roster ---

export async function fetchMyClasses(token: string): Promise<ClassSection[]> {
  return cacheThenNetwork(cacheKeyFor(CACHE_PREFIX, token, 'myClasses'), async () => {
    const data = await authedPost('/teacher_my_classes', token);
    return data.classes ?? [];
  });
}

export async function fetchClassStudents(token: string, sectionId: number): Promise<ClassRoster> {
  return cacheThenNetwork(cacheKeyFor(CACHE_PREFIX, token, 'classStudents', sectionId), async () => {
    const data = await authedPost('/teacher_class_students', token, { section_id: sectionId });
    const students: any[] = data.students ?? [];
    return {
      section_id: data.section_id,
      section_name: data.section_name,
      class_name: data.class_name ?? null,
      students: students.map((s) => ({
        ...s,
        photo: absoluteUrl(s.photo ?? null),
      })),
    };
  });
}

// --- Admin: section enrollment (roster management) ---
// Distinct from fetchClassStudents/teacher_class_students above, which only
// works for the teacher actually assigned to that section. These hit the
// admin_section_* endpoints instead, scoped by school ownership.

export interface SectionEnrolledStudent {
  id: number;
  name: string;
  email: string;
  photo: string | null;
  phone?: string | null;
  gender?: string | null;
}

export interface SectionRoster {
  section_id: number;
  section_name: string;
  class_id: number;
  class_name: string | null;
  capacity: number | null;
  current_enrollment: number;
  available_slots: number | null;
  students: SectionEnrolledStudent[];
}

export interface EligibleStudent {
  id: number;
  name: string;
  email: string;
  photo: string | null;
  current_class_id: number | null;
  current_section_id: number | null;
}

export async function fetchSectionRoster(token: string, sectionId: number): Promise<SectionRoster> {
  return cacheThenNetwork(cacheKeyFor(CACHE_PREFIX, token, 'sectionRoster', sectionId), async () => {
    const data = await authedPost('/admin_section_students', token, { section_id: sectionId });
    const students: any[] = data.students ?? [];
    return {
      section_id: data.section_id,
      section_name: data.section_name,
      class_id: data.class_id,
      class_name: data.class_name ?? null,
      capacity: data.capacity ?? null,
      current_enrollment: data.current_enrollment ?? students.length,
      available_slots: data.available_slots ?? null,
      students: students.map((s) => ({ ...s, photo: absoluteUrl(s.photo ?? null) })),
    };
  });
}

export async function fetchEligibleStudents(
  token: string,
  sectionId: number,
  search: string = ''
): Promise<EligibleStudent[]> {
  const data = await authedPost('/admin_section_eligible_students', token, { section_id: sectionId, search });
  const students: any[] = data.students ?? [];
  return students.map((s) => ({ ...s, photo: absoluteUrl(s.photo ?? null) }));
}

export async function addStudentsToSection(
  token: string,
  sectionId: number,
  studentIds: number[]
): Promise<{ added: number; message: string }> {
  const data = await authedPost('/admin_section_add_students', token, {
    section_id: sectionId,
    student_ids: studentIds,
  });
  return { added: data.added ?? studentIds.length, message: data.message ?? 'Students enrolled.' };
}

export async function removeStudentFromSection(token: string, sectionId: number, studentId: number): Promise<void> {
  await authedPost('/admin_section_remove_student', token, { section_id: sectionId, student_id: studentId });
}

export async function transferStudentToSection(
  token: string,
  studentId: number,
  toSectionId: number
): Promise<void> {
  await authedPost('/admin_section_transfer_student', token, { student_id: studentId, to_section_id: toSectionId });
}

export interface SectionOption {
  id: number;
  name: string;
  class_id: number;
  class_name: string | null;
  capacity: number | null;
  current_enrollment: number;
}

// All active sections, for the "transfer to..." picker - a lighter-weight read
// than SectionListScreen's own admin_sections_list call (no status/search filters).
export async function fetchAllSections(token: string): Promise<SectionOption[]> {
  return cacheThenNetwork(cacheKeyFor(CACHE_PREFIX, token, 'allSections'), async () => {
    const data = await authedPost('/admin_sections_list', token, { status: 'active' });
    const sections: any[] = data.sections ?? [];
    return sections.map((s) => ({
      id: s.id,
      name: s.name,
      class_id: s.class_id,
      class_name: s.class_name ?? null,
      capacity: s.capacity ?? null,
      current_enrollment: s.current_enrollment ?? 0,
    }));
  });
}

// --- Admin: subjects & schedule per class ---

export async function fetchClassSubjects(
  token: string,
  sectionId: number
): Promise<{
  sectionName: string | null;
  classSubjects: ClassSubjectRow[];
  subjects: SubjectOption[];
  teachers: AssignableTeacher[];
  rooms: RoomOption[];
  semesterTerms: SemesterTermOption[];
}> {
  return cacheThenNetwork(cacheKeyFor(CACHE_PREFIX, token, 'classSubjects', sectionId), async () => {
    const data = await authedPost('/admin_class_subjects_list', token, { section_id: sectionId });
    return {
      sectionName: data.section_name ?? null,
      classSubjects: data.class_subjects ?? [],
      subjects: data.subjects ?? [],
      teachers: data.teachers ?? [],
      rooms: data.rooms ?? [],
      semesterTerms: data.semester_terms ?? [],
    };
  });
}

export async function createSubject(token: string, sectionId: number, name: string): Promise<SubjectOption> {
  const data = await authedPost('/admin_subject_create', token, { section_id: sectionId, name });
  return data.subject;
}

export async function assignClassSubject(
  token: string,
  payload: {
    sectionId: number;
    subjectId: number;
    teacherId: number | null;
    dayOfWeek: string | null;
    startTime: string | null;
    endTime: string | null;
    roomId: number | null;
    semesterTermId: number | null;
  }
): Promise<void> {
  await authedPost('/admin_class_subject_assign', token, {
    section_id: payload.sectionId,
    subject_id: payload.subjectId,
    teacher_id: payload.teacherId,
    day_of_week: payload.dayOfWeek,
    start_time: payload.startTime,
    end_time: payload.endTime,
    room_id: payload.roomId,
    semester_term_id: payload.semesterTermId,
  });
}

export async function removeClassSubject(token: string, sectionId: number, subjectId: number): Promise<void> {
  await authedPost('/admin_class_subject_remove', token, { section_id: sectionId, subject_id: subjectId });
}
