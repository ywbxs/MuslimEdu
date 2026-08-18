// Real, backend-wired API used by AdminClassScheduleScreen.tsx (admin
// builder), TeacherMyScheduleScreen.tsx, and StudentScheduleScreen.tsx.
// The backend (AcademicScheduleController) is flat-POST style, not REST,
// and uses its own field names (start_time/end_time, period_label,
// integer day_of_week). These adapters translate between that and the
// shape this app's screens use.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';

// Per-account (keyed by a slice of the token, not the full token) cache of
// the last successfully fetched "my schedule" response, so a student who
// opens the app offline still sees their real schedule/enrollment status
// instead of an error - see fetchMySchedule below. Not used for the admin
// schedule builder (listSchedules/saveSchedule/deleteSchedule), which needs
// live server state for conflict checking.
const MY_SCHEDULE_CACHE_PREFIX = '@my_schedule_cache_v1';

function myScheduleCacheKey(token: string): string {
  return `${MY_SCHEDULE_CACHE_PREFIX}:${token.slice(-12)}`;
}

export type Day = 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';

export interface AcademicSchedule {
  id: number;
  code: string;
  day_of_week: Day;
  starts_at: string;
  ends_at: string;
  room_id?: number | null;
  section_id?: number | null;
  teacher_id?: number | null;
  subject_id?: number | null;
  meeting_type?: string;
  /** 'draft' | 'published' | 'archived'. Only 'published' rows are ever
      returned by my_schedules, i.e. are visible to teachers/students. */
  status?: string;
  // Denormalized display names - resolved server-side so teacher/student
  // views can show real names without calling admin-only lookup
  // endpoints (admin_sections_list, admin_class_teacher_list, etc.).
  room_name?: string | null;
  section_name?: string | null;
  teacher_name?: string | null;
  subject_name?: string | null;
  // Admin-set color from SubjectFormScreen's color picker (Subject.color) -
  // null when the admin never picked one; callers fall back to a
  // deterministic palette color keyed off subject_id.
  subject_color?: string | null;
  // Optional - only present once the backend resolves them (campus via
  // section -> class -> campus, units from the subject record). Missing on
  // an older backend just means those table columns show a dash.
  campus_name?: string | null;
  units?: number | string | null;
}

