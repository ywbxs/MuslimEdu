import { API_BASE_URL } from '../config/api';
import { cacheKeyFor, cacheThenNetwork } from '../utils/offlineCache';

const CACHE_PREFIX = '@student_progress_cache_v1';

async function authedPost(path: string, token: string, body: Record<string, any> = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message ?? `Request failed (${response.status})`);
  return data;
}

export type AttendanceItem = { id: number; date: string; status: string; subject_id?: number; is_homeroom?: boolean };
export type AttendanceSummary = { present: number; late: number; excused: number; absent: number; total: number; rate: number | null };
export type AttendanceReport = { month: number; year: number; items: AttendanceItem[]; summary: AttendanceSummary };
export type ProgressSummary = { attendance_rate: number | null; attendance_total: number; present: number; late: number; excused: number; absent: number; subject_averages: Array<{ subject_id: number; subject_name: string; average: number }>; grades_available: boolean; grades_note?: string };

export async function fetchStudentAttendance(token: string, month: number, year: number): Promise<AttendanceReport> {
  return cacheThenNetwork(cacheKeyFor(CACHE_PREFIX, token, 'attendance', month, year), () =>
    authedPost('/student_attendance_report', token, { month, year }),
  );
}
export async function fetchStudentProgress(token: string): Promise<ProgressSummary> {
  return cacheThenNetwork(cacheKeyFor(CACHE_PREFIX, token, 'summary'), () =>
    authedPost('/student_progress_summary', token),
  );
}
