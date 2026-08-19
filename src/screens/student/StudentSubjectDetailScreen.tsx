import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Clock, DoorOpen, GraduationCap, User } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { AcademicSchedule, Day, fetchMySchedule } from '../../services/academicScheduleService';
import {
  fetchStudentGrades,
  fetchStudentSubjectGradeBands,
  fetchStudentGpaSummary,
  fetchStudentAttendance,
  GradesResponse,
  SubjectGradeBand,
  GpaSubjectRow,
  AttendanceEntry,
} from '../../services/studentAcademicService';
import { Skeleton } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import GlassBackground from '../../components/glass/GlassBackground';
import { COLORS, RADIUS, SHADOW } from '../../theme/glass';
import { resolveSubjectColor, initialsOf } from '../../utils/subjectColor';

const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const HAIRLINE = COLORS.border;
const DANGER = COLORS.danger;

const DAY_ORDER: Day[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_SHORT: Record<Day, string> = {
  sunday: 'Sun', monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat',
};

function formatTime12h(hhmm: string): string {
  const [hStr, mStr] = hhmm.slice(0, 5).split(':');
  let h = parseInt(hStr, 10);
  const m = mStr ?? '00';
  const suffix = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${suffix}`;
}

function IconChevronLeft({ color }: { color: string }) {
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}

type RouteParams = {
  subjectId: number;
  subjectName: string;
  color?: string | null;
  teacherName?: string | null;
};

/**
 * "Show all details of his grades, attendance and many more" for one
 * subject, reached by tapping a subject card on StudentScheduleScreen.
 * No new backend endpoint - this is entirely client-side filtering over
 * data the student's other tabs already fetch (fetchMySchedule for
 * meeting times/room, fetchStudentSubjectGradeBands + fetchStudentGrades
 * for the per-exam-category grade breakdown, fetchStudentGpaSummary for
 * the one-line overview average, fetchStudentAttendance for this month's
 * subject-tagged attendance marks).
 */
export default function StudentSubjectDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { token } = useAuth();
  const { t } = useLocale();

  const params = (route.params ?? {}) as RouteParams;
  const subjectId = params.subjectId;
  const subjectName = params.subjectName ?? '—';
  const color = resolveSubjectColor(subjectId, params.color);

  const [schedule, setSchedule] = useState<AcademicSchedule[]>([]);
  const [grades, setGrades] = useState<GradesResponse | null>(null);
  const [bands, setBands] = useState<SubjectGradeBand[]>([]);
  const [overview, setOverview] = useState<GpaSubjectRow | null>(null);
  const [attendance, setAttendance] = useState<AttendanceEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!token) return;
      if (!opts.silent) setIsLoading(true);
      setError(null);
      try {
        const now = new Date();
        const [scheduleRows, gradesRes, bandsRes, gpaRes, attendanceRes] = await Promise.all([
          fetchMySchedule(token),
          fetchStudentGrades(token),
          fetchStudentSubjectGradeBands(token),
          fetchStudentGpaSummary(token),
          fetchStudentAttendance(token, now.getMonth() + 1, now.getFullYear()),
        ]);
        setSchedule(scheduleRows.filter((r) => r.subject_id === subjectId));
        setGrades(gradesRes);
        setBands(bandsRes.bands.filter((b) => b.subject_id === subjectId));
        setOverview(gpaRes.subjects.find((s) => s.subject_id === subjectId) ?? null);
        setAttendance(attendanceRes.attedances.filter((a) => a.subject_id === subjectId));
      } catch (err) {
        setError(err instanceof Error ? err.message : t('student_subject_detail.load_error', 'Could not load this subject.'));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [token, subjectId, t]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = () => {
    setIsRefreshing(true);
    load({ silent: true });
  };

  const examCategoryNames = useMemo(() => {
    const map = new Map<number, string>();
    (grades?.exam_categories ?? []).forEach((c) => map.set(c.exam_category_id, c.exam_category_name));
    return map;
  }, [grades]);

  const scheduleRows = useMemo(
    () =>
      DAY_ORDER.map((day) => schedule.find((r) => r.day_of_week === day)).filter(Boolean) as AcademicSchedule[],
    [schedule]
  );

  const teacherName = params.teacherName ?? schedule[0]?.teacher_name ?? null;

  const attendanceCounts = useMemo(() => {
    const c = { present: 0, late: 0, absent: 0, excused: 0 };
    attendance.forEach((a) => {
      const s = (a.status || '').toLowerCase();
      if (s === 'present') c.present++;
      else if (s === 'late') c.late++;
      else if (s === 'absent') c.absent++;
      else if (s === 'excused') c.excused++;
    });
    return c;
  }, [attendance]);

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} hitSlop={10}>
          <IconChevronLeft color={INK} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{subjectName}</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {t('student_subject_detail.subtitle', 'Grades, attendance and schedule')}
          </Text>
        </View>
        <View style={[styles.headerDot, { backgroundColor: color }]} />
      </View>

      {isLoading ? (
        <ScrollView contentContainerStyle={styles.outerScroll}>
          <Skeleton width="100%" height={90} style={{ marginBottom: 16 }} />
          <Skeleton width="100%" height={140} style={{ marginBottom: 16 }} />
          <Skeleton width="100%" height={160} />
        </ScrollView>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => load()} style={styles.retryButton}>
            <Text style={styles.retryText}>{t('common.try_again', 'Try again')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.outerScroll}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={color} />}
        >
          {/* Overview */}
          <View style={[styles.overviewCard, { backgroundColor: color }]}>
            <View style={styles.overviewTop}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{initialsOf(teacherName)}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.overviewSubject} numberOfLines={1}>{subjectName}</Text>
                <View style={styles.overviewTeacherRow}>
                  <User size={12} color="rgba(255,255,255,0.9)" strokeWidth={2.2} />
                  <Text style={styles.overviewTeacher} numberOfLines={1}>
                    {teacherName ?? t('student_subject_detail.no_teacher', 'Teacher not assigned')}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.overviewStatsRow}>
              <View style={styles.overviewStat}>
                <Text style={styles.overviewStatValue}>
                  {overview?.average_percentage != null ? `${overview.average_percentage.toFixed(1)}%` : '—'}
                </Text>
                <Text style={styles.overviewStatLabel}>{t('student_subject_detail.average', 'Average')}</Text>
              </View>
              <View style={styles.overviewStatDivider} />
              <View style={styles.overviewStat}>
                <Text style={styles.overviewStatValue}>{overview?.band?.label ?? '—'}</Text>
                <Text style={styles.overviewStatLabel}>{t('student_subject_detail.grade', 'Grade')}</Text>
              </View>
              <View style={styles.overviewStatDivider} />
              <View style={styles.overviewStat}>
                <Text style={styles.overviewStatValue}>{overview?.units != null ? String(overview.units) : '—'}</Text>
                <Text style={styles.overviewStatLabel}>{t('student_subject_detail.units', 'Units')}</Text>
              </View>
            </View>
          </View>

          {/* Weekly schedule */}
          <Text style={styles.sectionTitle}>{t('student_subject_detail.schedule_title', 'Weekly Schedule')}</Text>
          {scheduleRows.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardText}>{t('student_subject_detail.no_schedule', 'No published class times for this subject yet.')}</Text>
            </View>
          ) : (
            <View style={styles.card}>
              {scheduleRows.map((r, idx) => (
                <View key={r.id} style={[styles.scheduleRow, idx > 0 && styles.rowDivider]}>
                  <View style={[styles.dayBadge, { backgroundColor: color }]}>
                    <Text style={styles.dayBadgeText}>{DAY_SHORT[r.day_of_week]}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={styles.metaLine}>
                      <Clock size={12} color={SUBTLE} strokeWidth={2} />
                      <Text style={styles.metaText}>{formatTime12h(r.starts_at)} - {formatTime12h(r.ends_at)}</Text>
                    </View>
                    {r.room_name ? (
                      <View style={styles.metaLine}>
                        <DoorOpen size={12} color={SUBTLE} strokeWidth={2} />
                        <Text style={styles.metaText}>{r.room_name}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Grades */}
          <Text style={styles.sectionTitle}>{t('student_subject_detail.grades_title', 'Grades')}</Text>
          {bands.length === 0 ? (
            <View style={styles.emptyCard}>
              <GraduationCap size={20} color={SUBTLE} strokeWidth={1.8} />
              <Text style={styles.emptyCardText}>{t('student_subject_detail.no_grades', 'No grades recorded for this subject yet.')}</Text>
            </View>
          ) : (
            <View style={styles.card}>
              {bands.map((b, idx) => (
                <View key={`${b.exam_category_id}-${idx}`} style={[styles.gradeRow, idx > 0 && styles.rowDivider]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.gradeCategory} numberOfLines={1}>
                      {examCategoryNames.get(b.exam_category_id) ?? t('student_subject_detail.exam', 'Exam')}
                    </Text>
                    <Text style={styles.gradeMarks}>
                      {b.marks}{b.total_marks != null ? ` / ${b.total_marks}` : ''}
                      {b.percentage != null ? `  •  ${b.percentage.toFixed(1)}%` : ''}
                    </Text>
                  </View>
                  {b.band ? (
                    <View style={[styles.gradeBadge, b.band.is_passing ? styles.gradeBadgePass : styles.gradeBadgeFail]}>
                      <Text style={[styles.gradeBadgeText, b.band.is_passing ? styles.gradeBadgeTextPass : styles.gradeBadgeTextFail]}>
                        {b.band.label}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          )}

          {/* Attendance */}
          <Text style={styles.sectionTitle}>{t('student_subject_detail.attendance_title', 'Attendance This Month')}</Text>
          <View style={styles.attendanceRow}>
            <AttendanceStat label={t('student_subject_detail.present', 'Present')} value={attendanceCounts.present} tint="#1FAE64" />
            <AttendanceStat label={t('student_subject_detail.late', 'Late')} value={attendanceCounts.late} tint="#F59E0B" />
            <AttendanceStat label={t('student_subject_detail.absent', 'Absent')} value={attendanceCounts.absent} tint="#EF4444" />
            <AttendanceStat label={t('student_subject_detail.excused', 'Excused')} value={attendanceCounts.excused} tint={SUBTLE} />
          </View>
          {attendance.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardText}>
                {t('student_subject_detail.no_attendance', 'No subject-specific attendance recorded this month.')}
              </Text>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

function AttendanceStat({ label, value, tint }: { label: string; value: number; tint: string }) {
  return (
    <View style={styles.attendanceStat}>
      <Text style={[styles.attendanceStatValue, { color: tint }]}>{value}</Text>
      <Text style={styles.attendanceStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 14,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: INK },
  headerSubtitle: { fontSize: 12, color: SUBTLE, marginTop: 2 },
  headerDot: { width: 14, height: 14, borderRadius: 7, marginRight: 6 },

  outerScroll: { padding: 16, paddingBottom: 40, flexGrow: 1 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  errorText: { color: DANGER, textAlign: 'center', marginBottom: 12 },
  retryButton: { backgroundColor: '#EEF0F2', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  retryText: { color: INK, fontWeight: '600' },

  overviewCard: {
    borderRadius: RADIUS.lg,
    padding: 16,
    marginBottom: 20,
    ...SHADOW.level2,
  },
  overviewTop: { flexDirection: 'row', alignItems: 'center' },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  overviewSubject: { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
  overviewTeacherRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  overviewTeacher: { fontSize: 12.5, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
  overviewStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: RADIUS.md,
    paddingVertical: 12,
  },
  overviewStat: { flex: 1, alignItems: 'center' },
  overviewStatValue: { fontSize: 15.5, fontWeight: '800', color: '#FFFFFF' },
  overviewStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.85)', marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.4 },
  overviewStatDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.25)' },

  sectionTitle: { fontSize: 13, fontWeight: '800', color: SUBTLE, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 4 },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: HAIRLINE,
    marginBottom: 20,
    ...SHADOW.level1,
  },
  emptyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: HAIRLINE,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyCardText: { fontSize: 12.5, color: SUBTLE, textAlign: 'center', marginTop: 6, lineHeight: 18 },

  scheduleRow: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  rowDivider: { borderTopWidth: 1, borderTopColor: HAIRLINE },
  dayBadge: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dayBadgeText: { color: '#FFFFFF', fontWeight: '800', fontSize: 11 },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  metaText: { fontSize: 12.5, color: INK, fontWeight: '600' },

  gradeRow: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  gradeCategory: { fontSize: 13.5, fontWeight: '700', color: INK },
  gradeMarks: { fontSize: 12, color: SUBTLE, marginTop: 3 },
  gradeBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.pill },
  gradeBadgePass: { backgroundColor: 'rgba(31,174,100,0.14)' },
  gradeBadgeFail: { backgroundColor: 'rgba(239,68,68,0.12)' },
  gradeBadgeText: { fontSize: 12, fontWeight: '800' },
  gradeBadgeTextPass: { color: '#1FAE64' },
  gradeBadgeTextFail: { color: DANGER },

  attendanceRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  attendanceStat: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingVertical: 12,
    alignItems: 'center',
  },
  attendanceStatValue: { fontSize: 18, fontWeight: '800' },
  attendanceStatLabel: { fontSize: 10, color: SUBTLE, marginTop: 3, fontWeight: '600' },
});
