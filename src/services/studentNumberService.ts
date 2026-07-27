import { API_BASE_URL } from '../config/api';

// --- Shared fetch helper (same pattern as academicSetupService.ts) ---

function firstErrorMessage(data: any): string | null {
  if (!data) return null;
  if (typeof data.message === 'string') return data.message;
  if (typeof data.error === 'string') return data.error;
  if (data.errors && typeof data.errors === 'object') {
    const first = Object.values(data.errors)[0];
    if (Array.isArray(first) && typeof first[0] === 'string') return first[0];
    if (typeof first === 'string') return first;
  }
  return null;
}

async function authedRequest(path: string, token: string, body: Record<string, any> = {}) {
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

/**
 * Every segment the number can be built from. The backend owns this list
 * (StudentNumberGenerator::SEGMENTS) and ships it back in `segments`, so the
 * screen renders whatever the server supports rather than a hardcoded copy.
 */
export type SegmentKey =
  | 'prefix'
  | 'campus_code'
  | 'department_code'
  | 'academic_type'
  | 'academic_year'
  | 'admission_year'
  | 'running_number'
  | 'suffix';

export type ResetMode = 'never' | 'yearly';
export type YearFormat = 'full' | 'short';
export type Separator = '' | '-' | '/' | '.' | '_';

export interface StudentNumberConfig {
  id: number | null;
  school_id: number;
  prefix: string;
  suffix: string;
  separator: string;
  include_campus_code: boolean;
  include_department_code: boolean;
  include_academic_type: boolean;
  include_academic_year: boolean;
  include_admission_year: boolean;
  segment_order: SegmentKey[];
  digit_length: number;
  start_number: number;
  reset_mode: ResetMode;
  year_format: YearFormat;
  uppercase: boolean;
  is_active: boolean;
  version: number;
  updated_at: string | null;
}

/** Which config boolean turns a segment on. null = always available. */
export interface SegmentMeta {
  key: SegmentKey;
  label: string;
  description: string;
  toggle_field:
    | 'include_campus_code'
    | 'include_department_code'
    | 'include_academic_type'
    | 'include_academic_year'
    | 'include_admission_year'
    | null;
}

/** Sample values the server substituted into the dynamic segments. */
export interface PreviewContext {
  campus_code: string | null;
  department_code: string | null;
  academic_type: string | null;
  academic_year: string | null;
  admission_date: string | null;
}

export interface PreviewResult {
  sample: string;
  samples: string[];
  pattern: string;
  next_number: number;
  scope_key: string;
  warnings: string[];
}

export interface StudentNumberConfigResponse {
  config: StudentNumberConfig;
  defaults: StudentNumberConfig;
  segments: SegmentMeta[];
  context: PreviewContext;
  preview: PreviewResult;
  /** false = this school has never saved a format (defaults are showing). */
  is_configured: boolean;
  /** How many numbers have already gone out under any format. */
  issued_count: number;
}

export interface AvailabilityResult {
  student_number: string;
  available: boolean;
  taken_in: string | null;
}

// --- The draft an admin is editing, as the API wants it ---

export type StudentNumberDraft = Pick<
  StudentNumberConfig,
  | 'prefix'
  | 'suffix'
  | 'separator'
  | 'include_campus_code'
  | 'include_department_code'
  | 'include_academic_type'
  | 'include_academic_year'
  | 'include_admission_year'
  | 'segment_order'
  | 'digit_length'
  | 'start_number'
  | 'reset_mode'
  | 'year_format'
  | 'uppercase'
  | 'is_active'
>;

export function toDraft(config: StudentNumberConfig): StudentNumberDraft {
  return {
    prefix: config.prefix,
    suffix: config.suffix,
    separator: config.separator,
    include_campus_code: config.include_campus_code,
    include_department_code: config.include_department_code,
    include_academic_type: config.include_academic_type,
    include_academic_year: config.include_academic_year,
    include_admission_year: config.include_admission_year,
    segment_order: config.segment_order,
    digit_length: config.digit_length,
    start_number: config.start_number,
    reset_mode: config.reset_mode,
    year_format: config.year_format,
    uppercase: config.uppercase,
    is_active: config.is_active,
  };
}

// --- Endpoints ---

/** POST /admin_student_number_config_get */
export async function fetchStudentNumberConfig(token: string): Promise<StudentNumberConfigResponse> {
  const data = await authedRequest('/admin_student_number_config_get', token);
  return data as StudentNumberConfigResponse;
}

/**
 * POST /admin_student_number_preview
 *
 * Previews an UNSAVED draft. This never consumes a running number, which is
 * why the screen can safely call it on every edit (debounced). The final
 * number is still only ever composed server-side during admission - the app
 * deliberately has no local format builder to drift out of sync.
 */
export async function previewStudentNumber(
  token: string,
  draft: StudentNumberDraft,
): Promise<{ preview: PreviewResult; context: PreviewContext }> {
  const data = await authedRequest('/admin_student_number_preview', token, draft as Record<string, any>);
  return { preview: data.preview as PreviewResult, context: data.context as PreviewContext };
}

/** POST /admin_student_number_config_save */
export async function saveStudentNumberConfig(
  token: string,
  draft: StudentNumberDraft,
): Promise<{ config: StudentNumberConfig; preview: PreviewResult }> {
  const data = await authedRequest('/admin_student_number_config_save', token, draft as Record<string, any>);
  return { config: data.config as StudentNumberConfig, preview: data.preview as PreviewResult };
}

/** POST /admin_student_number_check - manual uniqueness lookup. */
export async function checkStudentNumber(
  token: string,
  studentNumber: string,
): Promise<AvailabilityResult> {
  const data = await authedRequest('/admin_student_number_check', token, {
    student_number: studentNumber,
  });
  return data as AvailabilityResult;
}
