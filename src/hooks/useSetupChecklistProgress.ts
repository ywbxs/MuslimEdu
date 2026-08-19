import { useCallback, useEffect, useState } from 'react';
import { fetchAcademicSessions } from '../services/academicSessionService';
import { fetchGradingSystems, fetchSubjectsCatalog } from '../services/adminAcademicCatalogService';
import { fetchClasses } from '../services/adminService';
import { listSchedules } from '../services/academicScheduleService';
import { fetchAttendanceMethods } from '../services/attendanceConfigService';
import { fetchEnrollmentStages, fetchFeeTypes } from '../services/enrollmentWorkflowService';
import { fetchStudentNumberConfig } from '../services/studentNumberService';

export interface SetupChecklistResult {
  doneCount: number;
  total: number;
  // True if any individual check's request failed (network error, etc).
  // Callers that just display a number (the dashboard ring) can ignore
  // this - a failed check already counts as "not done" in doneCount.
  // Callers that GATE something on "is setup complete" must not: a false
  // "not complete" caused by one flaky request is very different from a
  // real "not complete", and treating them the same would lock an already
  // fully set-up admin out of the app over a dropped connection.
  hasError: boolean;
}

/**
 * The same 9 readiness checks SetupChecklistScreen.tsx shows in full (with
 * titles/descriptions/routes) - kept here as its own copy rather than
 * sharing state with that screen so a dashboard-card or gate fetch failure
 * can't affect the full checklist page. If a check is ever added/removed
 * there, mirror it here too.
 */
export async function runSetupChecklistChecks(token: string): Promise<SetupChecklistResult> {
  const checks: Array<() => Promise<number>> = [
    async () => (await fetchAcademicSessions(token)).length,
    async () => (await fetchGradingSystems(token)).length,
    async () => (await fetchClasses(token)).length,
    async () => (await fetchSubjectsCatalog(token)).length,
    async () => {
      const [student, staff] = await Promise.all([
        fetchStudentNumberConfig(token, 'student'),
        fetchStudentNumberConfig(token, 'staff'),
      ]);
      return student.is_configured && staff.is_configured ? 1 : 0;
    },
    async () => (await listSchedules(token)).length,
    async () => (await fetchAttendanceMethods(token)).length,
    async () => (await fetchEnrollmentStages(token)).length,
    async () => (await fetchFeeTypes(token)).length,
  ];

  let hasError = false;
  const results = await Promise.all(
    checks.map(async (run) => {
      try {
        return (await run()) > 0;
      } catch {
        hasError = true;
        return false;
      }
    }),
  );

  return { doneCount: results.filter(Boolean).length, total: checks.length, hasError };
}

interface SetupChecklistProgress extends SetupChecklistResult {
  loading: boolean;
}

/** React-hook wrapper around runSetupChecklistChecks, for components that
 * just want to display live doneCount/total (e.g. the dashboard's Setup
 * Checklist bento card). */
export function useSetupChecklistProgress(token: string | null | undefined): SetupChecklistProgress {
  const [state, setState] = useState<SetupChecklistProgress>({ doneCount: 0, total: 0, hasError: false, loading: true });

  const load = useCallback(async () => {
    if (!token) return;
    setState((s) => ({ ...s, loading: true }));
    const result = await runSetupChecklistChecks(token);
    setState({ ...result, loading: false });
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  return state;
}
