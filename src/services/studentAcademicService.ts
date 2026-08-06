import { API_BASE_URL } from '../config/api';
import { cacheKeyFor, cacheThenNetwork } from '../utils/offlineCache';

const CACHE_PREFIX = '@student_academic_cache_v1';

/**
 * Student-facing reads for spec §6 "Enrollment and academics" /
 * "Attendance, grades" (schedule, subjects, attendance, grades).
 *
 * Per spec §11 ("inspect first, reuse before adding") these do NOT call new
 * backend endpoints. `/routine`, `/subjects`, `/attendance`, `/marks` already
 * existed pre-spec in ApiController.php, are already routed in
 * routes/api.php, and already resolve identity from
 * `auth('sanctum')->user()->id` via CommonController::get_student_details_by_id
 * - never a client-supplied id - so they already satisfy spec §7. This file
 * just gives the RN app typed wrappers; nothing changed on the backend.
 *
 * Same authed-POST pattern as subscriptionService.ts / enrollmentWorkflowService.ts.
 */

class ApiError extends Error {
  status?: number;
}

async function authedPost<T = any>(
  path: string,
  token: string,
  body: Record<string, any> = {}
): Promise<T> {
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
    const err = new ApiError(data?.message ?? `Request failed (${response.status})`);
    err.status = response.status;
    throw err;
  }

  return data as T;
}

// --- Schedule (/routine) ------------------------------------------------

export interface ScheduleEntry {
  id: number;
  subject_id: number;
  subject_name: string;
  starting_time: string;
  ending_time: string;
  room_id: number;
  room_name: string;
  day: string;
  teacher_id: number;
  teacher_name: string;
  teacher_image?: string | null;
  teacher_designation?: string | null;
}

export interface ScheduleResponse {
  class_id: number;
  class_name: string;
  section_id: number;
  section_name: string;
  routines: ScheduleEntry[];
}

// Backend returns 400 with a message when there's no routine yet - treat
// that as an empty list rather than an error the screen has to special-case.
// Cache-then-network: a genuine network failure falls back to the last
// successful response instead of throwing, so the schedule tab keeps
// showing real data while offline.
export async function fetchStudentSchedule(token: string): Promise<ScheduleResponse> {
  return cacheThenNetwork(cacheKeyFor(CACHE_PREFIX, token, 'schedule'), async () => {
    try {
      return await authedPost<ScheduleResponse>('/routine', token);
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 400) {
        return { class_id: 0, class_name: '', section_id: 0, section_name: '', routines: [] };
      }
      throw e;
    }
  });
}

// --- Subjects (/subjects) ------------------------------------------------

export interface StudentSubject {
  id: number;
  name: string;
}

export interface SubjectsResponse {
  class_id: number;
  class_name: string;
  subjects: StudentSubject[];
}

export async function fetchStudentSubjects(token: string): Promise<SubjectsResponse> {
  return cacheThenNetwork(cacheKeyFor(CACHE_PREFIX, token, 'subjects'), async () => {
    try {
      return await authedPost<SubjectsResponse>('/subjects', token);
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 400) {
        return { class_id: 0, class_name: '', subjects: [] };
      }
      throw e;
    }
  });
}

// --- Attendance (/attendance) --------------------------------------------

export interface AttendanceEntry {
  id: number;
  status: string; // 'present' | 'absent' | 'late' | 'excused' - backend-defined
  date: string;
  subject_id: number | null;
  is_homeroom: boolean;
}

export interface AttendanceResponse {
  class_id: number;
  class_name: string;
  section_id: number;
  section_name: string;
  attedances: AttendanceEntry[]; // backend's own (misspelled) key, kept as-is
}

// Backend takes month/year (defaults to current month if omitted upstream is
// NOT guaranteed - always pass both explicitly).
export async function fetchStudentAttendance(
  token: string,
  month: number,
  year: number
): Promise<AttendanceResponse> {
  return cacheThenNetwork(cacheKeyFor(CACHE_PREFIX, token, 'attendance', month, year), async () => {
    try {
      return await authedPost<AttendanceResponse>('/attendance', token, { month, year });
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 400) {
        return { class_id: 0, class_name: '', section_id: 0, section_name: '', attedances: [] };
      }
      throw e;
    }
  });
}

// --- Grades (/marks) ------------------------------------------------------

export interface GradeSubjectMark {
  subject_id: number;
  subject_name: string;
  marks: unknown; // shape is exam-type dependent on the backend side
}

