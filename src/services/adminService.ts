import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, absoluteUrl } from '../config/api';
import { OrphanProfile } from './authService';
import { PickedPhoto } from './orphanService';

// Per-account cache of the last successfully fetched full student list (no
// search term only - see fetchStudents below), so the admin's bulk ID-cards
// browser still works offline with the last-known roster - same
// cache-then-network pattern as academicScheduleService.ts's fetchMySchedule.
const STUDENTS_CACHE_PREFIX = '@students_cache_v1';

function studentsCacheKey(token: string): string {
  return `${STUDENTS_CACHE_PREFIX}:${token.slice(-12)}`;
}

// Matches the dot/chip states StudentListScreen renders per child. The
// backend field this reads from isn't confirmed yet (see normalizeStudent
// below), so it always falls back to 'active' rather than leaving the UI
// with an unrenderable state.
export type ChildStatus = 'active' | 'pending' | 'inactive';

export interface StudentSummary {
  id: number;
  name: string;
  name_ar?: string | null;
  email: string;
  photo: string | null;
  code?: string | null;
  class_id: number | null;
  class_name?: string | null;
  section_id: number | null;
  section_name?: string | null;
  room_number?: string | null;
  adviser_name?: string | null;
  orphan_id_number: string | null;
  status?: ChildStatus;
  joined_date?: string | null;
  phone?: string | null;
  address?: string | null;
  gender?: string | null;
  birthday?: string | null;
}

/**
 * Full profile payload for one child - what /admin_child_profile returns.
 * Extends the list-row shape (StudentSummary) with the extra detail only
 * the single-record endpoint sends: the nested orphan-only record
 * (guardian, health, admission info), null for non-orphan schools, plus
 * the ID-card-only fields (emergency contact, signature).
 */
export interface ChildProfile extends StudentSummary {
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  signature?: string | null;
  orphan_profile?: OrphanProfile | null;
}

export interface AdmissionInput {
  name: string;
  name_ar?: string;
  email?: string;
  password?: string;
  phone?: string;
  code?: string;
  class_id?: string;
  section_id?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  address?: string;
  gender?: string;
  birthday?: string; // 'YYYY-MM-DD'
  // Orphan-profile fields. The backend only persists these when the admin's
  // school is orphanage-type (a school-level setting - see AuthUser.is_orphan),
  // but it's harmless to send them either way.
  guardian_name?: string;
  guardian_relation?: string;
  guardian_phone?: string;
  health_status?: string;
  special_needs?: string;
  admission_date?: string;
  admission_reason?: string;
}

export interface AdmittedStudent {
  id: number;
  name: string;
  email: string | null;
  code: string | null;
}

export interface ClassOption {
  id: number;
  name: string;
}

export interface SectionOption {
  id: number;
  name: string;
}

// Digs a plausible "record" payload out of a response body regardless of
// which wrapper shape the API used (`{student:{...}}`, `{data:{...}}`,
// `{data:{student:{...}}}`, or the record inlined at the top level).
function extractRecord(data: any): Record<string, any> | null {
  if (!data || typeof data !== 'object') return null;
  const candidates = [data.student, data.data?.student, data.data, data];
  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object' && ('id' in candidate || 'name' in candidate)) {
      return candidate;
    }
  }
  return null;
}

function firstErrorMessage(data: any): string | null {
  if (!data || typeof data !== 'object') return null;
  if (data.errors && typeof data.errors === 'object') {
    const first = Object.values(data.errors)[0];
    if (Array.isArray(first)) return (first[0] as string) ?? null;
    if (typeof first === 'string') return first;
  }
  if (typeof data.errors === 'string') return data.errors;
  if (typeof data.message === 'string') return data.message;
  if (typeof data.error === 'string') return data.error;
  return null;
}

