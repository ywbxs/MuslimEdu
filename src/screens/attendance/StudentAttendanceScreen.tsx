/**
 * StudentAttendanceScreen
 *
 * Phase 2 - spec SS6 "Attendance: daily/monthly/history, percentages,
 * Present/Late/Excused/Absent, analytics/reports".
 *
 * Pure read view over the student's own records. No student_id is ever sent;
 * the backend scopes to the sanctum token.
 *
 * Implements the SS2-mandated states: loading, empty, error + retry, and a
 * degraded banner when the Phase 2 backend endpoint is not deployed yet.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  AttendanceDay,
  AttendanceStatusKey,
  AttendanceSummary,
  MONTHS,
  fetchAttendance,
} from '../../services/studentAttendanceService';
import { useLocale } from '../../context/LocaleContext';

const STATUS_COLORS: Record<AttendanceStatusKey, string> = {
  present: '#0F7A3D',
  late: '#C77700',
  excused: '#2563EB',
  absent: '#C62828',
  other: '#6B7280',
};

const STATUS_BG: Record<AttendanceStatusKey, string> = {
  present: '#E7F6ED',
  late: '#FFF4E0',
  excused: '#E8F0FE',
  absent: '#FDEAEA',
  other: '#F1F2F4',
};

interface Props {
  navigation?: any;
}

const StudentAttendanceScreen: React.FC<Props> = () => {
  const { t } = useLocale();
  const today = useMemo(() => new Date(), []);
  const [month, setMonth] = useState<number>(today.getMonth() + 1);
  const [year, setYear] = useState<number>(today.getFullYear());

  const [data, setData] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (m: number, y: number, isRefresh = false) => {
      isRefresh ? setRefreshing(true) : setLoading(true);
      setError(null);

      try {
        const result = await fetchAttendance(m, y, 6);
        setData(result);
      } catch (e: any) {
        setData(null);
        setError(
          e?.response?.data?.message ??
            e?.message ??
            t('attendance_calendar.load_error', 'Could not load your attendance. Check your connection and try again.'),
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [t],
  );

  useEffect(() => {
    load(month, year);
  }, [month, year, load]);

  const isFutureMonth = useMemo(() => {
    return year > today.getFullYear() ||
      (year === today.getFullYear() && month >= today.getMonth() + 1);
  }, [month, year, today]);

  const step = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setMonth(m);
    setYear(y);
  };

  const totals = data?.totals;
  const maxTrend = useMemo(
    () => Math.max(1, ...(data?.trend ?? []).map(t => t.total)),
    [data],
  );

  const renderDay = ({ item }: { item: AttendanceDay }) => (
    <View style={styles.dayRow}>
      <View style={styles.dayDate}>
        <Text style={styles.dayNum}>{item.date.slice(-2)}</Text>
        <Text style={styles.dayName}>{item.day_label}</Text>
      </View>

      <View style={styles.dayBody}>
        <Text style={styles.daySubject} numberOfLines={1}>
          {item.is_homeroom ? t('attendance_calendar.homeroom', 'Homeroom') : item.subject_name ?? t('attendance_calendar.class_fallback', 'Class')}
        </Text>
        <Text style={styles.dayMeta}>{item.date}</Text>
      </View>

      <View style={[styles.pill, { backgroundColor: STATUS_BG[item.status_key] }]}>
        <Text style={[styles.pillText, { color: STATUS_COLORS[item.status_key] }]}>
          {item.status_label}
        </Text>
      </View>
    </View>
  );

  const Header = (
    <View>
      <View style={styles.monthBar}>
        <TouchableOpacity style={styles.arrow} onPress={() => step(-1)}>
          <Text style={styles.arrowText}>{'<'}</Text>
        </TouchableOpacity>

        <Text style={styles.monthLabel}>
          {MONTHS[month - 1]} {year}
        </Text>

        <TouchableOpacity
          style={[styles.arrow, isFutureMonth && styles.arrowDisabled]}
          disabled={isFutureMonth}
          onPress={() => step(1)}
        >
          <Text style={[styles.arrowText, isFutureMonth && styles.arrowTextDisabled]}>
            {'>'}
          </Text>
        </TouchableOpacity>
      </View>

      {data?.degraded ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            {t('attendance_calendar.degraded_banner', 'Showing a simplified view. The attendance summary endpoint is not deployed on this server yet.')}
          </Text>
        </View>
      ) : null}

      {totals ? (
        <>
          <View style={styles.rateCard}>
            <Text style={styles.rateValue}>{totals.attendance_rate}%</Text>
            <Text style={styles.rateLabel}>{t('attendance_calendar.rate_label', 'Attendance rate this month')}</Text>
            <Text style={styles.rateSub}>
              {totals.total} {totals.total === 1 ? t('attendance_calendar.record', 'record') : t('attendance_calendar.records', 'records')} {t('attendance_calendar.logged', 'logged')}
            </Text>
          </View>

          <View style={styles.statGrid}>
            {(['present', 'late', 'excused', 'absent'] as AttendanceStatusKey[]).map(k => (
              <View key={k} style={[styles.statCard, { backgroundColor: STATUS_BG[k] }]}>
                <Text style={[styles.statValue, { color: STATUS_COLORS[k] }]}>
                  {totals[k]}
                </Text>
                <Text style={styles.statLabel}>{t(`attendance_calendar.status_${k}`, k.charAt(0).toUpperCase() + k.slice(1))}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {data && data.trend.length > 1 ? (
        <View style={styles.trendCard}>
          <Text style={styles.sectionTitle}>{t('attendance_calendar.last_n_months', 'Last {n} months').replace('{n}', String(data.trend.length))}</Text>

          <View style={styles.trendRow}>
            {data.trend.map(point => {
              const height = Math.max(4, (point.total / maxTrend) * 72);
              const isCurrent = point.month === month && point.year === year;
              return (
                <View key={`${point.year}-${point.month}`} style={styles.trendCol}>
                  <Text style={styles.trendPct}>
                    {point.total > 0 ? `${Math.round(point.attendance_rate)}%` : '-'}
                  </Text>
                  <View
                    style={[
                      styles.trendBar,
                      { height, backgroundColor: isCurrent ? '#0F7A3D' : '#CBD5D1' },
                    ]}
                  />
                  <Text style={styles.trendLabel}>{point.label.split(' ')[0]}</Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>{t('attendance_calendar.daily_record', 'Daily record')}</Text>
    </View>
  );

  if (loading && !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0F7A3D" />
        <Text style={styles.centerText}>{t('attendance_calendar.loading', 'Loading your attendance...')}</Text>
      </View>
    );
  }

  if (error && !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>{t('attendance_calendar.error_title', 'Something went wrong')}</Text>
        <Text style={styles.centerText}>{error}</Text>
        <TouchableOpacity style={styles.retry} onPress={() => load(month, year)}>
          <Text style={styles.retryText}>{t('common.try_again', 'Try again')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={data?.days ?? []}
      keyExtractor={item => String(item.id)}
      renderItem={renderDay}
      ListHeaderComponent={Header}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{t('attendance_calendar.empty_title', 'No attendance recorded')}</Text>
          <Text style={styles.emptyText}>
            {t('attendance_calendar.empty_desc', 'Nothing has been logged for {month} {year} yet.').replace('{month}', MONTHS[month - 1]).replace('{year}', String(year))}
          </Text>
        </View>
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => load(month, year, true)}
          colors={['#0F7A3D']}
        />
      }
    />
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F8FA' },
  content: { padding: 16, paddingBottom: 40 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#F7F8FA' },
  centerText: { marginTop: 12, color: '#6B7280', textAlign: 'center', fontSize: 14 },
  errorTitle: { fontSize: 17, fontWeight: '700', color: '#1F2937' },
  retry: { marginTop: 20, backgroundColor: '#0F7A3D', paddingHorizontal: 24, paddingVertical: 11, borderRadius: 8 },
  retryText: { color: '#FFFFFF', fontWeight: '600' },

  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  arrow: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  arrowDisabled: { backgroundColor: '#EDEFF2' },
  arrowText: { fontSize: 18, color: '#1F2937', fontWeight: '700' },
  arrowTextDisabled: { color: '#B9BFC7' },
  monthLabel: { fontSize: 17, fontWeight: '700', color: '#1F2937' },

  banner: { backgroundColor: '#FFF4E0', borderRadius: 8, padding: 12, marginBottom: 14 },
  bannerText: { color: '#8A5A00', fontSize: 12.5, lineHeight: 18 },

  rateCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 20, alignItems: 'center', marginBottom: 12 },
  rateValue: { fontSize: 40, fontWeight: '800', color: '#0F7A3D' },
  rateLabel: { fontSize: 14, color: '#374151', marginTop: 4, fontWeight: '600' },
  rateSub: { fontSize: 12, color: '#9AA1AB', marginTop: 2 },

  statGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  statCard: { flex: 1, marginHorizontal: 3, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11, color: '#4B5563', marginTop: 2 },

  trendCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 18 },
  trendRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 110, marginTop: 8 },
  trendCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  trendBar: { width: 18, borderRadius: 4, marginTop: 4 },
  trendPct: { fontSize: 10, color: '#6B7280' },
  trendLabel: { fontSize: 10.5, color: '#6B7280', marginTop: 6 },

  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937', marginBottom: 10 },

  dayRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 10, padding: 12, marginBottom: 8 },
  dayDate: { width: 44, alignItems: 'center' },
  dayNum: { fontSize: 17, fontWeight: '700', color: '#1F2937' },
  dayName: { fontSize: 10.5, color: '#9AA1AB' },
  dayBody: { flex: 1, paddingHorizontal: 10 },
  daySubject: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  dayMeta: { fontSize: 11.5, color: '#9AA1AB', marginTop: 2 },
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  pillText: { fontSize: 11.5, fontWeight: '700' },

  empty: { alignItems: 'center', paddingVertical: 36 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#374151' },
  emptyText: { fontSize: 13, color: '#9AA1AB', marginTop: 6, textAlign: 'center' },
});

export default StudentAttendanceScreen;
