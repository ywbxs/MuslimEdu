import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Award, ChevronLeft } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { fetchStudentQuarterlyReport, QuarterlyReportResponse } from '../../services/studentAcademicService';
import { Skeleton } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import { COLORS, RADIUS, SHADOW } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';

const EMERALD = COLORS.emerald;
const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const HAIRLINE = COLORS.border;
const AMBER = '#92400E';
const AMBER_SOFT = 'rgba(217,158,26,0.16)';
const AMBER_ICON = '#D99E1A';

function ChevronLeftIcon({ color }: { color: string }) {
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}

function scoreColor(value: number | null): string {
  if (value === null) return SUBTLE;
  return INK;
}

/**
 * Student's own quarterly report card - general average, an Honors badge
 * when their average lands in a band the school's Quarterly grading
 * system flagged honors_eligible (see GradingSystemWizardScreen), and a
 * per-subject Q1-Q4 breakdown pulled from whatever exam categories the
 * admin tagged as quarters (AdminExamCategoriesScreen).
 */
export default function StudentQuarterlyReportScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();
  const { t } = useLocale();

  const [report, setReport] = useState<QuarterlyReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const data = await fetchStudentQuarterlyReport(token);
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('student_quarterly_report.load_error', 'Failed to load your report.'));
    }
  }, [token, t]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      load().finally(() => setIsLoading(false));
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }, [load]);

  const hasSubjects = (report?.subjects?.length ?? 0) > 0;

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={10}>
          <ChevronLeftIcon color={EMERALD} />
          <Text style={styles.backText}>{t('common.back', 'Back')}</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>{t('student_quarterly_report.header_title', 'Quarterly Report')}</Text>
        </View>
        <View style={{ width: 72 }} />
      </View>

      {isLoading ? (
        <View style={styles.content}>
          <View style={styles.statsRow}>
            <Skeleton width="48%" height={110} />
            <Skeleton width="48%" height={110} />
          </View>
          <Skeleton width="100%" height={260} style={{ marginTop: 16 }} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={load} style={styles.retryButton}>
            <Text style={styles.retryText}>{t('common.try_again', 'Try again')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={EMERALD} />}
        >
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>{t('student_quarterly_report.general_average', 'General Average')}</Text>
              <Text style={styles.statValue}>
                {report?.general_average != null ? report.general_average.toFixed(2) : '—'}
              </Text>
              {report?.session_id != null ? (
                <Text style={styles.statCaption}>{t('student_quarterly_report.session', 'SY {id}').replace('{id}', String(report.session_id))}</Text>
              ) : null}
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statLabel}>{t('student_quarterly_report.honors', 'Honors')}</Text>
              {report?.honors.eligible ? (
                <View style={styles.honorsBadge}>
                  <Award size={14} color={AMBER} strokeWidth={2.2} />
                  <Text style={styles.honorsBadgeText}>{report.honors.label ?? t('student_quarterly_report.with_honors', 'With Honors')}</Text>
                </View>
              ) : (
                <Text style={styles.statCaption}>{t('student_quarterly_report.no_honors', 'Not yet eligible')}</Text>
              )}
            </View>
          </View>

          {hasSubjects ? (
            <View style={styles.tableCard}>
              <View style={[styles.tableRow, styles.tableHeaderRow]}>
                <Text style={[styles.cellSubject, styles.headerText]}>{t('student_quarterly_report.subject', 'Subject')}</Text>
                <Text style={[styles.cellScore, styles.headerText]}>Q1</Text>
                <Text style={[styles.cellScore, styles.headerText]}>Q2</Text>
                <Text style={[styles.cellScore, styles.headerText]}>Q3</Text>
                <Text style={[styles.cellScore, styles.headerText]}>Q4</Text>
                <Text style={[styles.cellAvg, styles.headerText]}>{t('student_quarterly_report.avg', 'Avg')}</Text>
              </View>

              {report!.subjects.map((s, idx) => (
                <View key={s.subject_id} style={[styles.tableRow, idx > 0 && styles.tableRowDivider]}>
                  <Text style={styles.cellSubject} numberOfLines={1}>
                    {s.subject_name ?? '—'}
                  </Text>
                  <Text style={[styles.cellScore, { color: scoreColor(s.q1) }]}>{s.q1 ?? '—'}</Text>
                  <Text style={[styles.cellScore, { color: scoreColor(s.q2) }]}>{s.q2 ?? '—'}</Text>
                  <Text style={[styles.cellScore, { color: scoreColor(s.q3) }]}>{s.q3 ?? '—'}</Text>
                  <Text style={[styles.cellScore, { color: scoreColor(s.q4) }]}>{s.q4 ?? '—'}</Text>
                  <Text style={styles.cellAvgValue}>{s.avg != null ? s.avg.toFixed(2) : '—'}</Text>
                </View>
              ))}
            </View>
          ) : (
            <EmptyState
              icon="📊"
              title={t('student_quarterly_report.empty_title', 'No quarterly grades yet')}
              subtitle={t(
                'student_quarterly_report.empty_subtitle',
                "Once your teachers enter Q1-Q4 grades, they'll show up here.",
              )}
              colors={{
                accent: EMERALD,
                accentSoft: COLORS.emeraldSoft,
                textPrimary: INK,
                textSecondary: SUBTLE,
              }}
            />
          )}
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', minWidth: 72 },
  backText: { color: EMERALD, fontSize: 16, fontWeight: '600', marginLeft: 2 },
  headerTitleWrap: { alignItems: 'center', flex: 1, paddingHorizontal: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: INK },

  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  errorText: { color: COLORS.danger, textAlign: 'center', marginBottom: 12 },
  retryButton: { backgroundColor: '#EEF0F2', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  retryText: { color: INK, fontWeight: '600' },

  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: HAIRLINE,
    padding: 16,
    ...SHADOW.level1,
  },
  statLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: SUBTLE,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  statValue: { fontSize: 28, fontWeight: '800', color: INK },
  statCaption: { fontSize: 12, color: SUBTLE, marginTop: 8 },
  honorsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: AMBER_SOFT,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  honorsBadgeText: { fontSize: 12.5, fontWeight: '800', color: AMBER },

  tableCard: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingVertical: 4,
    ...SHADOW.level1,
  },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 },
  tableRowDivider: { borderTopWidth: 1, borderTopColor: HAIRLINE },
  tableHeaderRow: { paddingVertical: 12 },
  headerText: { fontSize: 10.5, fontWeight: '800', color: SUBTLE, textTransform: 'uppercase', letterSpacing: 0.4 },
  cellSubject: { flex: 1.6, fontSize: 14, fontWeight: '700', color: INK },
  cellScore: { flex: 1, fontSize: 13.5, textAlign: 'center' },
  cellAvg: { flex: 1, textAlign: 'right' },
  cellAvgValue: { flex: 1, fontSize: 14, fontWeight: '800', color: EMERALD, textAlign: 'right' },
});
