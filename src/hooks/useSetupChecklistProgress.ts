import { useCallback, useEffect, useState } from 'react';
import { fetchAcademicSessions } from '../services/academicSessionService';
import { fetchGradingSystems, fetchSubjectsCatalog } from '../services/adminAcademicCatalogService';
import { fetchClasses } from '../services/adminService';
import { listSchedules } from '../services/academicScheduleService';
import { fetchAttendanceMethods } from '../services/attendanceConfigService';
import { fetchEnrollmentStages, fetchFeeTypes } from '../services/enrollmentWorkflowService';
import { fetchStudentNumberConfig } from '../services/studentNumberService';

interface SetupChecklistProgress {
  doneCount: number;
  total: number;
  loading: boolean;
}

/**
 * A count-only summary of the same 9 readiness checks
 * SetupChecklistScreen.tsx shows in full (with titles/descriptions/routes) -
 * kept here as its own copy rather than sharing state with that screen so a
 * dashboard-card fetch failure can't affect the full checklist page. If a
 * check is ever added/removed there, mirror it here too - `total` reflects
 * however many checks THIS list runs, not SetupChecklistScreen's count.
 */
export function useSetupChecklistProgress(token: string | null | undefined): SetupChecklistProgress {
  const [doneCount, setDoneCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);

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

    const results = await Promise.all(
      checks.map(async (run) => {
        try {
          return (await run()) > 0;
        } catch {
          // Fail-open per check, same as SetupChecklistScreen's own
          // per-item try/catch - one broken endpoint shouldn't zero out
          // the whole count.
          return false;
        }
      }),
    );

    setTotal(checks.length);
    setDoneCount(results.filter(Boolean).length);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  return { doneCount, total, loading };
}
