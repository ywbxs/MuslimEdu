import { API_BASE_URL, absoluteUrl } from '../config/api';
import { PickedPhoto } from './orphanService';

export interface TeacherMonthlyReport {
  id: number;
  report_month: string; // "2026-07-01"
  note: string | null;
  teaching_effectiveness_rating: number | null;
  classroom_engagement_rating: number | null;
  professional_growth_rating: number | null;
  submitted_by: string | null;
  photos: string[];
}

export interface TeacherReportTimelineEntry {
  report_month: string; // "2026-06-01"
  submitted: boolean;
  is_current: boolean;
  report: TeacherMonthlyReport | null;
}

export interface TeacherReportStatus {
  submitted_this_month: boolean;
  current_report: TeacherMonthlyReport | null;
  /**
   * The backend's rolling 12-month window (oldest -> current), exactly as
   * returned by /teacher_report_status.
   */
  timeline: TeacherReportTimelineEntry[];
  /**
   * Derived client-side from `timeline` for screens that just want a flat
   * list of every submitted report. IMPORTANT: /teacher_report_status does
   * NOT send a `history` field itself (only `timeline`) - a report field
   * literally called `history` here was always `[]`, which silently broke
   * both the make-up-report timeline on TeacherOrphanReportScreen (past
   * months never showed as "Submitted" after being made up) and the
   * Reports-Submitted / Average-Score stats on TeacherDashboard. Always
   * derive it from `timeline`, never read a `history` key off the raw
   * response again.
   */
  history: TeacherMonthlyReport[];
}

async function authedPost(path: string, token: string, body: FormData | Record<string, any>) {
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
    throw new Error(data?.message ?? `Request failed (${response.status})`);
  }

  return data;
}

function normalizePhotos<T extends { photos?: string[] | null }>(report: T): T {
  return {
    ...report,
    photos: (report.photos ?? [])
      .map((p) => absoluteUrl(p))
      .filter((p): p is string => !!p),
  };
}

/** POST /teacher_report_status - current month status + rolling 12-month timeline for the logged-in teacher-orphan */
export async function fetchTeacherReportStatus(token: string): Promise<TeacherReportStatus> {
  const data = (await authedPost('/teacher_report_status', token, {})) as {
    submitted_this_month: boolean;
    current_report: TeacherMonthlyReport | null;
    timeline?: TeacherReportTimelineEntry[];
  };

  const timeline = (data.timeline ?? []).map((entry) => ({
    ...entry,
    report: entry.report ? normalizePhotos(entry.report) : null,
  }));

  return {
    submitted_this_month: data.submitted_this_month,
    current_report: data.current_report ? normalizePhotos(data.current_report) : null,
    timeline,
    history: timeline
      .map((entry) => entry.report)
      .filter((r): r is TeacherMonthlyReport => !!r),
  };
}

/**
 * POST /teacher_report_submit - submit this month's teaching report.
 * Kept as its own function (not shared with the child orphan's submitReport
 * in orphanService.ts) because the fields are different: teaching
 * effectiveness / classroom engagement / professional growth ratings, not
 * academic/wellbeing. Teacher-orphans and child-orphans must never share a
 * submission screen or payload shape.
 */
export async function submitTeacherReport(
  token: string,
  fields: {
    note: string;
    teaching_effectiveness_rating: number;
    classroom_engagement_rating: number;
    professional_growth_rating: number;
    /**
     * Optional target month as "YYYY-MM-01". Lets a teacher make up a past
     * "Missing" month, not just the current one. Omit to submit for the
     * current month (previous default behavior, unchanged). Confirmed
     * accepted and honored by /teacher_report_submit.
     */
    report_month?: string;
  },
  photos: PickedPhoto[] = [],
): Promise<{ message: string; report: TeacherMonthlyReport }> {
  const form = new FormData();
  form.append('note', fields.note);
  form.append('teaching_effectiveness_rating', String(fields.teaching_effectiveness_rating));
  form.append('classroom_engagement_rating', String(fields.classroom_engagement_rating));
  form.append('professional_growth_rating', String(fields.professional_growth_rating));
  if (fields.report_month) {
    form.append('report_month', fields.report_month);
  }

  photos.forEach((photo, index) => {
    // @ts-ignore - React Native's FormData accepts this shape for file uploads
    form.append('photos[]', {
      uri: photo.uri,
      name: photo.fileName ?? `photo_${index}.jpg`,
      type: photo.type ?? 'image/jpeg',
    });
  });

  const data = await authedPost('/teacher_report_submit', token, form);
  return { ...data, report: normalizePhotos(data.report) };

}