export interface GradeEntry {
  exam_id: number;
  exam_category_id: number;
  exam_category_name: string;
  subjects?: GradeSubjectMark[];
  comment?: string | null;
}

export interface ExamCategory {
  exam_category_id: number;
  exam_category_name: string;
}

export interface GradesResponse {
  class_id: number;
  class_name: string;
  exam_marks: GradeEntry[];
  exam_categories: ExamCategory[];
}

export async function fetchStudentGrades(
  token: string,
  examCategoryId?: number
): Promise<GradesResponse> {
  return cacheThenNetwork(cacheKeyFor(CACHE_PREFIX, token, 'grades', examCategoryId ?? 'all'), async () => {
    try {
      return await authedPost<GradesResponse>(
        '/marks',
        token,
        examCategoryId ? { exam_category_id: examCategoryId } : {}
      );
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 400) {
        return { class_id: 0, class_name: '', exam_marks: [], exam_categories: [] };
      }
      throw e;
    }
  });
}

// --- Grade bands (/student_subject_grade_bands) ---------------------------
//
// Resolves each subject mark against the admin's configured GradingSystem/
// GradeScale (subject → department → program → school-default), computed
// server-side at read time - see AcademicCatalogController::
// resolveGradingSystemForSubject. `band` is null when either no grading
// system is configured for that subject yet, or there's no matching Exam
// row to compute a percentage from - never guessed client-side.
export interface SubjectGradeBand {
  exam_category_id: number;
  subject_id: number;
  subject_name: string;
  marks: number;
  total_marks: number | null;
  percentage: number | null;
  grading_system_id: number | null;
  band: {
    label: string;
    gpa_value: number | null;
    is_passing: boolean;
    honors_eligible: boolean;
  } | null;
  term_id: number | null;
  term_name: string | null;
}

export interface SubjectGradeBandsResponse {
  subject_grades: SubjectGradeBand[];
  term_id: number | null;
  terms_available: GpaTermOption[];
}

export interface SubjectGradeBandsResult {
  bands: SubjectGradeBand[];
  termId: number | null;
  termsAvailable: GpaTermOption[];
}

// termId narrows to one configured term, same pattern and same term
// resolution as fetchStudentGpaSummary (see the backend comment on
// computeSubjectGradeRows/resolveTermForTimestamp for how a Gradebook
// entry gets matched to a term).
export async function fetchStudentSubjectGradeBands(
  token: string,
  examCategoryId?: number,
  termId?: number
): Promise<SubjectGradeBandsResult> {
  const cacheKey = cacheKeyFor(CACHE_PREFIX, token, 'gradeBands', examCategoryId ?? 'all', termId ?? 'all');
  return cacheThenNetwork(cacheKey, async () => {
    try {
      const res = await authedPost<SubjectGradeBandsResponse>('/student_subject_grade_bands', token, {
        ...(examCategoryId ? { exam_category_id: examCategoryId } : {}),
        ...(termId ? { term_id: termId } : {}),
      });
      return {
        bands: res.subject_grades ?? [],
        termId: res.term_id ?? null,
        termsAvailable: res.terms_available ?? [],
      };
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 400) {
        return { bands: [], termId: termId ?? null, termsAvailable: [] };
      }
      throw e;
    }
  });
}

// --- GPA summary (/student_gpa_summary) ------------------------------------
//
// One subject-average-percentage → one resolved band per subject (averaged
// across all exam categories recorded this session - there's no "final
// exam category" flag to prefer one over another), then a weighted mean of
// each subject's gpa_value using Subject.units as the credit-hour weight
// (falls back to an equal weight of 1 when a subject has no units set -
// `unit_weighted: false` flags that fallback per subject). Subjects with no
// resolvable band are excluded from the GPA, not scored as 0 -
// subjects_with_grade/subjects_total tells the caller whether the number is
// a complete picture or a partial one.
export interface GpaSubjectRow {
  subject_id: number;
  subject_name: string;
  average_percentage: number;
  units: number | null;
  unit_weighted: boolean;
  band: { label: string; gpa_value: number | null; is_passing: boolean } | null;
  included_in_gpa: boolean;
}

export interface GpaTermOption {
  id: number;
  name: string;
}

export interface GpaSummaryResponse {
  gpa: number | null;
  total_weight: number;
  subjects_with_grade: number;
  subjects_total: number;
  subjects: GpaSubjectRow[];
  term_id: number | null;
  terms_available: GpaTermOption[];
}

