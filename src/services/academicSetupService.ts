import { API_BASE_URL, absoluteUrl } from '../config/api';

// --- Shared fetch helper (same pattern as adminAttendanceService.ts) ---

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

async function authedRequest(path: string, token: string, body: FormData | Record<string, any> = {}) {
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
    throw new Error(firstErrorMessage(data) ?? `Request failed (${response.status})`);
  }

  return data;
}

// --- Types ---

export type InstitutionType = 'mahad' | 'madrasa' | 'markaz' | 'regular_school' | 'orphanage';
export type CalendarType = 'gregorian' | 'hijri' | 'dual';
export type AcademicYearStructure = 'semester' | 'trimester' | 'quarter' | 'continuous' | 'custom';

export interface SchoolProfile {
  id: number;
  name: string | null;
  name_ar: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  description: string | null;
  institution_type: InstitutionType | null;
  logo: string | null;
  seal: string | null;
  id_card_background: string | null;
  timezone: string | null;
  default_language: string | null;
  secondary_language: string | null;
  calendar_type: CalendarType | null;
  working_days: number[] | null;
  school_hours_start: string | null;
  school_hours_end: string | null;
  academic_year_structure: AcademicYearStructure | null;
  setup_completed: boolean;
  setup_completed_at: string | null;
  academic_system_version: number;
}

export interface SetupStatus {
  school: SchoolProfile;
  sessions_count: number;
  institution_types: InstitutionType[];
  calendar_types: CalendarType[];
  academic_year_structures: AcademicYearStructure[];
}

export interface AcademicYear {
  id: number;
  session_title: string;
  status: number; // 1 = current
  school_id: number;
}

export interface AcademicTerm {
  id: number;
  school_id: number;
  session_id: number;
  name: string;
  term_type: AcademicYearStructure;
  order: number;
  start_date: string | null;
  end_date: string | null;
  enrollment_start: string | null;
  enrollment_end: string | null;
  grading_start: string | null;
  grading_end: string | null;
  exam_start: string | null;
  exam_end: string | null;
  closure_date: string | null;
  is_current: boolean;
  status: 'active' | 'archived';
}

function normalizeSchool(school: SchoolProfile): SchoolProfile {
  return {
    ...school,
    logo: absoluteUrl(school.logo),
    seal: absoluteUrl(school.seal),
    id_card_background: absoluteUrl(school.id_card_background),
  };
}

// --- Setup Wizard / Institution Profile ---

export async function fetchSetupStatus(token: string): Promise<SetupStatus> {
  const data = await authedRequest('/admin_school_setup_status', token);
  return { ...data, school: normalizeSchool(data.school) };
}

export interface InstitutionProfileInput {
  name?: string;
  name_ar?: string;
  email?: string;
  phone?: string;
  address?: string;
  description?: string | null;
  institution_type?: InstitutionType;
  timezone?: string;
  default_language?: string;
  secondary_language?: string;
  calendar_type?: CalendarType;
  working_days?: number[];
  school_hours_start?: string;
  school_hours_end?: string;
  academic_year_structure?: AcademicYearStructure;
  logo?: { uri: string; fileName?: string; type?: string } | null;
  seal?: { uri: string; fileName?: string; type?: string } | null;
  id_card_background?: { uri: string; fileName?: string; type?: string } | null;
}

export async function saveInstitutionProfile(
  token: string,
  input: InstitutionProfileInput,
): Promise<SchoolProfile> {
  const hasFiles = !!input.logo || !!input.seal || !!input.id_card_background;

  if (hasFiles) {
    const form = new FormData();
    Object.entries(input).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      if (key === 'logo' || key === 'seal' || key === 'id_card_background') return;
      if (key === 'working_days' && Array.isArray(value)) {
        value.forEach((day) => form.append('working_days[]', String(day)));
        return;
      }
      form.append(key, String(value));
    });
    if (input.logo) {
      // @ts-ignore - React Native FormData file shape
      form.append('logo', { uri: input.logo.uri, name: input.logo.fileName ?? 'logo.jpg', type: input.logo.type ?? 'image/jpeg' });
    }
    if (input.seal) {
      // @ts-ignore
      form.append('seal', { uri: input.seal.uri, name: input.seal.fileName ?? 'seal.jpg', type: input.seal.type ?? 'image/jpeg' });
    }
    if (input.id_card_background) {
      // @ts-ignore
      form.append('id_card_background', {
        uri: input.id_card_background.uri,
        name: input.id_card_background.fileName ?? 'id_card_background.jpg',
        type: input.id_card_background.type ?? 'image/jpeg',
      });
    }
    const data = await authedRequest('/admin_school_profile_update', token, form);
    return normalizeSchool(data.school);
  }

  const data = await authedRequest('/admin_school_profile_update', token, input as Record<string, any>);
  return normalizeSchool(data.school);
}

