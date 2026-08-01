import { API_BASE_URL, absoluteUrl } from '../config/api';

// --- Shared fetch helper (same pattern as teacherClassService.ts) ---

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

// --- Constants (must match Attendance::STATUSES / HOMEROOM_SUBJECT_ID on the backend) ---

export const HOMEROOM_SUBJECT_ID = 0;

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused' | 'leave';

export const ATTENDANCE_STATUSES: AttendanceStatus[] = ['present', 'late', 'absent', 'excused', 'leave'];

// --- Types ---

export interface AttendanceClassOption {
  section_id: number;
  section_name: string;
  class_id: number;
  class_name: string | null;
  subject_id: number;
  subject_name: string | null;
  role: 'homeroom' | 'subject';
  day_of_week?: string | null;
  start_time?: string | null;
  end_time?: string | null;
}

export interface RosterStudent {
  student_id: number;
  student_name: string;
  photo: string | null;
  status: AttendanceStatus | null;
  check_in_time: string | null;
  remarks: string | null;
  attendance_id: number | null;
}

export interface AttendanceSummary {
  [status: string]: number;
}

export interface AttendanceRoster {
  section_id: number;
  section_name: string;
  subject_id: number;
  date: string;
  students: RosterStudent[];
  summary: AttendanceSummary;
}

export interface AttendanceRecordInput {
  student_id: number;
  status: AttendanceStatus;
  check_in_time?: string | null;
  remarks?: string | null;
}

export interface HistoryRecord {
  id: number;
  student_id: number;
  subject_id: number;
  date: string;
  status: AttendanceStatus;
  check_in_time: string | null;
  remarks: string | null;
}

// --- Teacher: which classes/subjects they can take attendance for ---

export async function fetchAttendanceClasses(token: string): Promise<AttendanceClassOption[]> {
  const data = await authedPost('/teacher_attendance_classes', token);
  return data.classes ?? [];
}

// --- Teacher: roster for one section/subject/date ---

export async function fetchAttendanceRoster(
  token: string,
  sectionId: number,
  subjectId: number,
  date: string
): Promise<AttendanceRoster> {
  const data = await authedPost('/teacher_attendance_roster', token, {
    section_id: sectionId,
    subject_id: subjectId,
    date,
  });
  const students: any[] = data.students ?? [];
  return {
    section_id: data.section_id,
    section_name: data.section_name,
    subject_id: data.subject_id,
    date: data.date,
    summary: data.summary ?? {},
    students: students.map((s) => ({
      ...s,
      photo: absoluteUrl(s.photo ?? null),
    })),
  };
}

// --- Teacher: save/overwrite a batch of statuses for a section/subject/date ---

export async function submitAttendance(
  token: string,
  sectionId: number,
  subjectId: number,
  date: string,
  records: AttendanceRecordInput[]
): Promise<{ message: string; summary: AttendanceSummary; count: number }> {
  return authedPost('/teacher_attendance_submit', token, {
    section_id: sectionId,
    subject_id: subjectId,
    date,
    records,
  });
}

// --- Teacher: one-scan check-in via a student's QR/ID code ---

export interface ScanResult {
  message: string;
  student: RosterStudent;
  summary: AttendanceSummary;
}

export async function scanAttendance(
  token: string,
  sectionId: number,
  subjectId: number,
  date: string,
  code: string
): Promise<ScanResult> {
  const data = await authedPost('/teacher_attendance_scan', token, {
    section_id: sectionId,
    subject_id: subjectId,
    date,
    code,
  });
  return {
    message: data.message,
    student: { ...data.student, photo: absoluteUrl(data.student?.photo ?? null) },
    summary: data.summary ?? {},
  };
}

// --- Teacher: edit a single already-submitted record (blocked once the school's edit window has passed) ---

export async function updateAttendanceRecord(
  token: string,
  attendanceId: number,
  status: AttendanceStatus,
  reason?: string | null
): Promise<{ message: string; attendance: any }> {
  return authedPost('/teacher_attendance_update', token, {
    attendance_id: attendanceId,
    status,
    reason: reason ?? null,
  });
}

// --- Teacher: date-range history for one section/subject ---

export async function fetchAttendanceHistory(
  token: string,
  sectionId: number,
  subjectId: number | null,
  dateFrom: string,
  dateTo: string
): Promise<HistoryRecord[]> {
  const data = await authedPost('/teacher_attendance_history', token, {
    section_id: sectionId,
    subject_id: subjectId,
    date_from: dateFrom,
    date_to: dateTo,
  });
  return data.records ?? [];
}
