import { API_BASE_URL, absoluteUrl } from '../config/api';
import { normalizeReportPhotos } from './orphanService';

export interface TeacherOverview {
  teacher_id: number;
  name: string;
  photo: string | null;
  submitted: boolean;
  submitted_by: string | null;
}

export interface TeacherReportOverview {
  month: string; // "2026-07"
  total_count: number;
  submitted_count: number;
  teachers: TeacherOverview[];
}

export interface TeacherReport {
  id: number;
  report_month: string; // "2026-07-01"
  note: string | null;
  teaching_effectiveness_rating: number | null;
  classroom_engagement_rating: number | null;
  professional_growth_rating: number | null;
  submitted_by: string | null;
  photos: string[];
}

export interface TeacherProfile {
  id: number;
  name: string;
  name_ar?: string | null;
  email: string;
  photo: string | null;
  phone: string | null;
  address: string | null;
  gender: string | null;
  birthday: string | null;
  designation: string | null;
  code: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  signature?: string | null;
}

export interface StaffSummary {
  id: number;
  name: string;
  email: string;
  photo: string | null;
  phone: string | null;
  code: string | null;
  status: number;
}

/** POST /admin_teacher_list - every teacher in the school, for the Staff ID Cards browser. */
export async function fetchTeacherList(token: string): Promise<StaffSummary[]> {
  const data = await authedPost('/admin_teacher_list', token, {});
  const rawList: any[] = data.teachers ?? data.data?.teachers ?? data.data ?? [];
  return rawList.map((r) => ({
    id: r.id,
    name: r.name ?? '',
    email: r.email ?? '',
    photo: absoluteUrl(r.photo ?? null),
    phone: r.phone ?? null,
    code: r.code ?? null,
    status: r.status ?? 1,
  }));
}

// A teacher's core identity fields - name/email/phone/address/gender/birthday,
// plus an optional password reset. `password` is only sent to the backend
// when non-empty, so leaving it blank keeps the teacher's existing password.
export type TeacherBasicProfileFields = Partial<{
  name: string;
  email: string;
  phone: string;
  address: string;
  gender: string;
  birthday: string; // 'YYYY-MM-DD'
  password: string;
}>;

export interface UserDocument {
  id: number;
  title: string;
  file: string;
  created_at: string;
}

// Requests that use file uploads (photos) legitimately take longer than a
// plain JSON POST, so they get a longer allowance before we give up. Mirrors
// adminOrphanReportService.ts so a hung connection can't leave the teacher
// list/overview screens spinning forever with no error and no retry option.
const DEFAULT_TIMEOUT_MS = 15000;
const UPLOAD_TIMEOUT_MS = 45000;

async function authedPost(path: string, token: string, body: FormData | Record<string, any> = {}) {
  const isFormData = body instanceof FormData;

  const controller = new AbortController();
  const timeoutMs = isFormData ? UPLOAD_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        Authorization: `Bearer ${token}`,
      },
      body: isFormData ? body : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timed out. Check your connection and try again.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message ?? `Request failed (${response.status})`);
  }

  return data;
}

/**
 * The backend's exact field name for a teacher's id in this response isn't
 * pinned down yet (API_REFERENCE.md only documents the response shape in
 * prose - "every teacher in the school with submitted: true/false", same
 * pattern as the orphan overview, which uses `student_id`). Reading a few
 * plausible id keys here means the screen keeps working the moment the
 * backend settles on one, without another round of app-side changes.
 */
function normalizeTeacher(raw: any): TeacherOverview {
  return {
    teacher_id: raw.teacher_id ?? raw.id ?? raw.user_id ?? 0,
    name: raw.name ?? '',
    photo: absoluteUrl(raw.photo ?? null),
    submitted: !!raw.submitted,
    submitted_by: raw.submitted_by ?? null,
  };
}

export interface AddTeacherInput {
  name: string;
  name_ar?: string;
  email: string;
  password: string;
  phone?: string;
  address?: string;
  gender?: string;
  designation?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
}

export interface AddedTeacher {
  id: number;
  name: string;
  email: string | null;
  code: string | null;
}

/** POST /admin_teacher_admission_single - admin creates a new teacher account. */
export async function addTeacher(token: string, input: AddTeacherInput): Promise<AddedTeacher> {
  const data = await authedPost('/admin_teacher_admission_single', token, { ...input });
  const record = data.teacher ?? data.data?.teacher ?? data.data ?? data;
  return record as AddedTeacher;
}

/** POST /admin_teacher_report_overview - every teacher in the admin's school
 * plus whether they've submitted this (or a given) month's report. This is
 * the closest thing to a dedicated "teacher list" endpoint today, so it
 * doubles as the roster source for the Teachers card.
 */
