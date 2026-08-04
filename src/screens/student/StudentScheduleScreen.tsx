import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Svg, { Path, Polyline, Circle } from 'react-native-svg';
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
const DANGER_SOFT = '#FCEDED';
const DANGER = '#E5484D';

/**
 * Student: read-only weekly timetable, scoped by the backend to this
 * student's enrolled section (AcademicScheduleController::mine, routed as
 * POST /my_schedules). Redesigned as a responsive card list (no horizontal
 * scroll / cut-off columns on a phone-width screen) instead of the previous
 * wide registrar-style table. The backend returns one row per single day a
 * class meets (so a class held Mon/Wed/Fri is 3 separate rows with the same
 * subject/section/time); groupIntoRows below merges same-class rows across
 * days into one card with a combined day code ("MWF"), sorted by the
 * earliest day + start time it occurs.
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
  dayCode: string;
  sortDayIndex: number;
  time: string;
  subject: string;
  room: string;
  campus: string;
  section: string;
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
      dayCode,
      sortDayIndex: dayIndexes[0] ?? 0,
      time: `${formatTime12h(first.starts_at)} - ${formatTime12h(first.ends_at)}`,
      subject: first.subject_name ?? first.code,
      room: first.room_name ?? '',
      campus: first.campus_name ?? '',
      section: first.section_name ?? '',
      instructor: first.teacher_name ?? '',
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
function IconClock({ color }: { color: string }) {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} />
      <Polyline points="12 7 12 12 15 14" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconPin({ color }: { color: string }) {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
      <Path d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Circle cx={12} cy={9.5} r={2.4} stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}
function IconUser({ color }: { color: string }) {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={4} stroke={color} strokeWidth={1.8} />
      <Path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function IconExport({ color }: { color: string }) {
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3v12" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Polyline points="7 8 12 3 17 8" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ScheduleCard({ row }: { row: ScheduleRow }) {
  const meta = [row.room, row.instructor].filter(Boolean);
  return (
    <View style={styles.card}>
      <View style={styles.dayPill}>
        <Text style={styles.dayPillText}>{row.dayCode || '—'}</Text>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.timeRow}>
          <IconClock color={EMERALD} />
          <Text style={styles.timeText}>{row.time}</Text>
        </View>
        <Text style={styles.subjectText} numberOfLines={2}>{row.subject}</Text>
        <View style={styles.metaWrap}>
          {row.room ? (
            <View style={styles.metaItem}>
              <IconPin color={SUBTLE} />
              <Text style={styles.metaText} numberOfLines={1}>{row.room}</Text>
            </View>
          ) : null}
          {row.instructor ? (
            <View style={styles.metaItem}>
              <IconUser color={SUBTLE} />
              <Text style={styles.metaText} numberOfLines={1}>{row.instructor}</Text>
            </View>
          ) : null}
        </View>
        {row.campus || row.section ? (
          <Text style={styles.subMetaText} numberOfLines={1}>
            {[row.campus, row.section].filter(Boolean).join(' · ')}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function CardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton width={46} height={46} borderRadius={12} />
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Skeleton width="40%" height={12} borderRadius={4} />
        <Skeleton width="70%" height={16} borderRadius={4} style={{ marginTop: 10 }} />
        <Skeleton width="55%" height={11} borderRadius={4} style={{ marginTop: 10 }} />
      </View>
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
        [
          { label: t('student_schedule.col_day', 'Day'), width: 55 },
          { label: t('student_schedule.col_time', 'Time'), width: 110 },
          { label: t('student_schedule.col_subject', 'Subject'), width: 175 },
          { label: t('student_schedule.col_room', 'Room'), width: 90 },
          { label: t('student_schedule.col_instructor', 'Instructor'), width: 102 },
        ],
        scheduleRows.map((r) => [r.dayCode, r.time, r.subject, r.room, r.instructor])
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
        <View style={styles.outerScroll}>
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </View>
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

          {scheduleRows.map((row) => (
            <ScheduleCard key={row.key} row={row} />
          ))}
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

  outerScroll: { padding: 16, paddingBottom: 32 },

  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: HAIRLINE,
    padding: 14,
    marginBottom: 12,
  },
  dayPill: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayPillText: { fontSize: 13, fontWeight: '800', color: EMERALD, letterSpacing: 0.3 },
  cardBody: { flex: 1, marginLeft: 14 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeText: { fontSize: 12, fontWeight: '700', color: EMERALD },
  subjectText: { fontSize: 15.5, fontWeight: '700', color: INK, marginTop: 4 },
  metaWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%' },
  metaText: { fontSize: 12, color: SUBTLE, fontWeight: '600' },
  subMetaText: { fontSize: 11, color: SUBTLE, marginTop: 4 },

  empty: { textAlign: 'center', color: SUBTLE, marginTop: 36 },
  errorBanner: { backgroundColor: DANGER_SOFT, borderRadius: 14, padding: 16, marginBottom: 12 },
  errorText: { color: DANGER, fontSize: 13.5, textAlign: 'center' },
});
