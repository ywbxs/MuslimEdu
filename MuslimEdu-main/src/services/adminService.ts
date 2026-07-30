import { API_BASE_URL, absoluteUrl } from '../config/api';
import { OrphanProfile } from './authService';

export type ChildStatus = 'active' | 'pending' | 'inactive';

export interface StudentSummary {
  id: number;
  name: string;
  email: string;
  photo: string | null;
  class_id: number | null;
  section_id: number | null;
  orphan_id_number: string | null;
  // --- Optional fields for the redesigned Children list (status dot + "Joined" chip).
  // The live /admin_children_list endpoint may not send these yet - see
  // deriveStatus() below for the fallback used when they're absent, and the
  // chat writeup for the backend fields to add so these render accurately.
  joined_date?: string | null;
  is_active?: boolean | null;
  status?: ChildStatus | null;
}

/** Fills in a display-safe status from whatever the backend actually sent. */
function deriveStatus(raw: { status?: ChildStatus | null; is_active?: boolean | null }): ChildStatus {
  if (raw.status === 'active' || raw.status === 'pending' || raw.status === 'inactive') return raw.status;
  if (raw.is_active === false) return 'inactive';
  return 'active';
}

function normalizeStudent(c: StudentSummary): StudentSummary {
  return { ...c, photo: absoluteUrl(c.photo), status: deriveStatus(c) };
}

export interface AdmissionInput {
  name: string;
  email?: string;
  phone?: string;
  guardian_name?: string;
  class_id?: string;
  section_id?: string;
  code?: string;
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
    // Surface Laravel validation errors nicely (422 responses put them under `errors`).
    const firstError =
      data?.errors && typeof data.errors === 'object'
        ? (Object.values(data.errors)[0] as string[])?.[0]
        : null;
    throw new Error(firstError ?? data?.message ?? `Request failed (${response.status})`);
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
  const data = await authedPost('/admin_children_list', token, { search });
  const children: StudentSummary[] = data.children ?? [];
  return children.map(normalizeStudent);
}

export interface OrphanProfileFull extends OrphanProfile {}

/** Full profile shown in the Children list's bottom-sheet detail view. */
export interface ChildProfile extends StudentSummary {
  class_name?: string | null;
  section_name?: string | null;
  phone?: string | null;
  orphan_profile?: OrphanProfileFull | null;
}

function normalizeChildProfile(raw: any): ChildProfile {
  const flat = raw?.student ?? raw?.data ?? raw ?? {};
  // Some backend responses nest orphan fields, some flatten them onto the
  // student record directly - accept either shape.
  const orphan_profile: OrphanProfileFull | null =
    flat.orphan_profile ??
    (flat.guardian_name != null || flat.admission_date != null
      ? {
          orphan_id_number: flat.orphan_id_number ?? null,
          guardian_name: flat.guardian_name ?? null,
          guardian_relation: flat.guardian_relation ?? null,
          guardian_phone: flat.guardian_phone ?? null,
          health_status: flat.health_status ?? null,
          special_needs: flat.special_needs ?? null,
          admission_date: flat.admission_date ?? null,
          admission_reason: flat.admission_reason ?? null,
        }
      : null);

  return {
    ...normalizeStudent(flat),
    class_name: flat.class_name ?? flat.class?.name ?? null,
    section_name: flat.section_name ?? flat.section?.name ?? null,
    phone: flat.phone ?? flat.guardian_phone ?? null,
    joined_date: flat.joined_date ?? flat.admission_date ?? orphan_profile?.admission_date ?? null,
    orphan_profile,
  };
}

/** POST /admin_child_profile - a single child's full profile */
export async function fetchChildProfile(token: string, studentId: number): Promise<ChildProfile> {
  const data = await authedPost('/admin_child_profile', token, { student_id: studentId });
  return normalizeChildProfile(data);
}

/** POST /admin_child_orphan_profile_update - save orphan-specific fields for a child */
export async function updateOrphanProfile(
  token: string,
  studentId: number,
  fields: Partial<{
    guardian_name: string;
    guardian_relation: string;
    guardian_phone: string;
    health_status: string;
    special_needs: string;
    admission_date: string;
    admission_reason: string;
  }>,
) {
  return authedPost('/admin_child_orphan_profile_update', token, {
    student_id: studentId,
    ...fields,
  });
}

/** POST /admin_admission_single - admit one student. */
export async function admitStudent(
  token: string,
  input: AdmissionInput,
): Promise<AdmittedStudent> {
  const data = await authedPost('/admin_admission_single', token, input);
  return (data.student ?? data.data ?? data) as AdmittedStudent;
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
