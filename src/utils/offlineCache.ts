import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Shared "cache-then-network" helper - the same pattern academicScheduleService's
 * fetchMySchedule (and adminService's fetchStudents, enrollmentWorkflowService's
 * fetchStudentEnrollmentWorkflowStatus, teacherAttendanceService's
 * fetchAttendanceRoster, academicSetupService's fetchSchoolBranding) each
 * implemented by hand. New read endpoints should call this instead of
 * duplicating the try/fetch/cache/catch/fallback dance again.
 *
 * A successful call overwrites the on-disk cache; a failed one (offline,
 * timeout, 5xx, etc) falls back to whatever's cached instead of throwing, so
 * the screen keeps showing the last-known data rather than an error. Only
 * throws if the call fails AND there's truly nothing cached yet (e.g. the
 * first-ever load with no connection).
 *
 * Cache keys are namespaced by a slice of the token (never the full token,
 * same convention as every existing cache) so switching accounts on one
 * device doesn't leak or collide with another user's cached data. See
 * syncStatus.ts, which inventories every `@..._cache_v1:` key for the
 * "storage used offline" screen - keep new prefixes in that same shape if
 * you want them to show up there automatically.
 */
export function cacheKeyFor(prefix: string, token: string, ...parts: (string | number)[]): string {
  const suffix = [token.slice(-12), ...parts].join(':');
  return `${prefix}:${suffix}`;
}

export async function cacheThenNetwork<T>(cacheKey: string, fetcher: () => Promise<T>): Promise<T> {
  try {
    const data = await fetcher();
    AsyncStorage.setItem(cacheKey, JSON.stringify(data)).catch(() => {
      // Best-effort cache write - losing it just means a future offline
      // load falls back further (or throws), not that this call fails.
    });
    return data;
  } catch (err) {
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached !== null) return JSON.parse(cached) as T;
    } catch {
      // Fall through to rethrow the original network error.
    }
    throw err;
  }
}