/**
 * Bug fix: this previously threw "Could not admit student" any time the HTTP
 * status wasn't in the 200-299 range - but some admission requests (notably
 * ones with a large photo attached) were coming back with a non-2xx status
 * from a *secondary* step (e.g. generating the photo thumbnail) that failed
 * *after* the student row had already been committed on the server. From the
 * app's point of view that looked identical to a real failure, so the admin
 * saw an error alert for a student who had, in fact, already been added.
 *
 * Response handling now checks for an actual created-record payload (an
 * object with an `id` or `name`) in the body first. If one is present, the
 * request is treated as a success no matter what the HTTP status or wrapper
 * shape was - a row we can see in the response is a row that exists. Only
 * when no record is present do we fall back to raising an error, and that
 * error message is pulled from `errors` / `message` / `error` in whatever
 * shape the backend used, so genuine validation failures still read clearly.
 */
async function authedPost(path: string, token: string, body: FormData | Record<string, any> = {}) {
  const isFormData = body instanceof FormData;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      Authorization: `Bearer ${token}`,
    },
    body: isFormData ? body : JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const record = extractRecord(data);
    if (record) {
      // A record came back even though the status suggested failure - treat
      // it as a success rather than surfacing a false "could not admit".
      return data;
    }
    throw new Error(firstErrorMessage(data) ?? `Request failed (${response.status})`);
  }

  return data;
}

/**
 * POST /admin_children_list - all children in the admin's school.
 * There's no separate "orphans only" endpoint: an admin's school is either
 * entirely regular or entirely an orphanage (school-level, not per-child),
 * so this single list already is the right one for orphanage admins.
 *
 * Photos are absolutized here so the list avatars actually load.
 */
export async function fetchStudents(token: string, search: string = ''): Promise<StudentSummary[]> {
  // Only the full (no-search) list is cached for offline fallback - it's
  // the one the admin's bulk ID-cards browser depends on; a filtered search
  // needs live results and simply throws like before if offline.
  const cacheKey = !search ? studentsCacheKey(token) : null;
  try {
    const data = await authedPost('/admin_children_list', token, { search });
    const children: any[] = data.children ?? [];
    const students: StudentSummary[] = children.map((c) => ({
      ...c,
      photo: absoluteUrl(c.photo),
      // The list endpoint's exact status field isn't pinned down yet, so this
      // reads a couple of plausible keys and otherwise defaults to 'active'
      // (every child not explicitly flagged pending/inactive shows as active,
      // rather than the status chip rendering blank/undefined).
      status: (c.status ?? c.admission_status ?? 'active') as ChildStatus,
      joined_date: c.joined_date ?? c.admission_date ?? c.created_at ?? null,
    }));
    if (cacheKey) {
      AsyncStorage.setItem(cacheKey, JSON.stringify(students)).catch(() => {
        // Best-effort cache write - losing it just means a future offline
        // load falls back further (or throws), not that this call fails.
      });
    }
    return students;
  } catch (err) {
    if (cacheKey) {
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) return JSON.parse(cached) as StudentSummary[];
      } catch {
        // Fall through to rethrow the original network error.
      }
    }
    throw err;
  }
}

export interface OrphanProfileFull extends OrphanProfile {}

export type OrphanProfileFields = Partial<{
  guardian_name: string;
  guardian_relation: string;
  guardian_phone: string;
  health_status: string;
  special_needs: string;
  admission_date: string;
  admission_reason: string;
}>;

// A child's core identity fields - name/email/phone/address/gender/birthday,
// plus an optional password reset. `password` is only sent to the backend
// when non-empty, so leaving it blank keeps the child's existing password.
export type BasicProfileFields = Partial<{
  name: string;
  email: string;
  phone: string;
  address: string;
  gender: string;
  birthday: string; // 'YYYY-MM-DD'
  password: string;
}>;

/**
 * POST /admin_child_profile - a single child's full profile (basic info +
 * class/section + the nested orphan_profile record). Normalized the same
 * way fetchStudents() is: photo absolutized, status defaulted, and the
 * response's wrapper shape (`{...fields}` inline vs `{data:{...}}` vs
 * `{child:{...}}`) resolved to a flat ChildProfile so callers never have to
 * guess which key the record landed under.
 */
export async function fetchChildProfile(token: string, studentId: number): Promise<ChildProfile> {
  const data = await authedPost('/admin_child_profile', token, { student_id: studentId });
  const record = extractRecord(data) ?? data;
  return {
    ...record,
    photo: absoluteUrl(record.photo ?? null),
    signature: record.signature ? absoluteUrl(record.signature) : null,
    status: (record.status ?? record.admission_status ?? 'active') as ChildStatus,
    joined_date: record.joined_date ?? record.admission_date ?? record.created_at ?? null,
    orphan_profile: record.orphan_profile ?? null,
  } as ChildProfile;
}

