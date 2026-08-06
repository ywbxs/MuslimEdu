import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Svg, { Polyline } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { AcademicSchedule, Day, fetchMySchedule } from '../../services/academicScheduleService';
import { Skeleton } from '../../components/Skeleton';
import { saveTextFileToDevice } from '../../utils/downloadFile';
import { buildTablePdf } from '../../utils/pdfExport';

const EMERALD = '#0F9D58';
const EMERALD_SOFT = '#E7F5EC';
const INK = '#1C1C1E';
const SUBTLE = '#8A9099';
const HAIRLINE = '#EDEEF0';
const CANVAS = '#F6F7F9';
const STRIPE = '#FAFBFC';
const DANGER_SOFT = '#FCEDED';
const DANGER = '#E5484D';

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
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Polyline points="15 5 8 12 15 19" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconExport({ color }: { color: string }) {
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
      <Polyline points="7 8 12 3 17 8" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
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

export default function StudentScheduleScreen() {
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
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <IconChevronLeft color={EMERALD} />
          <Text style={styles.backText}>{t('common.back', 'Back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('student_schedule.title', 'My Schedule')}</Text>
        <TouchableOpacity
          style={styles.exportBtn}
          onPress={handleExportPdf}
          disabled={isExporting || scheduleRows.length === 0}
          hitSlop={10}
        >
          {isExporting ? <ActivityIndicator size="small" color={EMERALD} /> : <IconExport color={scheduleRows.length === 0 ? '#C4C9CF' : EMERALD} />}
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.outerScroll}>
          <TableSkeleton />
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
            <Text style={styles.empty}>{t('student_schedule.empty', 'No published schedule yet.')}</Text>
          ) : null}

          {scheduleRows.length > 0 ? (
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
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: CANVAS },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', minWidth: 60 },
  backText: { color: EMERALD, fontSize: 15, fontWeight: '600', marginLeft: 2 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: INK },
  exportBtn: { minWidth: 60, alignItems: 'flex-end', padding: 4 },

  outerScroll: { padding: 16, paddingBottom: 32, flexGrow: 1 },

  // --- Registrar-style table: scrolls horizontally so every column (Day,
  // Time, Code, Subject, Room, Campus, Section, Unit, Instructor) stays
  // legible instead of getting cut off or wrapped on a narrow phone. ---
  table: {
    width: TABLE_WIDTH,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HAIRLINE,
    overflow: 'hidden',
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

  empty: { textAlign: 'center', color: SUBTLE, marginTop: 36 },
  errorBanner: { backgroundColor: DANGER_SOFT, borderRadius: 14, padding: 16, marginBottom: 12 },
  errorText: { color: DANGER, fontSize: 13.5, textAlign: 'center' },
});
