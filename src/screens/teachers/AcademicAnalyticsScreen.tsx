import React, { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Users, GraduationCap, CalendarCheck, Award, FileDown } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { EMERALD_SOFT, INK, SUBTLE } from '../dashboards/DashboardShell';
import { BRAND } from '../../theme/glass';
import { Skeleton } from '../../components/Skeleton';
import { Analytics, fetchAcademicAnalytics, fetchAttendanceTrend, TrendPoint } from '../../services/academicAnalyticsService';
import { fetchSetupStatus, SchoolProfile } from '../../services/academicSetupService';
import { buildSectionedReportPdf, ReportBlock } from '../../utils/pdfExport';
import { saveTextFileToDevice } from '../../utils/downloadFile';
import { MetricIconKey, MetricBreakdownRow } from './AcademicMetricDetailScreen';

function labelizeToken(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ');
}

/**
 * Read-only school performance overview - reached from the admin
 * dashboard's AnalyticsCard "View Analytics" button.
 *
 * Redesign:
 * - Loading is a skeleton shaped like the real layout instead of a
 *   blocking spinner.
 * - The 4 snapshot cards are tappable, opening AcademicMetricDetailScreen
 *   (a focused "wizard" per metric) - only ever showing fields the API
 *   already returned (attendance's present/late/absent/excused breakdown,
 *   grades' graded_records count), never inventing new numbers.
 * - Enrollment statuses render as an actual horizontal bar graph instead
 *   of a plain list of label/count rows.
 * - A header "Export PDF" button builds a full report (snapshot, monthly
 *   attendance, enrollment breakdown) via the app's existing hand-rolled
 *   PDF writer (utils/pdfExport.ts - there's no native PDF library linked
 *   into this bare RN project, see that file's own docblock) and saves it
 *   with the same saveTextFileToDevice flow StudentScheduleScreen uses.
 */

const BORDER = '#E2E8E4';
const CANVAS = '#F5F7F6';

function IconChevronLeft({ color }: { color: string }) {
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}
function IconChevronRight({ color }: { color: string }) {
  return <ChevronRight size={16} color={color} strokeWidth={2.2} />;
}
function IconFileDown({ color }: { color: string }) {
  return <FileDown size={19} color={color} strokeWidth={2} />;
}
function MetricGlyph({ iconKey, color }: { iconKey: MetricIconKey; color: string }) {
  switch (iconKey) {
    case 'students':
      return <Users size={20} color={color} strokeWidth={1.8} />;
    case 'teachers':
      return <GraduationCap size={20} color={color} strokeWidth={1.8} />;
    case 'attendance':
      return <CalendarCheck size={20} color={color} strokeWidth={1.8} />;
    case 'grades':
      return <Award size={20} color={color} strokeWidth={1.8} />;
  }
}

function MetricCard({
  iconKey,
  label,
  value,
  sub,
  onPress,
}: {
  iconKey: MetricIconKey;
  label: string;
  value: string;
  sub: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.metric} activeOpacity={0.75} onPress={onPress}>
      <View style={styles.metricTopRow}>
        <View style={styles.metricIconWrap}>
          <MetricGlyph iconKey={iconKey} color={BRAND.emeraldDeep} />
        </View>
        <IconChevronRight color={SUBTLE} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricSub}>{sub}</Text>
    </TouchableOpacity>
  );
}

function SnapshotSkeleton() {
  return (
    <View style={styles.grid}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={styles.metric}>
          <Skeleton width={36} height={36} style={{ borderRadius: 10, marginBottom: 12 }} />
          <Skeleton width={50} height={26} style={{ borderRadius: 6, marginBottom: 8 }} />
          <Skeleton width="70%" height={13} style={{ borderRadius: 4 }} />
        </View>
      ))}
    </View>
  );
}