/**
 * POST /admin_child_orphan_profile_update - save orphan-specific fields
 * (guardian + health + admission info) for a child. This is the only
 * profile-edit endpoint currently confirmed on the backend, which is why
 * the edit screen only lets an admin change these fields - a child's core
 * identity fields (name/email/phone/class) stay read-only in the app until
 * a dedicated basic-info update endpoint exists.
 */
export async function updateOrphanProfile(
  token: string,
  studentId: number,
  fields: OrphanProfileFields,
): Promise<{ message: string }> {
  return authedPost('/admin_child_orphan_profile_update', token, {
    student_id: studentId,
    ...fields,
  });
}

/**
 * POST /admin_child_basic_profile_update - save a child's core identity
 * fields (name/email/phone/address/gender/birthday, optional password reset).
 * Separate from updateOrphanProfile since these live on the users table /
 * user_information JSON, not the orphan_profiles table.
 */
export async function updateChildBasicProfile(
  token: string,
  studentId: number,
  fields: BasicProfileFields,
): Promise<{ message: string }> {
  return authedPost('/admin_child_basic_profile_update', token, {
    student_id: studentId,
    ...fields,
  });
}

/**
 * POST /admin_admission_single - admit one student. The profile photo is
 * now required, so this always sends multipart form data (the backend reads
 * the file via $request->hasFile('photo')).
 */
export async function admitStudent(
  token: string,
  input: AdmissionInput,
  photo: PickedPhoto,
  signature?: PickedPhoto | null,
): Promise<AdmittedStudent> {
  const form = new FormData();
  Object.entries(input).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    form.append(key, String(value));
  });
  // @ts-ignore - React Native's FormData accepts this shape for file uploads
  form.append('photo', {
    uri: photo.uri,
    name: photo.fileName ?? 'profile.jpg',
    type: photo.type ?? 'image/jpeg',
  });
  if (signature) {
    // @ts-ignore - same file-upload shape as `photo` above.
    form.append('signature', {
      uri: signature.uri,
      name: signature.fileName ?? 'signature.png',
      type: signature.type ?? 'image/png',
    });
  }

  try {
    const data = await authedPost('/admin_admission_single', token, form);
    const record = data.student ?? data.data?.student ?? data.data ?? data;
    return record as AdmittedStudent;
  } catch (err) {
    // authedPost already treats "error status but a record is in the body"
    // as success - but the backend sometimes returns an error response with
    // NO record at all (e.g. thumbnail generation throws after the student
    // row is already committed), which looks identical to a real failure.
    // As a last resort, check whether a student matching what was just
    // submitted now exists in the roster before surfacing the error.
    const found = await findJustAdmittedStudent(token, input).catch(() => null);
    if (found) return found;
    throw err;
  }
}

/**
 * Looks for a student in the admin's roster matching what was just
 * submitted to admitStudent, preferring the most specific identifying field
 * available (code, then email, then exact name match). Only used after the
 * admission request itself appears to have failed, to tell "actually
 * failed" apart from "succeeded but the error response didn't say so".
 */
async function findJustAdmittedStudent(
  token: string,
  input: AdmissionInput,
): Promise<AdmittedStudent | null> {
  const search = input.code || input.email || input.name || '';
  if (!search) return null;
  const students = await fetchStudents(token, search);
  const match =
    (input.code && students.find((s) => s.code === input.code)) ||
    (input.email && students.find((s) => s.email === input.email)) ||
    students.find((s) => s.name === input.name);
  if (!match) return null;
  return { id: match.id, name: match.name, email: match.email, code: match.code ?? null };
}

