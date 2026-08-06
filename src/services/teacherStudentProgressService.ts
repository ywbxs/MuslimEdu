import { API_BASE_URL } from '../config/api';
import { cacheKeyFor, cacheThenNetwork } from '../utils/offlineCache';

const CACHE_PREFIX = '@teacher_student_progress_cache_v1';

/**
 * M4 progress & risk indicators — the TEACHER/ADMIN-facing view of a
 * student's combined progress. Backend: StudentProgressController, route
 * `/teacher_student_progress_summary`.
 *
 * Deliberately a separate file and a separate route from
 * `studentProgressService.ts` / `/student_progress_summary` — that
 * existing file and endpoint are the student's own self-service view
 * (attendance only, no student_id parameter, different response shape).
 * This one takes a student_id, requires teacher/admin auth, and
 * aggregates attendance + gradebook assessments + exam results + behavior
 * incidents + memorization records into one summary with a risk level.
 *
 * Read-only — does not write anything. See the controller's own
 * docblock for the disclosed, simple risk-scoring rule.
 *
 * Never executed against a live server.
 */

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
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error('You appear to be offline. Check your connection and try again.');
  }

  const data = await response.json().catch(() => ({}));

  if (response.status === 401 || response.status === 403) {
    throw new Error(firstErrorMessage(data) ?? 'You do not have permission to do this.');
  }

  if (!response.ok) {
    throw new Error(firstErrorMessage(data) ?? `Request failed (${response.status})`);
  }

  return data;
}

export type RiskLevel = 'low' | 'moderate' | 'high';

export interface TeacherStudentProgressSummary {
  student: { id: number; name: string };
  lookback_days: number;
  attendance: { rate_percent: number | null; days_recorded: number };
  grades: {
    assessment_average_percent: number | null;
    graded_assessment_count: number;
    exam_average_percent: number | null;
    graded_exam_count: number;
  };
  behavior: { incidents_last_90_days: number; major_incidents_last_90_days: number };
  memorization: { memorized_count: number; in_progress_count: number };
  risk: { level: RiskLevel; points: number };
}

export async function fetchTeacherStudentProgressSummary(
  token: string,
  studentId: number
): Promise<TeacherStudentProgressSummary> {
  return cacheThenNetwork(cacheKeyFor(CACHE_PREFIX, token, studentId), () =>
    authedPost('/teacher_student_progress_summary', token, { student_id: studentId }),
  );
}