export default function AcademicAnalyticsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const { t } = useLocale();

  const [data, setData] = useState<Analytics | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [school, setSchool] = useState<SchoolProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [a, b, setup] = await Promise.all([
        fetchAcademicAnalytics(token),
        fetchAttendanceTrend(token),
        fetchSetupStatus(token).catch(() => null),
      ]);
      setData(a);
      setTrend(b);
      // Best-effort - the PDF export just omits the school-details section
      // if this fails rather than blocking the whole screen on it.
      if (setup) setSchool(setup.school);
    } catch {
      // The screen already renders nothing when `data` stays null - no
      // separate error UI needed for a read-only overview.
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const openMetric = (iconKey: MetricIconKey, title: string, value: string, sub: string, breakdown?: MetricBreakdownRow[]) => {
    (navigation as any).navigate('AcademicMetricDetail', { icon: iconKey, title, value, sub, breakdown });
  };

  const onExportPdf = async () => {
    if (!data || exporting) return;
    setExporting(true);
    try {
      const blocks: ReportBlock[] = [
        { kind: 'title', text: t('academic_analytics.title', 'Academic Analytics') },
        { kind: 'subtitle', text: school?.name ?? t('academic_analytics.report_subtitle', 'School performance report') },
        { kind: 'spacer', height: 10 },
        { kind: 'section', text: t('academic_analytics.school_details', 'School details') },
        { kind: 'kv', label: t('academic_analytics.school_name', 'Name'), value: school?.name ?? '—' },
        { kind: 'kv', label: t('academic_analytics.school_address', 'Address'), value: school?.address ?? '—' },
        { kind: 'kv', label: t('academic_analytics.school_phone', 'Phone'), value: school?.phone ?? '—' },
        { kind: 'kv', label: t('academic_analytics.school_email', 'Email'), value: school?.email ?? '—' },
        { kind: 'kv', label: t('academic_analytics.institution_type', 'Institution type'), value: school?.institution_type ? labelizeToken(school.institution_type) : '—' },
        { kind: 'divider' },

        { kind: 'section', text: t('academic_analytics.report_info', 'Report generated by') },
        { kind: 'kv', label: t('academic_analytics.generated_by_name', 'Name'), value: user?.name ?? '—' },
        { kind: 'kv', label: t('academic_analytics.generated_by_role', 'Role'), value: user?.role ? labelizeToken(user.role) : '—' },
        { kind: 'kv', label: t('academic_analytics.generated_at', 'Generated at'), value: new Date(data.generated_at).toLocaleString() },
        { kind: 'divider' },

        { kind: 'section', text: t('academic_analytics.school_snapshot', 'School snapshot') },
        { kind: 'kv', label: t('academic_analytics.students', 'Students'), value: String(data.summary.students) },
        { kind: 'kv', label: t('academic_analytics.teachers', 'Teachers'), value: String(data.summary.teachers) },
        { kind: 'kv', label: t('academic_analytics.sections', 'Sections'), value: String(data.summary.sections) },
        { kind: 'kv', label: t('academic_analytics.subjects', 'Subjects'), value: String(data.summary.subjects) },
        { kind: 'kv', label: t('academic_analytics.attendance', 'Attendance'), value: data.summary.attendance_rate == null ? '—' : `${data.summary.attendance_rate}%` },
        { kind: 'kv', label: t('academic_analytics.grade_average', 'Grade average'), value: data.summary.grade_average == null ? '—' : String(data.summary.grade_average) },
        { kind: 'divider' },

        { kind: 'section', text: t('academic_analytics.attendance_by_month', 'Attendance by month') },
        ...(trend.length === 0
          ? [{ kind: 'note', text: t('academic_analytics.no_attendance_pdf', 'No attendance records yet.') } as ReportBlock]
          : trend.map((x): ReportBlock => {
              const total = Math.max(1, x.present + x.late + x.absent + x.excused);
              const present = x.present + x.late;
              return { kind: 'bar', label: x.month, value: `${present}/${total}`, pct: (present / total) * 100 };
            })),
        { kind: 'divider' },

        { kind: 'section', text: t('academic_analytics.enrollment_statuses', 'Enrollment statuses') },
        { kind: 'kv', label: t('academic_analytics.active_enrollments', 'Active enrollments'), value: String(data.enrollment.active) },
        ...(Object.keys(data.enrollment.statuses).length === 0
          ? [{ kind: 'note', text: t('academic_analytics.no_enrollment', 'No enrollment records yet.') } as ReportBlock]
          : (() => {
              const maxCount = Math.max(1, ...Object.values(data.enrollment.statuses));
              return Object.entries(data.enrollment.statuses).map(
                ([k, v]): ReportBlock => ({ kind: 'bar', label: labelizeToken(k), value: String(v), pct: (v / maxCount) * 100 }),
              );
            })()),
      ];

      const pdf = buildSectionedReportPdf(blocks);
      const fileName = `academic-analytics-${Date.now()}.pdf`;
      const savedPath = await saveTextFileToDevice(pdf, fileName, 'ascii');
      Alert.alert(
        t('common.done', 'Done'),
        t('academic_analytics.export_success', 'The analytics report was saved to your device: {path}').replace('{path}', savedPath),
      );
    } catch (err) {
      Alert.alert(
        t('academic_analytics.export_error_title', 'Could not export'),
        err instanceof Error ? err.message : t('common.try_again_full', 'Please try again.'),
      );
    } finally {
      setExporting(false);
    }
  };

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back} hitSlop={8}>
        <IconChevronLeft color={BRAND.emeraldDeep} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{t('academic_analytics.title', 'Academic Analytics')}</Text>
        <Text style={styles.sub}>{t('academic_analytics.subtitle', 'Read-only school performance overview')}</Text>
      </View>
      <TouchableOpacity onPress={onExportPdf} style={styles.exportBtn} hitSlop={8} disabled={!data || exporting}>
        <IconFileDown color={data && !exporting ? BRAND.emeraldDeep : SUBTLE} />
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.flex}>
        {header}
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.section}>{t('academic_analytics.school_snapshot', 'SCHOOL SNAPSHOT')}</Text>
          <SnapshotSkeleton />
        </ScrollView>
      </View>
    );
  }

  const maxStatusCount = data ? Math.max(1, ...Object.values(data.enrollment.statuses)) : 1;

  return (
    <View style={styles.flex}>
      {header}
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={BRAND.emeraldDeep} />}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 30 }]}
      >
        {data ? (
          <>
            <Text style={styles.section}>{t('academic_analytics.school_snapshot', 'SCHOOL SNAPSHOT')}</Text>
            <View style={styles.grid}>
              <MetricCard
                iconKey="students"
                label={t('academic_analytics.students', 'Students')}
                value={String(data.summary.students)}
                sub={t('academic_analytics.enrolled_users', 'enrolled users')}
                onPress={() =>
                  openMetric('students', t('academic_analytics.students', 'Students'), String(data.summary.students), t('academic_analytics.enrolled_users', 'enrolled users'))
                }
              />
              <MetricCard
                iconKey="teachers"
                label={t('academic_analytics.teachers', 'Teachers')}
                value={String(data.summary.teachers)}
                sub={t('academic_analytics.teaching_users', 'teaching users')}
                onPress={() =>
                  openMetric('teachers', t('academic_analytics.teachers', 'Teachers'), String(data.summary.teachers), t('academic_analytics.teaching_users', 'teaching users'))
                }
              />
              <MetricCard
                iconKey="attendance"
                label={t('academic_analytics.attendance', 'Attendance')}
                value={data.summary.attendance_rate == null ? '—' : `${data.summary.attendance_rate}%`}
                sub={`${data.attendance.total} ${t('academic_analytics.records', 'records')}`}
                onPress={() =>
                  openMetric(
                    'attendance',
                    t('academic_analytics.attendance', 'Attendance'),
                    data.summary.attendance_rate == null ? '—' : `${data.summary.attendance_rate}%`,
                    `${data.attendance.total} ${t('academic_analytics.records', 'records')}`,
                    [
                      { label: t('academic_analytics.present', 'Present'), value: String(data.attendance.present) },
                      { label: t('academic_analytics.late', 'Late'), value: String(data.attendance.late) },
                      { label: t('academic_analytics.absent', 'Absent'), value: String(data.attendance.absent) },
                      { label: t('academic_analytics.excused', 'Excused'), value: String(data.attendance.excused) },
                      { label: t('academic_analytics.total_records', 'Total records'), value: String(data.attendance.total) },
                    ],
                  )
                }
              />
              <MetricCard
                iconKey="grades"
                label={t('academic_analytics.grade_average', 'Grade average')}
                value={data.summary.grade_average == null ? '—' : String(data.summary.grade_average)}
                sub={`${data.grades.graded_records} ${t('academic_analytics.grades', 'grades')}`}
                onPress={() =>
                  openMetric(
                    'grades',
                    t('academic_analytics.grade_average', 'Grade average'),
                    data.summary.grade_average == null ? '—' : String(data.summary.grade_average),
                    `${data.grades.graded_records} ${t('academic_analytics.grades', 'grades')}`,
                    [
                      { label: t('academic_analytics.average', 'Average'), value: data.grades.average == null ? '—' : String(data.grades.average) },
                      { label: t('academic_analytics.graded_records', 'Graded records'), value: String(data.grades.graded_records) },
                    ],
                  )
                }
              />
            </View>

            <Text style={styles.section}>{t('academic_analytics.attendance_by_month', 'ATTENDANCE BY MONTH')}</Text>
            {trend.length === 0 ? (
              <Text style={styles.muted}>
                {t('academic_analytics.no_attendance', 'No attendance records yet. Analytics stays blank instead of inventing performance.')}
              </Text>
            ) : (
              <View style={styles.card}>
                <View style={styles.legendRow}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: BRAND.emeraldDeep }]} />
                    <Text style={styles.legendText}>{t('academic_analytics.legend_present', 'Present / late')}</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#E2E8E4' }]} />
                    <Text style={styles.legendText}>{t('academic_analytics.legend_absent', 'Absent / excused')}</Text>
                  </View>
                </View>
                {trend.map((x, i) => {
                  const total = Math.max(1, x.present + x.late + x.absent + x.excused);
                  const pct = Math.min(100, ((x.present + x.late) / total) * 100);
                  return (
                    <View key={x.month} style={[styles.barRow, i !== trend.length - 1 && styles.rowDivider]}>
                      <Text style={styles.month}>{x.month}</Text>
                      <View style={styles.barTrack}>
                        <View style={[styles.barPresent, { width: `${pct}%` }]} />
                      </View>
                      <Text style={styles.barValue}>
                        {x.present + x.late}/{total}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            <Text style={styles.section}>{t('academic_analytics.enrollment_statuses', 'ENROLLMENT STATUSES')}</Text>
            <View style={styles.card}>
              <View style={styles.statusHeadRow}>
                <Text style={styles.big}>{data.enrollment.active}</Text>
                <Text style={styles.muted}>{t('academic_analytics.enrollment_note', 'records returned from the authoritative enrollment source')}</Text>
              </View>
              {Object.keys(data.enrollment.statuses).length === 0 ? (
                <Text style={styles.muted}>{t('academic_analytics.no_enrollment', 'No enrollment records yet.')}</Text>
              ) : (
                Object.entries(data.enrollment.statuses).map(([k, v], i, arr) => (
                  <View key={k} style={[styles.statusGraphRow, i !== arr.length - 1 && styles.rowDivider]}>
                    <Text style={styles.statusName}>{k}</Text>
                    <View style={styles.statusBarTrack}>
                      <View style={[styles.statusBarFill, { width: `${Math.max(6, (v / maxStatusCount) * 100)}%` }]} />
                    </View>
                    <Text style={styles.statusValue}>{v}</Text>
                  </View>
                ))
              )}
            </View>

            <Text style={styles.foot}>
              {t('academic_analytics.generated', 'Generated')} {new Date(data.generated_at).toLocaleString()}
            </Text>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: CANVAS },
  muted: { color: SUBTLE, fontSize: 13, lineHeight: 19, marginTop: 8 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: '#FFF',
    shadowColor: '#0B1F14',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  back: { width: 38, height: 38, borderRadius: 19, backgroundColor: EMERALD_SOFT, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  title: { fontSize: 20, fontWeight: '800', color: INK },
  sub: { fontSize: 12.5, color: SUBTLE, marginTop: 2 },
  exportBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: EMERALD_SOFT, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },

  content: { padding: 16 },
  section: { fontSize: 11, fontWeight: '900', letterSpacing: 1, color: SUBTLE, marginTop: 22, marginBottom: 10 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  metric: { width: '48%', backgroundColor: '#FFF', borderRadius: 16, padding: 15, marginBottom: 10, borderWidth: 1, borderColor: BORDER },
  metricTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  metricIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: EMERALD_SOFT, alignItems: 'center', justifyContent: 'center' },
  metricValue: { fontSize: 25, fontWeight: '900', color: INK },
  metricLabel: { fontSize: 13, fontWeight: '800', color: INK, marginTop: 3 },
  metricSub: { fontSize: 11, color: SUBTLE, marginTop: 3 },

  card: { backgroundColor: '#FFF', borderRadius: 16, borderWidth: 1, borderColor: BORDER, overflow: 'hidden' },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: BORDER },

  legendRow: { flexDirection: 'row', gap: 16, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: BORDER },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: SUBTLE, fontWeight: '600' },

  barRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14 },
  month: { width: 56, fontSize: 11, color: SUBTLE, fontWeight: '700' },
  barTrack: { height: 9, backgroundColor: '#E8EEE9', borderRadius: 9, flex: 1, overflow: 'hidden', marginHorizontal: 8 },
  barPresent: { height: 9, backgroundColor: BRAND.emeraldDeep, borderRadius: 9 },
  barValue: { width: 50, textAlign: 'right', fontSize: 11, color: INK, fontWeight: '800' },

  statusHeadRow: { padding: 16, borderBottomWidth: 1, borderBottomColor: BORDER },
  big: { fontSize: 28, fontWeight: '900', color: BRAND.emeraldDeep },
  statusGraphRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14 },
  statusName: { width: 80, color: INK, fontSize: 12.5, fontWeight: '700', textTransform: 'capitalize' },
  statusBarTrack: { flex: 1, height: 9, backgroundColor: '#F1F3F2', borderRadius: 9, marginHorizontal: 8, overflow: 'hidden' },
  statusBarFill: { height: 9, backgroundColor: BRAND.emeraldDeep, borderRadius: 9 },
  statusValue: { width: 30, textAlign: 'right', color: INK, fontWeight: '800', fontSize: 12.5 },

  foot: { fontSize: 11, color: SUBTLE, textAlign: 'center', marginTop: 22 },
});