export async function fetchTeacherOverview(token: string, month?: string): Promise<TeacherReportOverview> {
  const data = await authedPost('/admin_teacher_report_overview', token, month ? { month } : {});
  const rawList: any[] = data.teachers ?? data.data?.teachers ?? data.data ?? [];
  return {
    month: data.month ?? month ?? '',
    total_count: data.total_count ?? rawList.length,
    submitted_count: data.submitted_count ?? rawList.filter((t) => !!t.submitted).length,
    teachers: rawList.map(normalizeTeacher),
  };
}

/**
 * The backend's exact field name for "who submitted this report" isn't
 * pinned down either - it has shown up as `submitted_by` (a plain name),
 * but also as `submitted_by_name` / `submitter_name` / `created_by_name`
 * in other list endpoints, or as an object ({ name }) instead of a string.
 * Try the plausible shapes so real names show up instead of "unknown"
 * whenever the backend does send one, without another round of changes.
 */
function resolveSubmittedBy(raw: any): string | null {
  const candidate =
    raw.submitted_by ??
    raw.submitted_by_name ??
    raw.submitter_name ??
    raw.submitter ??
    raw.created_by_name ??
    raw.created_by ??
    raw.author_name ??
    null;

  if (candidate && typeof candidate === 'object') {
    return candidate.name ?? candidate.full_name ?? null;
  }
  return candidate ?? null;
}

function normalizeTeacherReport(raw: any): TeacherReport {
  const normalized = normalizeReportPhotos<TeacherReport>(raw);
  return { ...normalized, submitted_by: resolveSubmittedBy(raw) };
}

/**
 * POST /admin_teacher_report_list - full report history for one teacher.
 * Photos are absolutized the same way orphan report photos are, so the
 * detail screen's thumbnails load.
 */
export async function fetchTeacherReports(token: string, teacherId: number): Promise<TeacherReport[]> {
  const data = await authedPost('/admin_teacher_report_list', token, { teacher_id: teacherId });
  const rawList: any[] = data.reports ?? data.data?.reports ?? data.data ?? [];
  return rawList.map(normalizeTeacherReport);
}

/** POST /admin_teacher_profile - a single teacher's basic contact/role info. */
export async function fetchTeacherProfile(token: string, teacherId: number): Promise<TeacherProfile> {
  const data = await authedPost('/admin_teacher_profile', token, { teacher_id: teacherId });
  return {
    id: data.id,
    name: data.name ?? '',
    name_ar: data.name_ar ?? null,
    email: data.email ?? '',
    photo: absoluteUrl(data.photo ?? null),
    phone: data.phone ?? null,
    address: data.address ?? null,
    gender: data.gender ?? null,
    birthday: data.birthday ?? null,
    designation: data.designation ?? null,
    code: data.code ?? null,
    emergency_contact_name: data.emergency_contact_name ?? null,
    emergency_contact_phone: data.emergency_contact_phone ?? null,
    signature: data.signature ? absoluteUrl(data.signature) : null,
  };
}

/**
 * POST /admin_teacher_profile_update - save a teacher's core identity fields
 * (name/email/phone/address/gender/birthday, optional password reset).
 */
export async function updateTeacherProfile(
  token: string,
  teacherId: number,
  fields: TeacherBasicProfileFields,
): Promise<{ message: string }> {
  return authedPost('/admin_teacher_profile_update', token, {
    teacher_id: teacherId,
    ...fields,
  });
}

function normalizeDocument(raw: any): UserDocument {
  return {
    id: raw.id,
    title: raw.title ?? '',
    file: absoluteUrl(raw.file ?? null) ?? raw.file,
    created_at: raw.created_at ?? '',
  };
}

/**
 * POST /admin_user_documents_list - generic: works for a teacher or an
 * orphan/student, since the backend just checks the user_id belongs to the
 * admin's own school. userId here is whichever user's documents you want.
 */
export async function fetchUserDocuments(token: string, userId: number): Promise<UserDocument[]> {
  const data = await authedPost('/admin_user_documents_list', token, { user_id: userId });
  const rawList: any[] = data.documents ?? [];
  return rawList.map(normalizeDocument);
}

/** POST /admin_user_document_upload - multipart: user_id, title, file. */
export async function uploadUserDocument(
  token: string,
  userId: number,
  title: string,
  file: { uri: string; fileName: string | null; type: string | null },
): Promise<UserDocument> {
  const form = new FormData();
  form.append('user_id', String(userId));
  form.append('title', title);
  // @ts-ignore - React Native's FormData accepts this shape for file uploads
  form.append('file', {
    uri: file.uri,
    name: file.fileName ?? `document_${Date.now()}.jpg`,
    type: file.type ?? 'image/jpeg',
  });

  const data = await authedPost('/admin_user_document_upload', token, form);
  return normalizeDocument(data.document);
}

/** POST /admin_user_document_delete - remove a document by id. */
export async function deleteUserDocument(token: string, documentId: number): Promise<void> {
  await authedPost('/admin_user_document_delete', token, { document_id: documentId });
}
