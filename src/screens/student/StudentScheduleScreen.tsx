import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Svg, { Polyline, Line, Circle, Path } from 'react-native-svg';
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

/**
 * Student: read-only weekly timetable, scoped by the backend to this
 * student's enrolled section (AcademicScheduleController::mine, routed as
 * POST /my_schedules).
 *
 * Bento/spatial card list, grouped by full weekday (mirrors
 * TeacherMyScheduleScreen's layout exactly) instead of the earlier
 * registrar-style horizontal-scroll table - the day is a full section
 * header ("Monday", not a compact "M"/"MWF" pill) and every class is its
 * own detailed card (time, subject, code, section, room, campus, unit,
 * instructor), so nothing is summarized down to a badge the way a table
 * cell or an avatar-style day chip would. PDF export still combines a
 * class's multiple weekly meeting days into one row (day code column) -
 * that abbreviation only exists in the exported document, never on screen.
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

function dayLabel(t: (key: string, fallback: string) => string, day: Day): string {
  return t(`student_schedule.day_${day}`, day.charAt(0).toUpperCase() + day.slice(1));
}

interface PdfRow {
  key: string;
  dayCode: string;
  sortDayIndex: number;
  time: string;
  code: string;
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

function formatUnit(units: AcademicSchedule['units']): string | null {
  if (units === null || units === undefined || units === '') return null;
  const n = Number(units);
  if (Number.isNaN(n)) return String(units);
  return Number.isInteger(n) ? String(n) : String(n).replace(/\.?0+$/, '');
}

// PDF export only - groups the same class meeting on different days (same
// subject/section/room/teacher/time) into one exported row with a combined
// day code, e.g. Mon+Wed+Fri -> "MWF". Never used for the on-screen list,
// which shows every day in full.
function groupForPdf(rows: AcademicSchedule[]): PdfRow[] {
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
      code: first.code,
      subject: first.subject_name ?? first.code,
      room: first.room_name ?? '—',
      campus: first.campus_name ?? '—',
      section: first.section_name ?? '—',
      unit: formatUnit(first.units) ?? '—',
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
function IconDoor({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path d="M6 21V4a1 1 0 0 1 1-1h8l3 3v15" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1={6} y1={21} x2={20} y2={21} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Circle cx={13} cy={13} r={0.8} stroke={color} strokeWidth={2} />
    </Svg>
  );
}
function IconMapPin({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path d="M12 21s7-6.6 7-11.5A7 7 0 0 0 5 9.5C5 14.4 12 21 12 21Z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Circle cx={12} cy={9.5} r={2.3} stroke={color} strokeWidth={2} />
    </Svg>
  );
}
function IconPerson({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={3.4} stroke={color} strokeWidth={2} />
      <Path d="M4.5 20c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

// Column labels shared with the PDF export's hand-rolled writer (see
// buildTablePdf) - laid out in points on a fixed ~532pt-wide Letter page.
type PdfColumnKey = keyof Omit<PdfRow, 'key' | 'sortDayIndex'>;
const PDF_COLUMNS: { key: PdfColumnKey; labelKey: string; fallback: string; pdfWidth: number }[] = [
  { key: 'dayCode', labelKey: 'student_schedule.col_day', fallback: 'Day', pdfWidth: 32 },
  { key: 'time', labelKey: 'student_schedule.col_time', fallback: 'Time', pdfWidth: 68 },
  { key: 'code', labelKey: 'student_schedule.col_code', fallback: 'Code', pdfWidth: 45 },
  { key: 'subject', labelKey: 'student_schedule.col_subject', fallback: 'Subject', pdfWidth: 110 },
  { key: 'room', labelKey: 'student_schedule.col_room', fallback: 'Room', pdfWidth: 50 },
  { key: 'campus', labelKey: 'student_schedule.col_campus', fallback: 'Campus', pdfWidth: 65 },
  { key: 'section', labelKey: 'student_schedule.col_section', fallback: 'Section', pdfWidth: 40 },
  { key: 'unit', labelKey: 'student_schedule.col_unit', fallback: 'Unit', pdfWidth: 28 },
  { key: 'instructor', labelKey: 'student_schedule.col_instructor', fallback: 'Instructor', pdfWidth: 80 },
];

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

function CardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton width={50} height={15} borderRadius={4} />
      <View style={{ flex: 1, marginLeft: 24 }}>
        <Skeleton width="55%" height={15} borderRadius={4} style={{ marginBottom: 8 }} />
        <Skeleton width="75%" height={12} borderRadius={4} />
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

  // On-screen: full day-grouped detail, same shape as TeacherMyScheduleScreen
  // - every weekday a class meets gets its own full-name section, every
  // class its own detailed card. No abbreviation, no compact day badge.
  const grouped = useMemo(
    () =>
      DAY_ORDER.map((day) => ({
        day,
        items: rows.filter((r) => r.day_of_week === day).sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
      })).filter((g) => g.items.length > 0),
    [rows]
  );

  const stats = useMemo(() => {
    const subjectCount = new Set(rows.map((r) => r.subject_name ?? r.code)).size;
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
  }, [rows]);

  const handleExportPdf = async () => {
    const pdfRows = groupForPdf(rows);
    if (pdfRows.length === 0 || isExporting) return;
    setIsExporting(true);
    try {
      const pdf = buildTablePdf(
        t('student_schedule.title', 'My Schedule'),
        PDF_COLUMNS.map((c) => ({ label: t(c.labelKey, c.fallback), width: c.pdfWidth })),
        pdfRows.map((r) => PDF_COLUMNS.map((c) => r[c.key]))
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
          disabled={isExporting || rows.length === 0}
          hitSlop={10}
        >
          {isExporting ? (
            <ActivityIndicator size="small" color={EMERALD} />
          ) : (
            <IconExport color={rows.length === 0 ? SUBTLE : EMERALD} />
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
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
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

          {!error && grouped.length === 0 ? (
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

          {grouped.length > 0 ? (
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

              {grouped.map((g) => (
                <View key={g.day} style={styles.dayGroup}>
                  <Text style={styles.dayGroupTitle}>{dayLabel(t, g.day)}</Text>
                  {g.items.map((item) => {
                    const unit = formatUnit(item.units);
                    return (
                      <View key={item.id} style={styles.card}>
                        <View style={styles.time}>
                          <Text style={styles.timeText}>{item.starts_at.slice(0, 5)}</Text>
                          <Text style={styles.to}>{t('student_schedule.to', 'to')}</Text>
                          <Text style={styles.timeText}>{item.ends_at.slice(0, 5)}</Text>
                        </View>
                        <View style={styles.line} />
                        <View style={{ flex: 1 }}>
                          <View style={styles.cardTitleRow}>
                            <Text style={styles.cardTitle} numberOfLines={1}>{item.subject_name ?? item.code}</Text>
                            <View style={[styles.badge, styles.badgeCode]}>
                              <Text style={[styles.badgeText, styles.badgeTextCode]}>{item.code}</Text>
                            </View>
                          </View>
                          <View style={styles.metaRow}>
                            {item.teacher_name ? (
                              <View style={styles.badge}>
                                <IconPerson color={SUBTLE} />
                                <Text style={styles.badgeText}>{item.teacher_name}</Text>
                              </View>
                            ) : null}
                            {item.room_name ? (
                              <View style={styles.badge}>
                                <IconDoor color={SUBTLE} />
                                <Text style={styles.badgeText}>{item.room_name}</Text>
                              </View>
                            ) : null}
                            {item.campus_name ? (
                              <View style={styles.badge}>
                                <IconMapPin color={SUBTLE} />
                                <Text style={styles.badgeText}>{item.campus_name}</Text>
                              </View>
                            ) : null}
                            {item.section_name ? (
                              <View style={styles.badge}>
                                <Text style={styles.badgeText}>{item.section_name}</Text>
                              </View>
                            ) : null}
                            {unit ? (
                              <View style={styles.badge}>
                                <Text style={styles.badgeText}>
                                  {t('student_schedule.unit_badge', '{unit} unit').replace('{unit}', unit)}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ))}
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

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
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

  // --- Day-grouped bento cards: each weekday a class meets gets its own
  // full-name section header, each class its own detailed card. ---
  dayGroup: { marginBottom: 18 },
  dayGroupTitle: { fontSize: 13, fontWeight: '800', color: SUBTLE, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 14,
    marginBottom: 9,
    borderWidth: 1,
    borderColor: HAIRLINE,
    ...SHADOW.level1,
  },
  time: { width: 62 },
  timeText: { fontSize: 14, fontWeight: '800', color: INK },
  to: { fontSize: 10, color: SUBTLE, marginVertical: 2 },
  line: { width: 1, height: 40, backgroundColor: EMERALD, marginHorizontal: 12 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: INK },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: '#F5F7F6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 12, fontWeight: '600', color: SUBTLE },
  badgeCode: { backgroundColor: EMERALD_SOFT },
  badgeTextCode: { color: EMERALD, fontWeight: '800', fontSize: 11 },

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