export interface SchoolBranding {
  name: string | null;
  logo: string | null;
  id_card_background: string | null;
}

/**
 * POST /my_school_branding - unlike every other function in this file,
 * NOT admin-only: any authenticated role can call this to get their own
 * school's name/logo/ID-card background, so a student's own ID card
 * screen can render the same custom background an admin uploaded via
 * saveInstitutionProfile() without needing admin access to the full
 * setup payload.
 */
export async function fetchMySchoolBranding(token: string): Promise<SchoolBranding> {
  const data = await authedRequest('/my_school_branding', token);
  return {
    name: data.name ?? null,
    logo: absoluteUrl(data.logo ?? null),
    id_card_background: absoluteUrl(data.id_card_background ?? null),
  };
}

export async function completeSetup(token: string): Promise<SchoolProfile> {
  const data = await authedRequest('/admin_school_setup_complete', token);
  return normalizeSchool(data.school);
}

// --- Academic Years ---

export async function fetchAcademicYears(token: string): Promise<AcademicYear[]> {
  const data = await authedRequest('/admin_sessions_list', token);
  return data.sessions ?? [];
}

export async function createAcademicYear(
  token: string,
  sessionTitle: string,
  setCurrent: boolean = false,
): Promise<AcademicYear> {
  const data = await authedRequest('/admin_sessions_create', token, {
    session_title: sessionTitle,
    set_current: setCurrent,
  });
  return data.session;
}

export async function updateAcademicYear(token: string, sessionId: number, sessionTitle: string): Promise<AcademicYear> {
  const data = await authedRequest('/admin_sessions_update', token, { session_id: sessionId, session_title: sessionTitle });
  return data.session;
}

export async function setCurrentAcademicYear(token: string, sessionId: number): Promise<AcademicYear> {
  const data = await authedRequest('/admin_sessions_set_current', token, { session_id: sessionId });
  return data.session;
}

export async function deleteAcademicYear(token: string, sessionId: number): Promise<void> {
  await authedRequest('/admin_sessions_delete', token, { session_id: sessionId });
}

// --- Academic Terms ---

export async function fetchAcademicTerms(token: string, sessionId?: number): Promise<AcademicTerm[]> {
  const data = await authedRequest('/admin_academic_terms_list', token, sessionId ? { session_id: sessionId } : {});
  return data.terms ?? [];
}

export type TermInput = Partial<Omit<AcademicTerm, 'id' | 'school_id' | 'is_current' | 'status'>> & {
  session_id: number;
  name: string;
  term_type: AcademicYearStructure;
  set_current?: boolean;
};

export async function createAcademicTerm(token: string, input: TermInput): Promise<AcademicTerm> {
  const data = await authedRequest('/admin_academic_terms_create', token, input as Record<string, any>);
  return data.term;
}

export async function updateAcademicTerm(token: string, termId: number, input: Partial<TermInput>): Promise<AcademicTerm> {
  const data = await authedRequest('/admin_academic_terms_update', token, { term_id: termId, ...input });
  return data.term;
}

export async function setCurrentAcademicTerm(token: string, termId: number): Promise<AcademicTerm> {
  const data = await authedRequest('/admin_academic_terms_set_current', token, { term_id: termId });
  return data.term;
}

export async function deleteAcademicTerm(token: string, termId: number): Promise<void> {
  await authedRequest('/admin_academic_terms_delete', token, { term_id: termId });
}
