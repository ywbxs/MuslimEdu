import { API_BASE_URL, absoluteUrl } from '../config/api';
import { MonthlyReport, PickedPhoto, normalizeReportPhotos } from './orphanService';

export interface OverviewChild {
  student_id: number;
  name: string;
  photo: string | null;
  submitted: boolean;
  submitted_by: string | null;
}

/**
 * Overview photos come back from the backend as relative paths (or null,
 * on older backend builds that don't send one yet). Run them through
 * absoluteUrl() the same way orphanService.normalizeReportPhotos() does
 * for report photos - otherwise <Image> gets a relative uri, fails
 * silently, and the row falls back to the letter avatar.
 */
function normalizeOverviewChild(child: OverviewChild): OverviewChild {
  return { ...child, photo: absoluteUrl(child.photo) };
}

export interface ReportOverview {
  month: string; // "2026-07"
  total_count: number;
  submitted_count: number;
  children: OverviewChild[];
}

// Requests that use file uploads (photos) legitimately take longer than a
// plain JSON POST, so they get a longer allowance before we give up.
const DEFAULT_TIMEOUT_MS = 15000;
const UPLOAD_TIMEOUT_MS = 45000;

async function authedPost(path: string, token: string, body: FormData | Record<string, any>) {
  const isFormData = body instanceof FormData;

  // Without this, a hung connection (bad network, slow/unresponsive backend
  // route) leaves `fetch` pending forever - the caller's `await` never
  // returns, so screens like AdminOrphanOverviewScreen never flip out of
  // their loading state and the skeleton spins indefinitely with no error
  // and no retry option. Aborting after a timeout guarantees the promise
  // always settles one way or another.
  const controller = new AbortController();
  const timeoutMs = isFormData ? UPLOAD_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        Authorization: `Bearer ${token}`,
      },
      body: isFormData ? body : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timed out. Check your connection and try again.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message ?? `Request failed (${response.status})`);
  }

  return data;
}

/** POST /admin_orphan_report_overview - submitted/missing status for all children in a given month */
export async function fetchReportOverview(token: string, month?: string): Promise<ReportOverview> {
  const data = await authedPost('/admin_orphan_report_overview', token, month ? { month } : {});
  return {
    ...data,
    children: (data.children ?? []).map(normalizeOverviewChild),
  };
}

/**
 * POST /admin_orphan_report_list - full report history for one child.
 * Photos are absolutized so the thumbnails on the detail screen load.
 */
export async function fetchChildReports(token: string, studentId: number): Promise<MonthlyReport[]> {
  const data = await authedPost('/admin_orphan_report_list', token, { student_id: studentId });
  return (data.reports ?? []).map(normalizeReportPhotos);
}

/** POST /admin_orphan_report_create - admin creates a report on a child's behalf */
export async function createChildReport(
  token: string,
  studentId: number,
  fields: { note: string; academic_rating: number; wellbeing_rating: number; report_month?: string },
  photos: PickedPhoto[] = [],
): Promise<{ message: string }> {
  const form = new FormData();
  form.append('student_id', String(studentId));
  form.append('note', fields.note);
  form.append('academic_rating', String(fields.academic_rating));
  form.append('wellbeing_rating', String(fields.wellbeing_rating));
  if (fields.report_month) form.append('report_month', fields.report_month);

  photos.forEach((photo, index) => {
    // @ts-ignore - React Native's FormData accepts this shape for file uploads
    form.append('photos[]', {
      uri: photo.uri,
      name: photo.fileName ?? `photo_${index}.jpg`,
      type: photo.type ?? 'image/jpeg',
    });
  });

  return authedPost('/admin_orphan_report_create', token, form);
}

/** POST /admin_orphan_report_delete - remove a report */
export async function deleteChildReport(token: string, reportId: number): Promise<{ message: string }> {
  return authedPost('/admin_orphan_report_delete', token, { report_id: reportId });
}