const DAY_TO_INT: Record<Day, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
const INT_TO_DAY: Day[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

async function schedulePost(token: string, endpoint: string, body: Record<string, any> = {}) {
  const r = await fetch(`${API_BASE_URL}/${endpoint}`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.message || `Request failed (${r.status})`);
  return d;
}

function fromBackendSchedule(row: any): AcademicSchedule {
  return {
    id: row.id,
    code: row.period_label || `SCH-${row.id}`,
    day_of_week: INT_TO_DAY[row.day_of_week] ?? 'monday',
    starts_at: row.start_time,
    ends_at: row.end_time,
    room_id: row.room_id ?? null,
    section_id: row.section_id ?? null,
    teacher_id: row.teacher_id ?? null,
    subject_id: row.subject_id ?? null,
    meeting_type: row.status,
    status: row.status,
    room_name: row.room_name ?? null,
    section_name: row.section_name ?? null,
    teacher_name: row.teacher_name ?? null,
    subject_name: row.subject_name ?? null,
    subject_color: row.subject_color ?? null,
    campus_name: row.campus_name ?? null,
    units: row.units ?? null,
  };
}

/** POST /admin_schedule_list */
export async function listSchedules(token: string, day?: Day): Promise<AcademicSchedule[]> {
  const body: Record<string, any> = {};
  if (day) body.day_of_week = DAY_TO_INT[day];
  const data = await schedulePost(token, 'admin_schedule_list', body);
  return (data.schedules || []).map(fromBackendSchedule);
}

/** POST /admin_schedule_store */
export async function saveSchedule(
  token: string,
  input: {
    code: string;
    day_of_week: Day;
    starts_at: string;
    ends_at: string;
    room_id?: number | null;
    section_id?: number | null;
    teacher_id?: number | null;
    subject_id?: number | null;
  },
): Promise<AcademicSchedule> {
  const data = await schedulePost(token, 'admin_schedule_store', {
    period_label: input.code,
    day_of_week: DAY_TO_INT[input.day_of_week],
    start_time: input.starts_at,
    end_time: input.ends_at,
    room_id: input.room_id ?? undefined,
    section_id: input.section_id ?? undefined,
    teacher_id: input.teacher_id ?? undefined,
    subject_id: input.subject_id ?? undefined,
  });
  return fromBackendSchedule(data.schedule);
}

/** POST /admin_schedule_update - same shape as saveSchedule, plus the row id. */
export async function updateSchedule(
  token: string,
  id: number,
  input: {
    code: string;
    day_of_week: Day;
    starts_at: string;
    ends_at: string;
    room_id?: number | null;
    section_id?: number | null;
    teacher_id?: number | null;
    subject_id?: number | null;
  },
): Promise<AcademicSchedule> {
  const data = await schedulePost(token, 'admin_schedule_update', {
    id,
    period_label: input.code,
    day_of_week: DAY_TO_INT[input.day_of_week],
    start_time: input.starts_at,
    end_time: input.ends_at,
    room_id: input.room_id ?? undefined,
    section_id: input.section_id ?? undefined,
    teacher_id: input.teacher_id ?? undefined,
    subject_id: input.subject_id ?? undefined,
  });
  return fromBackendSchedule(data.schedule);
}

/**
 * POST /admin_schedule_status - every schedule row is created as 'draft'
 * server-side (AcademicScheduleController::store always sets status =>
 * 'draft'), and `mine()` (my_schedules, what TeacherMyScheduleScreen and
 * StudentScheduleScreen read) only ever returns status = 'published' rows.
 * The admin builder never called this endpoint, so a slot an admin created
 * or assigned a teacher/room to would sit as an invisible draft forever -
 * "my schedule" would never show it. Called right after create/update below
 * so a saved slot is immediately visible instead of requiring a manual
 * separate publish step that no UI here exposes.
 */
export async function setScheduleStatus(token: string, id: number, status: 'draft' | 'published' | 'archived'): Promise<void> {
  await schedulePost(token, 'admin_schedule_status', { id, status });
}

/** POST /admin_schedule_delete */
export async function deleteSchedule(token: string, id: number): Promise<void> {
  await schedulePost(token, 'admin_schedule_delete', { id });
}

/**
 * POST /my_schedules - the logged-in user's own published schedule.
 * Backend resolves role server-side: teachers get slots where they're the
 * assigned teacher, students get slots for their enrolled section. Used
 * by both TeacherMyScheduleScreen and StudentScheduleScreen, plus the
 * dashboard's UpcomingClassesCard/EnrollmentStatusCard.
 *
 * Cache-then-network: a successful fetch overwrites the on-disk cache: a
 * failed one (offline, timeout, etc) falls back to it instead of throwing,
 * so the schedule/enrollment-status views keep working with the last-known
 * data while offline rather than showing an error. Only throws if there's
 * truly nothing cached yet (e.g. first-ever load with no connection).
 */
export async function fetchMySchedule(token: string): Promise<AcademicSchedule[]> {
  const cacheKey = myScheduleCacheKey(token);
  try {
    const data = await schedulePost(token, 'my_schedules');
    const schedules = (data.schedules || []).map(fromBackendSchedule);
    AsyncStorage.setItem(cacheKey, JSON.stringify(schedules)).catch(() => {
      // Best-effort cache write - losing it just means the next offline
      // load falls back further (or throws), not that this call fails.
    });
    return schedules;
  } catch (err) {
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) return JSON.parse(cached) as AcademicSchedule[];
    } catch {
      // Fall through to rethrow the original network error.
    }
    throw err;
  }
}
