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
 * Every segment the number can be built from. The backend's model
 * (StudentNumberFormat::SEGMENTS) uses slightly different key names
 * ('running' and 'school_code'); BACKEND_TO_RN_SEGMENT / RN_TO_BACKEND_SEGMENT
 * below translate between the two so the rest of this file and the screen can
 * use one consistent vocabulary.
 */
export type SegmentKey =
  | 'prefix'
  | 'school_code'
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
  /** Cosmetic only - the backend format has no uppercase column, so this never persists server-side. */
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

/** Static copy for each segment - the backend only returns raw config, not display labels. */
const SEGMENT_META: SegmentMeta[] = [
  {key: 'prefix', label: 'Prefix', description: 'A fixed string at the start of every number.', toggle_field: null},
  {key: 'school_code', label: 'School code', description: "The school's own code.", toggle_field: null},
  {key: 'campus_code', label: 'Campus code', description: 'Which campus the student is admitted to.', toggle_field: 'include_campus_code'},
  {key: 'department_code', label: 'Department code', description: "The student's department.", toggle_field: 'include_department_code'},
  {key: 'academic_type', label: 'Academic type', description: 'Mahad, Madrasa, Markaz, or Regular School.', toggle_field: 'include_academic_type'},
  {key: 'academic_year', label: 'Academic year', description: 'The current academic year/session.', toggle_field: 'include_academic_year'},
  {key: 'admission_year', label: 'Admission year', description: 'The year the student was admitted.', toggle_field: 'include_admission_year'},
  {key: 'running_number', label: 'Running number', description: 'The sequential counter, zero-padded.', toggle_field: null},
  {key: 'suffix', label: 'Suffix', description: 'A fixed string at the end of every number.', toggle_field: null},
];

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

// --- Backend <-> app adapters -------------------------------------------
//
// The real backend (Traits\StudentNumberApi) exposes
// /admin_student_number_format_show, _format_save, _format_preview and
// _sequence_reset - not the _config_get / _config_save / _preview / _check
// endpoints this file used to call. Field names differ too (running_number_start
// vs start_number, reset_policy 'yearly'|'continuous' vs reset_mode
// 'yearly'|'never', segment key 'running'/'school_code' vs 'running_number').
// Everything below translates between the two so the screen doesn't need to
// change.

const BACKEND_TO_RN_SEGMENT: Record<string, SegmentKey> = {
  prefix: 'prefix',
  school_code: 'school_code',
  campus_code: 'campus_code',
  department_code: 'department_code',
  academic_type: 'academic_type',
  academic_year: 'academic_year',
  admission_year: 'admission_year',
  running: 'running_number',
  suffix: 'suffix',
};

const RN_TO_BACKEND_SEGMENT: Record<SegmentKey, string> = {
  prefix: 'prefix',
  school_code: 'school_code',
  campus_code: 'campus_code',
  department_code: 'department_code',
  academic_type: 'academic_type',
  academic_year: 'academic_year',
  admission_year: 'admission_year',
  running_number: 'running',
  suffix: 'suffix',
};

function segmentOrderFromBackend(order: any): SegmentKey[] {
  if (!Array.isArray(order)) return SEGMENT_META.map((s) => s.key);
  return order.map((k: string) => BACKEND_TO_RN_SEGMENT[k]).filter((k: any): k is SegmentKey => !!k);
}

function segmentOrderToBackend(order: SegmentKey[]): string[] {
  return order.map((k) => RN_TO_BACKEND_SEGMENT[k]).filter((k): k is string => !!k);
}

function configFromBackendFormat(format: any): StudentNumberConfig {
  return {
    id: format.id ?? null,
    school_id: format.school_id,
    prefix: format.prefix ?? '',
    suffix: format.suffix ?? '',
    separator: format.separator ?? '',
    include_campus_code: !!format.include_campus_code,
    include_department_code: !!format.include_department_code,
    include_academic_type: !!format.include_academic_type,
    include_academic_year: !!format.include_academic_year,
    include_admission_year: !!format.include_admission_year,
    segment_order: segmentOrderFromBackend(format.segment_order),
    digit_length: format.digit_length ?? 4,
    start_number: format.running_number_start ?? 1,
    reset_mode: format.reset_policy === 'yearly' ? 'yearly' : 'never',
    year_format: format.year_format === 'short' ? 'short' : 'full',
    uppercase: false,
    is_active: !!format.is_active,
    version: 1,
    updated_at: format.updated_at ?? null,
  };
}