// termId narrows the same computation to one configured term (see the
// backend comment on student_gpa_summary for how a Gradebook entry gets
// matched to a term - there's no direct FK, so it's resolved from the
// entry's timestamp). Omitted or undefined returns the whole running
// session, same as before term-awareness existed.
export async function fetchStudentGpaSummary(token: string, termId?: number): Promise<GpaSummaryResponse> {
  return cacheThenNetwork(cacheKeyFor(CACHE_PREFIX, token, 'gpaSummary', termId ?? 'all'), async () => {
    try {
      return await authedPost<GpaSummaryResponse>('/student_gpa_summary', token, termId ? { term_id: termId } : {});
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 400) {
        return {
          gpa: null,
          total_weight: 0,
          subjects_with_grade: 0,
          subjects_total: 0,
          subjects: [],
          term_id: termId ?? null,
          terms_available: [],
        };
      }
      throw e;
    }
  });
}

// --- Progress (client-side aggregation over the above) --------------------
//
// Raw average marks per subject remain the baseline (unambiguous, always
// available). Where a grade band was resolved for a subject's most recent
// mark, computeSubjectAverages' caller can attach it from
// fetchStudentSubjectGradeBands - see GradesTab/ProgressTab. A subject with
// no configured grading system still shows its raw average, unlabeled.

export interface MonthlyAttendancePoint {
  month: number;
  year: number;
  label: string; // e.g. "Feb 2026"
  presentCount: number;
  lateCount: number;
  excusedCount: number;
  absentCount: number;
  totalMarked: number;
  presentRatePct: number | null; // null if totalMarked is 0 (no data that month)
}

// Fetches `monthsBack` consecutive months ending at the current month and
// computes a present-rate per month. Sequential requests (not
// Promise.all) to stay gentle on the API; this screen is not time-critical.
export async function fetchStudentAttendanceTrend(
  token: string,
  monthsBack: number = 6
): Promise<MonthlyAttendancePoint[]> {
  const now = new Date();
  const points: MonthlyAttendancePoint[] = [];

  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    const res = await fetchStudentAttendance(token, month, year);
    const entries = res.attedances ?? [];

    let presentCount = 0;
    let lateCount = 0;
    let excusedCount = 0;
    let absentCount = 0;
    entries.forEach((e) => {
      const s = (e.status || '').toLowerCase();
      if (s === 'present') presentCount++;
      else if (s === 'late') lateCount++;
      else if (s === 'excused') excusedCount++;
      else if (s === 'absent') absentCount++;
    });

    // Excused days are removed from the denominator - they shouldn't count
    // against the student either way. Late counts as attended.
    const countedTotal = presentCount + lateCount + absentCount;
    const presentRatePct =
      countedTotal > 0 ? Math.round(((presentCount + lateCount) / countedTotal) * 100) : null;

    points.push({
      month,
      year,
      label: d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }),
      presentCount,
      lateCount,
      excusedCount,
      absentCount,
      totalMarked: entries.length,
      presentRatePct,
    });
  }

  return points;
}

export interface SubjectAverage {
  subject_id: number;
  subject_name: string;
  average: number | null; // null if no numeric marks found for this subject
  sampleCount: number;
}

// Averages only marks that parse as a plain number. Non-numeric `marks`
// (e.g. a letter grade, or a rubric object) are skipped per-subject rather
// than guessed at, and the subject still shows with sampleCount 0.
export function computeSubjectAverages(grades: GradesResponse): SubjectAverage[] {
  const bySubject = new Map<number, { name: string; sum: number; count: number }>();

  grades.exam_marks.forEach((exam) => {
    (exam.subjects ?? []).forEach((s) => {
      const numeric =
        typeof s.marks === 'number'
          ? s.marks
          : typeof s.marks === 'string' && s.marks.trim() !== '' && !Number.isNaN(Number(s.marks))
          ? Number(s.marks)
          : null;

      const existing = bySubject.get(s.subject_id) ?? { name: s.subject_name, sum: 0, count: 0 };
      if (numeric !== null) {
        existing.sum += numeric;
        existing.count += 1;
      }
      bySubject.set(s.subject_id, existing);
    });
  });

  return Array.from(bySubject.entries()).map(([subject_id, v]) => ({
    subject_id,
    subject_name: v.name,
    average: v.count > 0 ? Math.round((v.sum / v.count) * 10) / 10 : null,
    sampleCount: v.count,
  }));
}
