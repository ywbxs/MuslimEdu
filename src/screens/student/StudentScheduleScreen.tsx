import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Svg, { Polyline } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { AcademicSchedule, Day, fetchMySchedule } from '../../services/academicScheduleService';
import { Skeleton } from '../../components/Skeleton';

const EMERALD = '#0F9D58';
const INK = '#1C1C1E';
const SUBTLE = '#8A9099';
const HAIRLINE = '#EDEEF0';
const CANVAS = '#F6F7F9';
const DANGER_SOFT = '#FCEDED';
const DANGER = '#E5484D';
const HEADER_BG = '#FAFBFC';

/**
 * Student: read-only weekly timetable, scoped by the backend to this
 * student's enrolled section (AcademicScheduleController::mine, routed as
 * POST /my_schedules). Laid out as a scrollable table - Code / Description /
 * Day / Time / Room / Campus / Section / Unit / Instructor - matching the
 * school's existing web registrar schedule sheet, instead of the previous
 * per-day list of cards. The backend returns one row per single day a class
 * meets (so a class held Mon/Wed/Fri is 3 separate rows with the same
 * subject/section/time); groupIntoTableRows below merges same-class rows
 * across days into one table row with a combined day code ("MWF"), which is
 * how the reference sheet displays it.
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

interface TableRow {
  key: string;
  code: string;
  description: string;
  dayCode: string;
  time: string;
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
  return `${h}:${m}${suffix}`;
}

function formatUnit(units: AcademicSchedule['units']): string {
  if (units === null || units === undefined || units === '') return '—';
  const n = Number(units);
  if (Number.isNaN(n)) return String(units);
  return Number.isInteger(n) ? String(n) : String(n).replace(/\.?0+$/, '');
}

// Groups schedule rows that are the same class meeting on different days
// (same subject/section/room/teacher/time) into one table row with a
// combined day code, e.g. Mon+Wed+Fri -> "MWF".
function groupIntoTableRows(rows: AcademicSchedule[]): TableRow[] {
  const groups = new Map<string, AcademicSchedule[]>();
  rows.forEach((r) => {
    const key = [r.code, r.subject_id, r.section_id, r.room_id, r.teacher_id, r.starts_at, r.ends_at].join('|');
    const existing = groups.get(key);
    if (existing) existing.push(r);
    else groups.set(key, [r]);
  });

  return Array.from(groups.values()).map((group) => {
    const first = group[0];
    const dayCode = DAY_ORDER.filter((d) => group.some((g) => g.day_of_week === d))
      .map((d) => DAY_ABBREV[d])
      .join('');
    return {
      key: group.map((g) => g.id).join('-'),
      code: first.code,
      description: first.subject_name ?? first.code,
      dayCode,
      time: `${formatTime12h(first.starts_at)}-${formatTime12h(first.ends_at)}`,
      room: first.room_name ?? '—',
      campus: first.campus_name ?? '—',
      section: first.section_name ?? '—',
      unit: formatUnit(first.units),
      instructor: first.teacher_name ?? '—',
    };
  });
}

const COLUMNS: { key: keyof TableRow; label: string; width: number }[] = [
  { key: 'code', label: 'CODE', width: 90 },
  { key: 'description', label: 'DESCRIPTION', width: 240 },
  { key: 'dayCode', label: 'DAY', width: 60 },
  { key: 'time', label: 'TIME', width: 150 },
  { key: 'room', label: 'ROOM', width: 80 },
  { key: 'campus', label: 'CAMPUS', width: 160 },
  { key: 'section', label: 'SECTION', width: 90 },
  { key: 'unit', label: 'UNIT', width: 60 },
  { key: 'instructor', label: 'INSTRUCTOR', width: 200 },
];
const TABLE_WIDTH = COLUMNS.reduce((sum, c) => sum + c.width, 0);

function IconChevronLeft({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Polyline points="15 5 8 12 15 19" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function TableHeaderRow() {
  return (
    <View style={styles.headerRow}>
      {COLUMNS.map((col) => (
        <View key={col.key} style={[styles.cell, { width: col.width }]}>
          <Text style={styles.headerCellText}>{col.label}</Text>
        </View>
      ))}
    </View>
  );
}

function TableDataRow({ row, striped }: { row: TableRow; striped: boolean }) {
  return (
    <View style={[styles.dataRow, striped && styles.dataRowStriped]}>
      {COLUMNS.map((col) => (
        <View key={col.key} style={[styles.cell, { width: col.width }]}>
          <Text style={styles.dataCellText} numberOfLines={2}>{row[col.key]}</Text>
        </View>
      ))}
    </View>
  );
}

function TableSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Skeleton key={i} width="100%" height={44} borderRadius={8} style={{ marginBottom: 8 }} />
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

  const tableRows = useMemo(() => groupIntoTableRows(rows), [rows]);

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <IconChevronLeft color={EMERALD} />
          <Text style={styles.backText}>{t('common.back', 'Back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('student_schedule.title', 'My Schedule')}</Text>
        <View style={styles.backBtn} />
      </View>

      {isLoading ? (
        <TableSkeleton />
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

          {!error && tableRows.length === 0 ? (
            <Text style={styles.empty}>{t('student_schedule.empty', 'No published schedule yet.')}</Text>
          ) : null}

          {tableRows.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ width: TABLE_WIDTH }}>
              <View style={styles.table}>
                <TableHeaderRow />
                {tableRows.map((row, i) => (
                  <TableDataRow key={row.key} row={row} striped={i % 2 === 1} />
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

  outerScroll: { padding: 16, paddingBottom: 32 },
  skeletonWrap: { padding: 16 },

  table: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: HAIRLINE,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: HEADER_BG,
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
  },
  dataRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
  },
  dataRowStriped: { backgroundColor: '#FBFCFD' },
  cell: {
    paddingHorizontal: 10,
    paddingVertical: 12,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: HAIRLINE,
  },
  headerCellText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: SUBTLE,
    letterSpacing: 0.4,
  },
  dataCellText: { fontSize: 12.5, fontWeight: '600', color: INK, lineHeight: 16 },

  empty: { textAlign: 'center', color: SUBTLE, marginTop: 36 },
  errorBanner: { backgroundColor: DANGER_SOFT, borderRadius: 14, padding: 16, marginBottom: 12 },
  errorText: { color: DANGER, fontSize: 13.5, textAlign: 'center' },
});
