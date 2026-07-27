/**
 * studentAttendanceService
 *
 * Phase 2 - Student attendance read views (spec SS6).
 *
 * The BACKEND FOR THIS ALREADY EXISTED and was mis-audited as missing in earlier
 * roadmaps: `POST /attendance` (ApiController::attendanceReport) has always
 * returned the authenticated student's own month of records. This service wraps
 * both it and the new aggregation endpoint:
 *
 *   fetchAttendanceSummary()  -> POST /student_attendance_summary  (new, preferred)
 *   fetchAttendanceRaw()      -> POST /attendance                  (legacy fallback)
 *
 * If the backend half of Phase 2 has not been deployed yet, fetchAttendance()
 * transparently falls back to the legacy route and aggregates client-side, so the
 * screen is never blank while you are mid-deploy.
 */

// NOTE: this must match how the rest of your services import the axios instance.
// Check any existing service (e.g. assessmentService.ts) and align this one line
// if your client lives somewhere else.
import api from './api';

export type AttendanceStatusKey = 'present' | 'late' | 'excused' | 'absent' | 'other';

export interface AttendanceDay {
  id: number | string;
  date: string;
  day_label: string;
  status: string;
  status_key: AttendanceStatusKey;
  status_label: string;
  subject_id: number | null;
  subject_name: string | null;
  is_homeroom: boolean;
}

export interface AttendanceTally {
  present: number;
  late: number;
  excused: number;
  absent: number;
  other: number;
  total: number;
  attendance_rate: number;
}

export interface AttendanceTrendPoint extends AttendanceTally {
  year: number;
  month: number;
  label: string;
}

export interface AttendanceSummary {
  student: {
    id: number;
    name: string;
    class_id: number | null;
    class_name: string | null;
    section_id: number | null;
    section_name: string | null;
    school_id: number | null;
    session_id: number | null;
  };
  range: { month: number; year: number; label: string; from: string; to: string };
  totals: AttendanceTally;
  raw_status_counts: Record<string, number>;
  days: AttendanceDay[];
  trend: AttendanceTrendPoint[];
  /** true when the payload was rebuilt client-side from the legacy route */
  degraded?: boolean;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const STATUS_ALIASES: Record<AttendanceStatusKey, string[]> = {
  present: ['p', 'present', '1', 'in', 'presence'],
  late: ['l', 'late', 'tardy', '2'],
  excused: ['e', 'excused', 'leave', 'medical', 'medical leave', 'official', 'official activity', '3'],
  absent: ['a', 'absent', '0', 'abs'],
  other: [],
};

export function bucketStatus(raw: unknown): AttendanceStatusKey {
  const key = String(raw ?? '').trim().toLowerCase();
  const found = (Object.keys(STATUS_ALIASES) as AttendanceStatusKey[])
    .find(bucket => STATUS_ALIASES[bucket].includes(key));
  return found ?? 'other';
}

function emptyTally(): AttendanceTally {
  return { present: 0, late: 0, excused: 0, absent: 0, other: 0, total: 0, attendance_rate: 0 };
}

function rateOf(t: AttendanceTally): number {
  if (t.total <= 0) return 0;
  return Math.round(((t.present + t.late + t.excused) / t.total) * 1000) / 10;
}

/** Preferred path: the Phase 2 aggregation endpoint. */
export async function fetchAttendanceSummary(
  month: number,
  year: number,
  trendMonths = 6,
): Promise<AttendanceSummary> {
  const res = await api.post('/student_attendance_summary', {
    month,
    year,
    trend_months: trendMonths,
  });
  return res.data as AttendanceSummary;
}

/** Legacy path, still live, untouched by Phase 2. */
export async function fetchAttendanceRaw(month: number, year: number) {
  // The legacy route parses `month` as a word ('01 March 2026'), not a number.
  const res = await api.post('/attendance', {
    month: MONTH_NAMES[month - 1],
    year: String(year),
  });
  return res.data;
}

/** Rebuild the summary shape from a legacy payload so the UI stays identical. */
function summaryFromLegacy(payload: any, month: number, year: number): AttendanceSummary {
  const rows: any[] = payload?.attedances ?? payload?.attendances ?? [];
  const totals = emptyTally();
  const rawCounts: Record<string, number> = {};

  const days: AttendanceDay[] = rows.map(r => {
    const key = bucketStatus(r.status);
    totals[key] += 1;
    totals.total += 1;
    rawCounts[String(r.status)] = (rawCounts[String(r.status)] ?? 0) + 1;

    return {
      id: r.id,
      date: r.date,
      day_label: new Date(r.date).toLocaleDateString(undefined, { weekday: 'short' }),
      status: r.status,
      status_key: key,
      status_label: key.charAt(0).toUpperCase() + key.slice(1),
      subject_id: r.subject_id ?? null,
      subject_name: null,
      is_homeroom: Boolean(r.is_homeroom),
    };
  });

  totals.attendance_rate = rateOf(totals);

  return {
    student: {
      id: payload?.student_id ?? 0,
      name: '',
      class_id: payload?.class_id ?? null,
      class_name: payload?.class_name ?? null,
      section_id: payload?.section_id ?? null,
      section_name: payload?.section_name ?? null,
      school_id: payload?.school_id ?? null,
      session_id: payload?.session_id ?? null,
    },
    range: {
      month,
      year,
      label: `${MONTH_NAMES[month - 1]} ${year}`,
      from: '',
      to: '',
    },
    totals,
    raw_status_counts: rawCounts,
    days,
    trend: [{ ...totals, year, month, label: `${MONTH_NAMES[month - 1].slice(0, 3)} ${year}` }],
    degraded: true,
  };
}

/**
 * What the screen actually calls. Tries the new endpoint, silently degrades to the
 * legacy one if Phase 2's backend is not deployed (404) - and treats the legacy
 * route's 400 "Attendance report not found!" as a legitimate EMPTY month rather
 * than an error, which is the bug that made the old behaviour unusable.
 */
export async function fetchAttendance(
  month: number,
  year: number,
  trendMonths = 6,
): Promise<AttendanceSummary> {
  try {
    return await fetchAttendanceSummary(month, year, trendMonths);
  } catch (err: any) {
    const status = err?.response?.status;

    if (status !== 404 && status !== 405 && status !== 500) {
      throw err;
    }

    try {
      const legacy = await fetchAttendanceRaw(month, year);
      return summaryFromLegacy(legacy, month, year);
    } catch (legacyErr: any) {
      if (legacyErr?.response?.status === 400) {
        return summaryFromLegacy({}, month, year);
      }
      throw legacyErr;
    }
  }
}

export const MONTHS = MONTH_NAMES;
