import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Svg, { Polyline, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { AcademicSchedule, Day, fetchMySchedule } from '../../services/academicScheduleService';
import { Skeleton } from '../../components/Skeleton';
import { saveTextFileToDevice } from '../../utils/downloadFile';
import { buildTablePdf } from '../../utils/pdfExport';
import GlassBackground from '../../components/glass/GlassBackground';
import { COLORS, RADIUS, SHADOW } from '../../theme/glass';

const EMERALD = COLORS.emerald;
const EMERALD_SOFT = COLORS.emeraldSoft;
const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const HAIRLINE = COLORS.border;
const DANGER = COLORS.danger;
const DANGER_SOFT = 'rgba(239,68,68,0.1)';
const STRIPE = '#F7FAF8';

/**
 * Student: read-only weekly timetable, scoped by the backend to this
 * student's enrolled section (AcademicScheduleController::mine, routed as
 * POST /my_schedules). A registrar-style table, same shape as the PDF
 * export below (Day, Time, Code, Subject, Room, Campus, Section, Unit,
 * Instructor) - scrolls horizontally on a phone-width screen instead of
 * cutting off or wrapping columns. The backend returns one row per single
 * day a class meets (so a class held Mon/Wed/Fri is 3 separate rows with
 * the same subject/section/time); groupIntoRows below merges same-class
 * rows across days into one row with a combined day code ("MWF"), sorted
 * by the earliest day + start time it occurs.
 *
 * Spatial/glass design pass: same data + PDF export as before, reskinned
 * onto the app-wide glass design system (GlassBackground canvas + the
 * theme/glass color/radius/shadow tokens) instead of hardcoded hex, plus a
 * stats strip so the level of detail matches the table underneath it.
 */

const DAY_ORDER: Day[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_ABBREV: Record<Day, string> = {
  sunday: 'SU',
  monday: 'M',
  tuesday: 'T',
  wednesday: 'W',
  thursday: 'TH',
  friday: 'F',
  saturday: 'S',
};

interface ScheduleRow {
  key: string;
  code: string;
  dayCode: string;
  sortDayIndex: number;
  time: string;
  subject: string;
  room: string;
  campus: string;
  section: string;
  unit: string;
  instructor: string;
}

function formatTime12h(hhmm: string): string {
  const [hStr, mStr] = hhmm.slice(0, 5).split(':');
  let h = parseInt(hStr, 10);
  const m = mStr ?? '00';
  const suffix = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${suffix}`;
}

function formatUnit(units: AcademicSchedule['units']): string {
  if (units === null || units === undefined || units === '') return '—';
  const n = Number(units);
  if (Number.isNaN(n)) return String(units);
  return Number.isInteger(n) ? String(n) : String(n).replace(/\.?0+$/, '');
}

// Groups schedule rows that are the same class meeting on different days
// (same subject/section/room/teacher/time) into one row with a combined day
// code, e.g. Mon+Wed+Fri -> "MWF".
function groupIntoRows(rows: AcademicSchedule[]): ScheduleRow[] {
  const groups = new Map<string, AcademicSchedule[]>();
  rows.forEach((r) => {
    const key = [r.code, r.subject_id, r.section_id, r.room_id, r.teacher_id, r.starts_at, r.ends_at].join('|');
    const existing = groups.get(key);
    if (existing) existing.push(r);
    else groups.set(key, [r]);
  });

  const built = Array.from(groups.values()).map((group) => {
    const first = group[0];
    const dayIndexes = DAY_ORDER.map((d, i) => (group.some((g) => g.day_of_week === d) ? i : -1)).filter((i) => i >= 0);
    const dayCode = dayIndexes.map((i) => DAY_ABBREV[DAY_ORDER[i]]).join('');
    return {
      key: group.map((g) => g.id).join('-'),
      code: first.code,
      dayCode,
      sortDayIndex: dayIndexes[0] ?? 0,
      time: `${formatTime12h(first.starts_at)} - ${formatTime12h(first.ends_at)}`,
      subject: first.subject_name ?? first.code,
      room: first.room_name ?? '—',
      campus: first.campus_name ?? '—',
      section: first.section_name ?? '—',
      unit: formatUnit(first.units),
      instructor: first.teacher_name ?? '—',
    };
  });

  return built.sort((a, b) => a.sortDayIndex - b.sortDayIndex || a.time.localeCompare(b.time));
}

function IconChevronLeft({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Polyline points="15 5 8 12 15 19" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconExport({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3v12M7 8l5-5 5 5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconCalendar({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 9h16M8 4v3M16 4v3" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M4.5 6.5A1.5 1.5 0 0 1 6 5h12a1.5 1.5 0 0 1 1.5 1.5V19A1.5 1.5 0 0 1 18 20.5H6A1.5 1.5 0 0 1 4.5 19V6.5Z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}
function IconBook({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5A1.5 1.5 0 0 1 20 20.5z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}
function IconClock({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" stroke={color} strokeWidth={1.8} />
      <Path d="M12 7v5l3.5 2" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Column order/labels are shared with the PDF export below, but the widths
// aren't: on-screen widths are sized in dp for touch/legibility, while the
// PDF's hand-rolled writer (see buildTablePdf) lays out in points on a fixed
// ~532pt-wide Letter page - reusing the on-screen widths there would run
// columns off the page, so each column carries both.
interface Column {
  key: keyof Pick<ScheduleRow, 'dayCode' | 'time' | 'code' | 'subject' | 'room' | 'campus' | 'section' | 'unit' | 'instructor'>;
  labelKey: string;
  fallback: string;
  width: number;
  pdfWidth: number;
}

const COLUMNS: Column[] = [
  { key: 'dayCode', labelKey: 'student_schedule.col_day', fallback: 'Day', width: 52, pdfWidth: 32 },
  { key: 'time', labelKey: 'student_schedule.col_time', fallback: 'Time', width: 128, pdfWidth: 68 },
  { key: 'code', labelKey: 'student_schedule.col_code', fallback: 'Code', width: 76, pdfWidth: 45 },
  { key: 'subject', labelKey: 'student_schedule.col_subject', fallback: 'Subject', width: 150, pdfWidth: 110 },
  { key: 'room', labelKey: 'student_schedule.col_room', fallback: 'Room', width: 84, pdfWidth: 50 },
  { key: 'campus', labelKey: 'student_schedule.col_campus', fallback: 'Campus', width: 100, pdfWidth: 65 },
  { key: 'section', labelKey: 'student_schedule.col_section', fallback: 'Section', width: 76, pdfWidth: 40 },
  { key: 'unit', labelKey: 'student_schedule.col_unit', fallback: 'Unit', width: 60, pdfWidth: 28 },
  { key: 'instructor', labelKey: 'student_schedule.col_instructor', fallback: 'Instructor', width: 140, pdfWidth: 80 },
];
const TABLE_WIDTH = COLUMNS.reduce((sum, c) => sum + c.width, 0);

function TableSkeleton() {
  return (
    <View style={styles.table}>
      <View style={styles.headerRow}>
        {COLUMNS.map((c) => (
          <View key={c.key} style={[styles.headerCell, { width: c.width }]}>
            <Skeleton width="70%" height={11} borderRadius={4} />
          </View>
        ))}
      </View>
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.dataRow}>
          {COLUMNS.map((c) => (
            <View key={c.key} style={[styles.dataCell, { width: c.width }]}>
              <Skeleton width="80%" height={13} borderRadius={4} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function StatTile({ icon, value, label }: { icon: React.ReactElement; value: string; label: string }) {
  return (
    <View style={styles.statTile}>
      <View style={styles.statIconWrap}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
      </View>
    </View>
  );
}

export default function StudentScheduleScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();
  const { t } = useLocale();

  const [rows, setRows] = useState<AcademicSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!token) return;
      if (!opts.silent) setIsLoading(true);
      setError(null);
      try {
        setRows(await fetchMySchedule(token));
      } catch (err) {
        setError(err instanceof Error ? err.message : t('student_schedule.load_error', 'Could not load your schedule.'));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [token, t]
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

  const scheduleRows = useMemo(() => groupIntoRows(rows), [rows]);

  // Detail strip above the table: total weekly meetings, distinct subjects,
  // and total weekly hours - the same underlying rows, just summarized so
  // the screen reads as more than a bare table at a glance.
  const stats = useMemo(() => {
    const subjectCount = new Set(scheduleRows.map((r) => r.subject)).size;
    const totalMinutes = rows.reduce((sum, r) => {
      const [sh, sm] = r.starts_at.slice(0, 5).split(':').map(Number);
      const [eh, em] = r.ends_at.slice(0, 5).split(':').map(Number);
      const mins = eh * 60 + em - (sh * 60 + sm);
      return sum + (Number.isFinite(mins) && mins > 0 ? mins : 0);
    }, 0);
    const hours = totalMinutes / 60;
    return {
      meetings: rows.length,
      subjects: subjectCount,
      hoursLabel: hours > 0 ? (Number.isInteger(hours) ? String(hours) : hours.toFixed(1)) : '—',
    };
  }, [rows, scheduleRows]);

  const handleExportPdf = async () => {
    if (scheduleRows.length === 0 || isExporting) return;
    setIsExporting(true);
    try {
      const pdf = buildTablePdf(
        t('student_schedule.title', 'My Schedule'),
        COLUMNS.map((c) => ({ label: t(c.labelKey, c.fallback), width: c.pdfWidth })),
        scheduleRows.map((r) => COLUMNS.map((c) => r[c.key]))
      );
      const fileName = `my-schedule-${Date.now()}.pdf`;
      await saveTextFileToDevice(pdf, fileName, 'ascii');
      Alert.alert(t('common.done', 'Done'), t('student_schedule.export_success', 'Your schedule was saved as a PDF on your device.'));
    } catch (err) {
      Alert.alert(
        t('student_schedule.export_error_title', 'Could not export'),
        err instanceof Error ? err.message : t('common.try_again_full', 'Please try again.')
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} hitSlop={10}>
          <IconChevronLeft color={EMERALD} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{t('student_schedule.title', 'My Schedule')}</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {t('student_schedule.header_subtitle', 'Your weekly timetable')}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={handleExportPdf}
          disabled={isExporting || scheduleRows.length === 0}
          hitSlop={10}
        >
          {isExporting ? (
            <ActivityIndicator size="small" color={EMERALD} />
          ) : (
            <IconExport color={scheduleRows.length === 0 ? SUBTLE : EMERALD} />
          )}
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ScrollView contentContainerStyle={styles.outerScroll}>
          <View style={styles.statsRow}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.statTile}>
                <Skeleton width={36} height={36} borderRadius={12} style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Skeleton width="60%" height={16} borderRadius={4} style={{ marginBottom: 6 }} />
                  <Skeleton width="80%" height={11} borderRadius={4} />
                </View>
              </View>
            ))}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <TableSkeleton />
          </ScrollView>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.outerScroll}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={EMERALD} />}
        >
          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {!error && scheduleRows.length === 0 ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconWrap}>
                <IconCalendar color={EMERALD} size={30} />
              </View>
              <Text style={styles.emptyTitle}>{t('student_schedule.empty_title', 'No published schedule yet')}</Text>
              <Text style={styles.emptyBody}>
                {t('student_schedule.empty', 'No published schedule yet.')}
              </Text>
            </View>
          ) : null}

          {scheduleRows.length > 0 ? (
            <>
              <View style={styles.statsRow}>
                <StatTile
                  icon={<IconBook color={EMERALD} size={18} />}
                  value={String(stats.meetings)}
                  label={t('student_schedule.stat_meetings', 'Weekly meetings')}
                />
                <StatTile
                  icon={<IconCalendar color={EMERALD} size={18} />}
                  value={String(stats.subjects)}
                  label={t('student_schedule.stat_subjects', 'Subjects')}
                />
                <StatTile
                  icon={<IconClock color={EMERALD} size={18} />}
                  value={stats.hoursLabel}
                  label={t('student_schedule.stat_hours', 'Hours / week')}
                />
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator>
                <View style={styles.table}>
                  <View style={styles.headerRow}>
                    {COLUMNS.map((c) => (
                      <View key={c.key} style={[styles.headerCell, { width: c.width }]}>
                        <Text style={styles.headerCellText} numberOfLines={1}>
                          {t(c.labelKey, c.fallback)}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {scheduleRows.map((row, i) => (
                    <View key={row.key} style={[styles.dataRow, i % 2 === 1 && styles.dataRowStripe]}>
                      {COLUMNS.map((c) => (
                        <View key={c.key} style={[styles.dataCell, { width: c.width }]}>
                          {c.key === 'dayCode' ? (
                            <View style={styles.dayPill}>
                              <Text style={styles.dayPillText}>{row.dayCode || '—'}</Text>
                            </View>
                          ) : (
                            <Text
                              style={[styles.dataCellText, c.key === 'subject' && styles.dataCellTextStrong]}
                              numberOfLines={2}
                            >
                              {row[c.key]}
                            </Text>
                          )}
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>
            </>
          ) : null}
        </ScrollView>
      )}
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
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: INK, textAlign: 'center' },
  headerSubtitle: { fontSize: 12, color: SUBTLE, textAlign: 'center', marginTop: 2 },

  outerScroll: { padding: 16, paddingBottom: 40, flexGrow: 1 },

  // --- Detail strip: same data as the table below, summarized so the
  // screen reads as more than a bare table at a glance. ---
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statTile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: HAIRLINE,
    padding: 12,
    ...SHADOW.level1,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  statValue: { fontSize: 17, fontWeight: '800', color: INK },
  statLabel: { fontSize: 10.5, color: SUBTLE, marginTop: 1 },

  // --- Registrar-style table: scrolls horizontally so every column (Day,
  // Time, Code, Subject, Room, Campus, Section, Unit, Instructor) stays
  // legible instead of getting cut off or wrapped on a narrow phone. ---
  table: {
    width: TABLE_WIDTH,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: HAIRLINE,
    overflow: 'hidden',
    ...SHADOW.level1,
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: EMERALD_SOFT,
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
  },
  headerCell: { paddingHorizontal: 10, paddingVertical: 10, justifyContent: 'center' },
  headerCellText: { fontSize: 11, fontWeight: '800', color: EMERALD, textTransform: 'uppercase', letterSpacing: 0.4 },
  dataRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
  },
  dataRowStripe: { backgroundColor: STRIPE },
  dataCell: { paddingHorizontal: 10, paddingVertical: 12, justifyContent: 'center' },
  dataCellText: { fontSize: 13, color: INK },
  dataCellTextStrong: { fontWeight: '700' },
  dayPill: {
    alignSelf: 'flex-start',
    backgroundColor: EMERALD_SOFT,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dayPillText: { fontSize: 11.5, fontWeight: '800', color: EMERALD, letterSpacing: 0.3 },

  emptyWrap: { alignItems: 'center', paddingVertical: 40 },
  emptyIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 15.5, fontWeight: '700', color: INK, marginBottom: 6 },
  emptyBody: { fontSize: 13, color: SUBTLE, textAlign: 'center', lineHeight: 19, paddingHorizontal: 20 },

  errorBanner: { backgroundColor: DANGER_SOFT, borderRadius: RADIUS.md, padding: 16, marginBottom: 12 },
  errorText: { color: DANGER, fontSize: 13.5, textAlign: 'center' },
});
