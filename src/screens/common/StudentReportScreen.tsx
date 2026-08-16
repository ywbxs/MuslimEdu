import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Layers } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { useAcademicGlassTheme, AcademicGlassTheme } from '../teachers/academicGlassTheme';
import { RADIUS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';
import UserAvatar from '../../components/UserAvatar';
import { fetchStudentReportData, StudentReportData } from '../../services/reportExportService';

/**
 * "Whole student status" report, rendered entirely with native React
 * Native components - no browser, no WebView, no PDF. Nothing leaves the
 * app. See reportExportService.ts's fetchStudentReportData docblock for
 * why: no verified PDF/file/webview module exists in this project, so a
 * plain JSON endpoint + native UI is the only path that stays fully
 * in-app without adding an unverifiable native dependency.
 */

const STATUS_LABELS: Record<string, string> = {
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
  excused: 'Excused',
  leave: 'Leave',
};

function IconChevronLeft({ color }: { color: string }) {
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}
function IconLayers({ color }: { color: string }) {
  return <Layers size={13} color={color} strokeWidth={2} />;
}

function formatMoney(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (Number.isNaN(num)) return null;
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function StudentReportScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const theme = useAcademicGlassTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { token } = useAuth();
  const { t } = useLocale();

  const studentId: number = route.params?.studentId;

  const [data, setData] = useState<StudentReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !studentId) return;
    try {
      setError(null);
      setData(await fetchStudentReportData(token, studentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('student_report.load_error', 'Failed to load this report.'));
    } finally {
      setLoading(false);
    }
  }, [token, studentId, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const totalAttendance = data?.attendance.reduce((sum, a) => sum + a.count, 0) ?? 0;

  return (
    <View style={styles.container}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
          <IconChevronLeft color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, styles.headerTitleFlex]}>{t('student_report.title', 'Student Report')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.accent} />
        </View>
      ) : error || !data ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error ?? t('student_report.not_found', 'Report not found.')}</Text>
          <TouchableOpacity onPress={load}>
            <Text style={styles.retryText}>{t('common.retry', 'Retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.summaryCard}>
            <UserAvatar name={data.student.name} photo={data.student.photo} size={72} ringColor={theme.border} />
            <Text style={styles.studentName}>{data.student.name}</Text>
            <Text style={styles.studentEmail}>{data.student.email}</Text>
            {data.student.section_name ? (
              <View style={styles.sectionChip}>
                <IconLayers color={theme.accent} />
                <Text style={styles.sectionChipText}>
                  {[data.student.class_name, data.student.section_name].filter(Boolean).join(' - ')}
                </Text>
              </View>
            ) : null}
            <Text style={styles.generatedText}>
              {t('student_report.generated', 'Generated {date}').replace('{date}', new Date(data.generated_at).toLocaleString())}
            </Text>
          </View>

          <Text style={styles.sectionLabel}>{t('student_report.attendance', 'Attendance Summary')}</Text>
          {data.attendance.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>{t('student_report.no_attendance', 'No attendance records yet.')}</Text>
            </View>
          ) : (
            <View style={styles.tableCard}>
              {data.attendance.map((a) => (
                <View key={a.status} style={styles.tableRow}>
                  <Text style={styles.tableLabel}>{t(`student_report.status_${a.status}`, STATUS_LABELS[a.status] ?? a.status)}</Text>
                  <Text style={styles.tableValue}>{a.count}</Text>
                </View>
              ))}
              <View style={[styles.tableRow, styles.tableRowTotal]}>
                <Text style={styles.tableTotalLabel}>{t('student_report.total_days', 'Total')}</Text>
                <Text style={styles.tableTotalValue}>{totalAttendance}</Text>
              </View>
            </View>
          )}

          <Text style={[styles.sectionLabel, { marginTop: 24 }]}>{t('student_report.fees', 'Enrollment & Fees')}</Text>
          {data.payments.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>{t('student_report.no_fees', 'No fee records yet.')}</Text>
            </View>
          ) : (
            data.payments.map((p, i) => {
              const statusColors =
                p.status === 'paid'
                  ? { color: theme.success, bg: theme.successSoft }
                  : p.status === 'waived'
                  ? { color: theme.accent, bg: theme.accentSoft }
                  : { color: theme.danger, bg: theme.dangerSoft };
              const amount = formatMoney(p.amount);
              return (
                <View key={i} style={styles.feeRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.feeName}>{p.fee_name ?? t('student_report.fee_fallback', 'Fee')}</Text>
                    {amount ? <Text style={styles.feeAmount}>{amount}</Text> : null}
                  </View>
                  <Text style={[styles.feeStatusBadge, { color: statusColors.color, backgroundColor: statusColors.bg }]}>
                    {t(`student_report.payment_status_${p.status}`, p.status)}
                  </Text>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (theme: AcademicGlassTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerTitle: { fontSize: 20, fontWeight: '700', color: theme.textPrimary },
    headerTitleFlex: { flex: 1, marginLeft: 8 },
    backButton: { width: 32 },
    headerSpacer: { width: 32 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
    errorText: { color: theme.danger, fontSize: 14, textAlign: 'center', marginBottom: 12 },
    retryText: { color: theme.accent, fontWeight: '700', fontSize: 14 },

    content: { padding: 20, paddingBottom: 40 },
    summaryCard: {
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 22,
      ...theme.elevation2,
    },
    studentName: { fontSize: 18, fontWeight: '800', color: theme.textPrimary, marginTop: 12 },
    studentEmail: { fontSize: 12.5, color: theme.textSecondary, marginTop: 2 },
    sectionChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.accentSoft,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 5,
      gap: 6,
      marginTop: 10,
    },
    sectionChipText: { fontSize: 12, fontWeight: '600', color: theme.accent },
    generatedText: { fontSize: 11, color: theme.textMuted, marginTop: 12 },

    sectionLabel: { fontSize: 14, fontWeight: '700', color: theme.textPrimary, marginTop: 24, marginBottom: 10 },
    emptyCard: { backgroundColor: theme.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: theme.border, padding: 16 },
    emptyText: { fontSize: 12.5, color: theme.textSecondary },

    tableCard: {
      backgroundColor: theme.surface,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 6,
      ...theme.elevation2,
    },
    tableRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    tableRowTotal: { borderBottomWidth: 0 },
    tableLabel: { fontSize: 13, color: theme.textPrimary },
    tableValue: { fontSize: 13, fontWeight: '700', color: theme.textPrimary },
    tableTotalLabel: { fontSize: 13, fontWeight: '700', color: theme.accent },
    tableTotalValue: { fontSize: 13, fontWeight: '800', color: theme.accent },

    feeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      marginBottom: 10,
      ...theme.elevation1,
    },
    feeName: { fontSize: 13.5, fontWeight: '700', color: theme.textPrimary },
    feeAmount: { fontSize: 13, color: theme.textSecondary, marginTop: 2 },
    feeStatusBadge: {
      fontSize: 10.5,
      fontWeight: '700',
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 10,
      overflow: 'hidden',
      textTransform: 'capitalize',
    },
  });
