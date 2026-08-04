import { API_BASE_URL } from '../config/api';

// --- Shared fetch helper (same pattern as adminService.ts / teacherAttendanceService.ts) ---

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
    throw new Error(firstErrorMessage(data) ?? `Request failed (${response.status})`);
  }

  return data;
}

// --- Types (mirrors AttendanceService::analytics() on the backend) ---

export interface AttendanceStatusCounts {
  present: number;
  late: number;
  absent: number;
  excused: number;
  leave: number;
}

export interface DailyTrendPoint extends AttendanceStatusCounts {
  date: string;
}

export interface AttendanceAnalytics {
  status_counts: AttendanceStatusCounts;
  total_marked: number;
  attendance_percentage: number;
  daily_trend: DailyTrendPoint[];
}

export interface AnalyticsFilters {
  classId?: number | null;
  sectionId?: number | null;
  subjectId?: number | null;
  teacherId?: number | null;
  dateFrom?: string | null;
  dateTo?: string | null;
}

// --- Admin: analytics dashboard ---

export async function fetchAttendanceAnalytics(
  token: string,
  filters: AnalyticsFilters = {}
): Promise<AttendanceAnalytics> {
  const data = await authedPost('/admin_attendance_dashboard', token, {
    class_id: filters.classId ?? null,
    section_id: filters.sectionId ?? null,
    subject_id: filters.subjectId ?? null,
    teacher_id: filters.teacherId ?? null,
    date_from: filters.dateFrom ?? null,
    date_to: filters.dateTo ?? null,
  });

  return {
    status_counts: {
      present: 0,
      late: 0,
      absent: 0,
      excused: 0,
      leave: 0,
      ...(data.status_counts ?? {}),
    },
    total_marked: data.total_marked ?? 0,
    attendance_percentage: data.attendance_percentage ?? 0,
    daily_trend: data.daily_trend ?? [],
  };
}

// --- Admin: attendance lock/unlock ---

export interface AttendanceLockRow {
  section_id: number;
  section_name: string | null;
  class_name: string | null;
  subject_id: number;
  subject_name: string | null;
  date: string;
  locked_at: string;
  locked_by_name: string | null;
}

/** POST /admin_attendance_locks_list - every currently-locked roster in the admin's school. */
export async function fetchAttendanceLocks(token: string): Promise<AttendanceLockRow[]> {
  const data = await authedPost('/admin_attendance_locks_list', token);
  return data.locks ?? [];
}

/**
 * POST /admin_attendance_unlock - admin-only override so a teacher can fix
 * a mistake in an already-submitted roster. Confirmed with the user:
 * teachers cannot unlock their own submissions, only an admin can.
 */
export async function unlockAttendance(
  token: string,
  sectionId: number,
  subjectId: number,
  date: string,
): Promise<{ message: string; unlocked_at: string }> {
  return authedPost('/admin_attendance_unlock', token, {
    section_id: sectionId,
    subject_id: subjectId,
    date,
  });
}