/**
 * POST /admin_set_school_code - one-time setup that locks in this school's
 * student-code prefix (letters + number, e.g. "MLP" + "2648" -> "MLP2648").
 * Called from SchoolCodeSetupScreen, which is what a fresh orphan admin sees
 * instead of the dashboard cards until this succeeds.
 *
 * NOTE: `/admin_set_school_code` is a placeholder route name - it doesn't
 * exist on the backend yet. Wire this up to whatever endpoint the Laravel
 * side ends up exposing for saving a school-level setting (it should persist
 * `school_code` on the school/admin record and return it back, or reject if
 * it's already been set so it truly stays locked after the first save).
 */
export async function setSchoolCode(
  token: string,
  letters: string,
  number: string,
): Promise<{ school_code: string }> {
  const data = await authedPost('/admin_set_school_code', token, { letters, number });
  const record = extractRecord(data) ?? data;
  const school_code = (record?.school_code as string) ?? `${letters}${number}`;
  return { school_code };
}

/** POST /admin_class_list - classes for the admission form's Class picker. */
export async function fetchClasses(token: string): Promise<ClassOption[]> {
  const data = await authedPost('/admin_class_list', token, {});
  return (data.classes ?? data.data ?? data ?? []) as ClassOption[];
}

/** POST /admin_section_list - sections, optionally scoped to a class. */
export async function fetchSections(
  token: string,
  classId?: string,
): Promise<SectionOption[]> {
  const data = await authedPost(
    '/admin_section_list',
    token,
    classId ? { class_id: classId } : {},
  );
  return (data.sections ?? data.data ?? data ?? []) as SectionOption[];
}

// --- Full class management (admin_classes_* - distinct from the
// admin_class_list picker above; see CreateClassScreen.tsx) --------------

export interface NamedOption {
  id: number;
  name: string;
}

export interface ClassReferenceData {
  departments: NamedOption[];
  campuses: NamedOption[];
  curricula: NamedOption[];
  school_years: { id: number; title?: string; name?: string }[];
  semester_terms: NamedOption[];
}

export type ClassShift = 'morning' | 'afternoon' | 'evening';
export type ClassType = 'face-to-face' | 'online' | 'hybrid';
export type ClassStatus = 'active' | 'pending' | 'closed' | 'archived';

export interface ClassRecord {
  id: number;
  class_code: string;
  name: string;
  grade_level: number;
  section: string | null;
  school_year_id: number | null;
  department_id: number | null;
  campus_id: number | null;
  curriculum_id: number | null;
  semester_term_id: number | null;
  room_number: string | null;
  building: string | null;
  floor: string | null;
  shift: ClassShift;
  class_type: ClassType;
  max_capacity: number;
  description: string | null;
  status: ClassStatus;
  start_date: string;
  end_date: string;
}

export interface ClassInput {
  class_code: string;
  name: string;
  grade_level: number;
  section?: string | null;
  school_year_id: number;
  department_id?: number | null;
  campus_id?: number | null;
  curriculum_id?: number | null;
  semester_term_id?: number | null;
  room_number?: string | null;
  building?: string | null;
  floor?: string | null;
  shift: ClassShift;
  class_type: ClassType;
  max_capacity: number;
  description?: string | null;
  status: ClassStatus;
  start_date: string;
  end_date: string;
}

/** POST /admin_classes_reference_data - pickers for the class wizard. */
export async function fetchClassReferenceData(token: string): Promise<ClassReferenceData> {
  const data = await authedPost('/admin_classes_reference_data', token, {});
  return {
    departments: data.departments ?? [],
    campuses: data.campuses ?? [],
    curricula: data.curricula ?? [],
    school_years: data.school_years ?? [],
    semester_terms: data.semester_terms ?? [],
  };
}

/** POST /admin_classes_detail - one class record, for editing. */
export async function fetchClassRecordDetail(token: string, classId: number): Promise<ClassRecord> {
  const data = await authedPost('/admin_classes_detail', token, { class_id: classId });
  return data.class as ClassRecord;
}

export async function createClassRecord(token: string, input: ClassInput): Promise<ClassRecord> {
  const data = await authedPost('/admin_classes_create', token, input);
  return data.class as ClassRecord;
}

export async function updateClassRecord(
  token: string,
  classId: number,
  input: ClassInput,
): Promise<ClassRecord> {
  const data = await authedPost('/admin_classes_update', token, { class_id: classId, ...input });
  return data.class as ClassRecord;
}
