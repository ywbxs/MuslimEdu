// Real, backend-wired API used by AdminClassScheduleScreen.tsx (admin
// builder), TeacherMyScheduleScreen.tsx, and StudentScheduleScreen.tsx.
// The backend (AcademicScheduleController) is flat-POST style, not REST,
// and uses its own field names (start_time/end_time, period_label,
// integer day_of_week). These adapters translate between that and the
// shape this app's screens use.

import { API_BASE_URL } from '../config/api';

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
  // Denormalized display names - resolved server-side so teacher/student
  // views can show real names without calling admin-only lookup
  // endpoints (admin_sections_list, admin_class_teacher_list, etc.).
  room_name?: string | null;
  section_name?: string | null;
  teacher_name?: string | null;
  subject_name?: string | null;
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
    room_name: row.room_name ?? null,
    section_name: row.section_name ?? null,
    teacher_name: row.teacher_name ?? null,
    subject_name: row.subject_name ?? null,
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

/** POST /admin_schedule_delete */
export async function deleteSchedule(token: string, id: number): Promise<void> {
  await schedulePost(token, 'admin_schedule_delete', { id });
}

/**
 * POST /my_schedules - the logged-in user's own published schedule.
 * Backend resolves role server-side: teachers get slots where they're the
 * assigned teacher, students get slots for their enrolled section. Used
 * by both TeacherMyScheduleScreen and StudentScheduleScreen.
 */
export async function fetchMySchedule(token: string): Promise<AcademicSchedule[]> {
  const data = await schedulePost(token, 'my_schedules');
  return (data.schedules || []).map(fromBackendSchedule);
}
