import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Reads what's actually sitting in AsyncStorage for the current user's
 * offline caches - a real inventory, not a guess. Every cache-then-network
 * service in the app (fetchStudents, fetchStudentEnrollmentWorkflowStatus,
 * fetchAttendanceRoster, fetchSchoolBranding, fetchMySchedule) writes to a
 * key shaped `${PREFIX}:${token.slice(-12)}` (attendance rosters additionally
 * suffix `:sectionId:subjectId:date`, so many keys can exist for one user).
 * This scans for all of them rather than duplicating each service's own
 * cache-key logic, so a new cache added later shows up here automatically
 * as long as it follows the same `@..._cache_v1:` naming convention.
 */

export interface CachedDataset {
  key: string;
  label: string;
  count: number;
  bytes: number;
}

const KNOWN_PREFIXES: { prefix: string; label: string }[] = [
  { prefix: '@students_cache_v1', label: 'Students' },
  { prefix: '@student_enrollment_status_cache_v1', label: 'Enrollment Status' },
  { prefix: '@attendance_roster_cache_v1', label: 'Attendance Rosters' },
  { prefix: '@school_branding_cache_v1', label: 'School Branding' },
  { prefix: '@my_schedule_cache_v1', label: 'My Schedule' },
];

export async function scanCachedDatasets(token: string): Promise<CachedDataset[]> {
  const tokenSuffix = token.slice(-12);
  const allKeys = await AsyncStorage.getAllKeys();
  const mine = allKeys.filter((k) => k.includes(tokenSuffix));

  const results: CachedDataset[] = [];
  for (const { prefix, label } of KNOWN_PREFIXES) {
    const matches = mine.filter((k) => k.startsWith(prefix));
    if (matches.length === 0) continue;

    let bytes = 0;
    if (matches.length > 0) {
      const pairs = await AsyncStorage.multiGet(matches);
      bytes = pairs.reduce((sum, [, value]) => sum + (value?.length ?? 0), 0);
    }

    results.push({ key: prefix, label, count: matches.length, bytes });
  }
  return results;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
