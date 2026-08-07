import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Reads what's actually sitting in AsyncStorage for the current user's
 * offline caches - a real inventory, not a guess. Every cache-then-network
 * service in the app writes to a key shaped `${PREFIX}:${token.slice(-12)}`
 * (many services suffix further, e.g. `:sectionId:subjectId:date`, so many
 * keys can exist for one user/prefix). This scans for all of them rather
 * than duplicating each service's own cache-key logic.
 *
 * KNOWN_PREFIXES is a whitelist, not a wildcard scan - a new cache-then-network
 * call (see utils/offlineCache.ts's cacheThenNetwork/cacheKeyFor) needs its
 * prefix added here too, or it caches data that never shows up on the sync
 * status screen.
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
  { prefix: '@student_academic_cache_v1', label: 'My Academics (Schedule, Subjects, Grades)' },
  { prefix: '@student_progress_cache_v1', label: 'My Progress' },
  { prefix: '@student_identity_cache_v1', label: 'My ID Card' },
  { prefix: '@student_portal_cache_v1', label: 'Documents & Services' },
  { prefix: '@announcement_cache_v1', label: 'Announcements' },
  { prefix: '@chat_cache_v1', label: 'Chat' },
  { prefix: '@post_cache_v1', label: 'Feed Posts' },
  { prefix: '@material_cache_v1', label: 'Materials' },
  { prefix: '@examination_cache_v1', label: 'Examinations' },
  { prefix: '@assessment_cache_v1', label: 'Assessments' },
  { prefix: '@fee_cache_v1', label: 'Fees' },
  { prefix: '@academic_calendar_cache_v1', label: 'Academic Calendar' },
  { prefix: '@memorization_cache_v1', label: 'Memorization Records' },
  { prefix: '@behavior_cache_v1', label: 'Behavior Records' },
  { prefix: '@teacher_class_cache_v1', label: 'My Classes' },
  { prefix: '@teacher_gradebook_cache_v1', label: 'Gradebook' },
  { prefix: '@teacher_student_progress_cache_v1', label: 'Student Progress (Teacher View)' },
  { prefix: '@teacher_orphan_cache_v1', label: 'Teacher Orphan Reports' },
  { prefix: '@orphan_cache_v1', label: 'Orphan Reports' },
  { prefix: '@lesson_plan_cache_v1', label: 'Lesson Plans' },
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