function draftToBackendFormat(draft: StudentNumberDraft): Record<string, any> {
  return {
    prefix: draft.prefix,
    suffix: draft.suffix,
    separator: draft.separator,
    digit_length: draft.digit_length,
    running_number_start: draft.start_number,
    reset_policy: draft.reset_mode === 'yearly' ? 'yearly' : 'continuous',
    include_school_code: true,
    include_campus_code: draft.include_campus_code,
    include_department_code: draft.include_department_code,
    include_academic_year: draft.include_academic_year,
    include_admission_year: draft.include_admission_year,
    include_academic_type: draft.include_academic_type,
    year_format: draft.year_format,
    segment_order: segmentOrderToBackend(draft.segment_order),
  };
}

function contextFromSampleContext(ctx: any): PreviewContext {
  return {
    campus_code: ctx?.campus_code ?? null,
    department_code: ctx?.department_code ?? null,
    academic_type: ctx?.academic_type ?? null,
    academic_year: ctx?.academic_year ?? null,
    // the screen reads the admission-year row from `admission_date`
    admission_date: ctx?.admission_year ?? null,
  };
}

/** Builds a PreviewResult from the backend's plain-string preview + payload. */
function previewResultFrom(sampleString: string, nextNumber: number, scopeKey: string): PreviewResult {
  return {
    sample: sampleString ?? '',
    samples: [sampleString ?? ''],
    pattern: sampleString || '',
    next_number: nextNumber ?? 0,
    scope_key: scopeKey ?? 'ALL',
    warnings: [],
  };
}

// --- Endpoints ---

/** POST /admin_student_number_format_show */
export async function fetchStudentNumberConfig(token: string): Promise<StudentNumberConfigResponse> {
  const data = await authedRequest('/admin_student_number_format_show', token);
  const format = data.format ?? {};
  const sequence = (data.sequences ?? [])[0];
  return {
    config: configFromBackendFormat(format),
    segments: SEGMENT_META,
    context: contextFromSampleContext(data.sample_context),
    preview: previewResultFrom(data.preview, sequence?.next_number, sequence?.scope_key),
    is_configured: (data.issued_count ?? 0) > 0 || !!format.id,
    issued_count: data.issued_count ?? 0,
  };
}

/**
 * POST /admin_student_number_format_preview
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
  const data = await authedRequest('/admin_student_number_format_preview', token, draftToBackendFormat(draft));
  return {
    preview: previewResultFrom(data.preview, data.next_number, data.scope_key),
    context: contextFromSampleContext(data.sample_context),
  };
}

/** POST /admin_student_number_format_save */
export async function saveStudentNumberConfig(
  token: string,
  draft: StudentNumberDraft,
): Promise<{ config: StudentNumberConfig; preview: PreviewResult }> {
  const data = await authedRequest('/admin_student_number_format_save', token, draftToBackendFormat(draft));
  const format = data.format ?? {};
  const sequence = (data.sequences ?? [])[0];
  return {
    config: configFromBackendFormat(format),
    preview: previewResultFrom(data.preview, sequence?.next_number, sequence?.scope_key),
  };
}

/**
 * There is currently no backend endpoint for an ad-hoc "is this number already
 * taken" lookup (the backend only checks uniqueness internally, at the moment
 * a number is actually issued). Rather than call a URL that 404s, this fails
 * clearly so the screen shows a real message instead of a generic network
 * error. If this lookup is actually needed, it needs a small new backend
 * endpoint (e.g. exposing StudentNumberApi::snfNumberTaken) - flagged rather
 * than faked.
 */
export async function checkStudentNumber(
  _token: string,
  _studentNumber: string,
): Promise<AvailabilityResult> {
  throw new Error("Checking number availability isn't wired up on the backend yet.");
}
