import { API_BASE_URL, absoluteUrl } from '../config/api';

/**
 * "Create Alumni Account" self-service signup - LoginScreen's Get Started
 * sheet, second option. Unlike school registration, this is scoped to ONE
 * school picked in step 1, and the pending application is reviewed by
 * THAT school's admin (not a superadmin) - a former student of a school
 * is that school's business, not a platform-wide decision.
 *
 * Following this repo's established "ship the frontend, document the
 * contract, backend catches up" convention (see schoolRegistrationService.ts
 * / widgetAnnouncementService.ts) since none of these routes exist yet:
 *
 *   POST /public_school_list   (public) -> { schools: SchoolOption[] }
 *     Lightweight, non-sensitive fields only (id/name/institution_type/
 *     logo) - this is reachable by anyone, logged in or not.
 *
 *   POST /alumni_registration_submit   (public)
 *     fields: school_id, name, email, phone, password, graduation_year,
 *       program (optional), notes (optional)
 *     -> { status: 'pending', registration_id: number }
 *
 *   POST /admin_alumni_registration_list     (admin, scoped server-side to
 *     the calling admin's own school_id - never returns another school's
 *     applications) -> { registrations: PendingAlumniRegistration[] }
 *   POST /admin_alumni_registration_approve   (admin, { id })
 *     -> creates the real User (role: alumni) scoped to the admin's own
 *     school. -> { registration }
 *   POST /admin_alumni_registration_reject    (admin, { id, reason?: string }) -> { registration }
 */
const DEFAULT_TIMEOUT_MS = 15000;

export interface SchoolOption {
  id: number;
  name: string;
  institutionType: string;
  logo: string | null;
}

export interface AlumniRegistrationInput {
  schoolId: number;
  name: string;
  email: string;
  phone?: string;
  password: string;
  graduationYear: number;
  program?: string;
  notes?: string;
}

export type AlumniRegistrationStatus = 'pending' | 'approved' | 'rejected';

export interface PendingAlumniRegistration {
  id: number;
  status: AlumniRegistrationStatus;
  name: string;
  email: string;
  phone: string | null;
  graduation_year: number;
  program: string | null;
  notes: string | null;
  created_at: string;
  reason: string | null;
}

async function postJson(path: string, body: Record<string, any>, token?: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
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

/** POST /public_school_list - unauthenticated, feeds the "pick your school" step. */
export async function fetchSchoolsForRegistration(): Promise<SchoolOption[]> {
  const data = await postJson('/public_school_list', {});
  return (data.schools ?? []).map((s: any) => ({
    id: s.id,
    name: s.name,
    institutionType: s.institution_type,
    logo: absoluteUrl(s.logo ?? null),
  }));
}

/** POST /alumni_registration_submit - unauthenticated, creates a pending application. */
export async function submitAlumniRegistration(input: AlumniRegistrationInput): Promise<{ registrationId: number }> {
  const data = await postJson('/alumni_registration_submit', {
    school_id: input.schoolId,
    name: input.name,
    email: input.email,
    phone: input.phone,
    password: input.password,
    graduation_year: input.graduationYear,
    program: input.program,
    notes: input.notes,
  });
  return { registrationId: data.registration_id };
}

function normalizeRegistration(raw: any): PendingAlumniRegistration {
  return {
    id: raw.id,
    status: raw.status,
    name: raw.name,
    email: raw.email,
    phone: raw.phone ?? null,
    graduation_year: raw.graduation_year,
    program: raw.program ?? null,
    notes: raw.notes ?? null,
    created_at: raw.created_at,
    reason: raw.reason ?? null,
  };
}

/** POST /admin_alumni_registration_list - scoped server-side to the admin's own school. */
export async function fetchPendingAlumniRegistrations(token: string): Promise<PendingAlumniRegistration[]> {
  const data = await postJson('/admin_alumni_registration_list', {}, token);
  return (data.registrations ?? []).map(normalizeRegistration);
}

/** POST /admin_alumni_registration_approve - creates the real alumni User. */
export async function approveAlumniRegistration(token: string, id: number): Promise<PendingAlumniRegistration> {
  const data = await postJson('/admin_alumni_registration_approve', { id }, token);
  return normalizeRegistration(data.registration);
}

/** POST /admin_alumni_registration_reject */
export async function rejectAlumniRegistration(token: string, id: number, reason?: string): Promise<PendingAlumniRegistration> {
  const data = await postJson('/admin_alumni_registration_reject', { id, ...(reason ? { reason } : {}) }, token);
  return normalizeRegistration(data.registration);
}
