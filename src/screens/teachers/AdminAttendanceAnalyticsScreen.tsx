import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Polyline, Rect } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { fetchClasses, ClassOption } from '../../services/adminService';
import {
  fetchAttendanceAnalytics,
  fetchAttendanceLocks,
  unlockAttendance,
  AttendanceAnalytics,
  AttendanceStatusCounts,
  AttendanceLockRow,
} from '../../services/adminAttendanceService';
import { Skeleton } from '../../components/Skeleton';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHADOW, GLASS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';
const EMERALD = '#0F9D58';
const EMERALD_SOFT = '#E7F5EC';
const INK = '#1C1C1E';
const SUBTLE = '#8A9099';
const HAIRLINE = '#EDEEF0';
const CANVAS = '#F6F7F9';
const GLASS_SURFACE = GLASS.fillOnLight;
const GLASS_SURFACE_STRONG = GLASS.fillOnLightStrong;
const GLASS_BORDER = GLASS.borderOnLight;

const STATUS_META: Record<keyof AttendanceStatusCounts, { label: string; color: string }> = {
  present: { label: 'Present', color: '#0F9D58' },
  late: { label: 'Late', color: '#B8860B' },
  absent: { label: 'Absent', color: '#E5484D' },
  excused: { label: 'Excused', color: '#4C6EF5' },
  leave: { label: 'Leave', color: '#8A5CF6' },
};
const STATUS_LABEL_KEYS: Record<keyof AttendanceStatusCounts, string> = {
  present: 'present',
  late: 'late',
  absent: 'absent',
  excused: 'excused',
  leave: 'leave',
};

const RANGE_PRESETS: { key: string; label: string; days: number }[] = [
  { key: '7d', label: '7 days', days: 7 },
  { key: '30d', label: '30 days', days: 30 },
  { key: '90d', label: '90 days', days: 90 },
];

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function IconChevronLeft({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Polyline points="15 5 8 12 15 19" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// A minimal same-height bar per day, colored by that day's attendance %
// (present+late over total marked). No chart library in the project, so
// this is hand-rolled with react-native-svg <Rect>s - good enough for a
// glance at the trend without pulling in a dependency for one screen.
function TrendChart({ trend }: { trend: AttendanceAnalytics['daily_trend'] }) {
  const { t } = useLocale();
  const width = 320;
  const height = 120;
  const barGap = 3;
  const barWidth = trend.length > 0 ? Math.max((width - barGap * (trend.length - 1)) / trend.length, 2) : 0;

  const pctFor = (day: AttendanceAnalytics['daily_trend'][number]) => {
    const total = day.present + day.late + day.absent + day.excused + day.leave;
    if (total === 0) return 0;
    return (day.present + day.late) / total;
  };

  if (trend.length === 0) {
    return (
      <View style={styles.trendEmpty}>
        <Text style={styles.trendEmptyText}>{t('admin_attendance_analytics.trend_empty', 'No attendance recorded in this range yet.')}</Text>
      </View>
    );
  }

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {trend.map((day, i) => {
        const pct = pctFor(day);
        const barHeight = Math.max(pct * (height - 8), 2);
        const color = pct >= 0.9 ? '#0F9D58' : pct >= 0.75 ? '#B8860B' : '#E5484D';
        return (
          <Rect
            key={day.date}
            x={i * (barWidth + barGap)}
            y={height - barHeight}
            width={barWidth}
            height={barHeight}
            rx={2}
            fill={color}
          />
        );
      })}
    </Svg>
  );
}

function StatusBar({ counts, total }: { counts: AttendanceStatusCounts; total: number }) {
  if (total === 0) {
    return (
      <View style={styles.statusBarTrack}>
        <View style={[styles.statusBarSegment, { flex: 1, backgroundColor: HAIRLINE }]} />
      </View>
    );
  }
  return (
    <View style={styles.statusBarTrack}>
      {(Object.keys(STATUS_META) as (keyof AttendanceStatusCounts)[]).map((key) =>
        counts[key] > 0 ? (
          <View
            key={key}
            style={[styles.statusBarSegment, { flex: counts[key], backgroundColor: STATUS_META[key].color }]}
          />
        ) : null
      )}
    </View>
  );
}

export default function AdminAttendanceAnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();
  const { t } = useLocale();

  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [rangeKey, setRangeKey] = useState<string>('30d');
  const [analytics, setAnalytics] = useState<AttendanceAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [locks, setLocks] = useState<AttendanceLockRow[]>([]);
  const [isLoadingLocks, setIsLoadingLocks] = useState(true);
  const [unlockingKey, setUnlockingKey] = useState<string | null>(null);

  const range = useMemo(() => {
    const preset = RANGE_PRESETS.find((r) => r.key === rangeKey) ?? RANGE_PRESETS[1];
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - (preset.days - 1));
    return { dateFrom: toISO(from), dateTo: toISO(to) };
  }, [rangeKey]);

  useEffect(() => {
    if (!token) return;
    fetchClasses(token)
      .then(setClasses)
      .catch(() => {
        // Class filter is a nice-to-have - silently fall back to "All classes" only.
      });
  }, [token]);

  const load = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchAttendanceAnalytics(token, {
        classId: selectedClassId,
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
      });
      setAnalytics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin_attendance_analytics.load_error', 'Could not load attendance analytics.'));
    } finally {
      setIsLoading(false);
    }
  }, [token, selectedClassId, range, t]);

  useEffect(() => {
    load();
  }, [load]);

  const loadLocks = useCallback(async () => {
    if (!token) return;
    setIsLoadingLocks(true);
    try {
      const data = await fetchAttendanceLocks(token);
      setLocks(data);
    } catch {
      // Best-effort - the locked-attendance card just shows empty rather
      // than blocking the rest of the analytics screen from loading.
    } finally {
      setIsLoadingLocks(false);
    }
  }, [token]);

  useEffect(() => {
    loadLocks();
  }, [loadLocks]);

  const lockKey = (l: AttendanceLockRow) => `${l.section_id}:${l.subject_id}:${l.date}`;

  const handleUnlock = async (l: AttendanceLockRow) => {
    if (!token) return;
    setUnlockingKey(lockKey(l));
    try {
      await unlockAttendance(token, l.section_id, l.subject_id, l.date);
      setLocks((prev) => prev.filter((row) => lockKey(row) !== lockKey(l)));
    } catch (err) {
      Alert.alert(
        t('admin_attendance_analytics.unlock_error_title', 'Could not unlock'),
        err instanceof Error ? err.message : t('common.try_again_full', 'Please try again.'),
      );
    } finally {
      setUnlockingKey(null);
    }
  };

  const counts = analytics?.status_counts ?? { present: 0, late: 0, absent: 0, excused: 0, leave: 0 };

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
          <IconChevronLeft color={INK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('admin_attendance_analytics.title', 'Attendance Analytics')}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {RANGE_PRESETS.map((preset) => (
            <TouchableOpacity
              key={preset.key}
              style={[styles.chip, rangeKey === preset.key && styles.chipActive]}
              onPress={() => setRangeKey(preset.key)}
            >
              <Text style={[styles.chipText, rangeKey === preset.key && styles.chipTextActive]}>{t(`admin_attendance_analytics.range_${preset.key}`, preset.label)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <TouchableOpacity
            style={[styles.chip, selectedClassId === null && styles.chipActive]}
            onPress={() => setSelectedClassId(null)}
          >
            <Text style={[styles.chipText, selectedClassId === null && styles.chipTextActive]}>{t('admin_attendance_analytics.all_classes', 'All classes')}</Text>
          </TouchableOpacity>
          {classes.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[styles.chip, selectedClassId === c.id && styles.chipActive]}
              onPress={() => setSelectedClassId(c.id)}
            >
              <Text style={[styles.chipText, selectedClassId === c.id && styles.chipTextActive]}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {isLoading ? (
          <View style={styles.statsRow}>
            <Skeleton width="47%" height={90} borderRadius={16} />
            <Skeleton width="47%" height={90} borderRadius={16} />
          </View>
        ) : (
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{analytics?.attendance_percentage ?? 0}%</Text>
              <Text style={styles.statLabel}>{t('admin_attendance_analytics.attendance_rate', 'Attendance rate')}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{analytics?.total_marked ?? 0}</Text>
              <Text style={styles.statLabel}>{t('admin_attendance_analytics.records_marked', 'Records marked')}</Text>
            </View>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('admin_attendance_analytics.status_breakdown', 'Status breakdown')}</Text>
          {isLoading ? (
            <Skeleton width="100%" height={14} borderRadius={7} style={{ marginTop: 12 }} />
          ) : (
            <StatusBar counts={counts} total={analytics?.total_marked ?? 0} />
          )}
          <View style={styles.legendRow}>
            {(Object.keys(STATUS_META) as (keyof AttendanceStatusCounts)[]).map((key) => (
              <View key={key} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: STATUS_META[key].color }]} />
                <Text style={styles.legendText}>
                  {t(`admin_attendance_analytics.status_${STATUS_LABEL_KEYS[key]}`, STATUS_META[key].label)} {counts[key]}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('admin_attendance_analytics.daily_trend', 'Daily trend')}</Text>
          <Text style={styles.cardSubtitle}>{t('admin_attendance_analytics.daily_trend_subtitle', "Bar color reflects that day's attendance rate")}</Text>
          {isLoading ? (
            <Skeleton width="100%" height={120} borderRadius={12} style={{ marginTop: 12 }} />
          ) : (
            <View style={{ marginTop: 12 }}>
              <TrendChart trend={analytics?.daily_trend ?? []} />
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('admin_attendance_analytics.locked_title', 'Locked attendance')}</Text>
          <Text style={styles.cardSubtitle}>
            {t('admin_attendance_analytics.locked_subtitle', 'Submitted days a teacher can no longer edit - unlock one if they made a mistake.')}
          </Text>

          {isLoadingLocks ? (
            <Skeleton width="100%" height={48} borderRadius={12} style={{ marginTop: 12 }} />
          ) : locks.length === 0 ? (
            <Text style={styles.lockedEmptyText}>{t('admin_attendance_analytics.locked_empty', 'Nothing is currently locked.')}</Text>
          ) : (
            <View style={{ marginTop: 12, gap: 8 }}>
              {locks.map((l) => {
                const key = lockKey(l);
                return (
                  <View key={key} style={styles.lockedRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.lockedRowTitle} numberOfLines={1}>
                        {l.section_name ?? t('admin_attendance_analytics.locked_unknown_section', 'Section')}
                        {l.class_name ? ` · ${l.class_name}` : ''}
                        {l.subject_name ? ` · ${l.subject_name}` : ''}
                      </Text>
                      <Text style={styles.lockedRowMeta} numberOfLines={1}>
                        {l.date}
                        {l.locked_by_name ? ` · ${t('admin_attendance_analytics.locked_by_prefix', 'by')} ${l.locked_by_name}` : ''}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.unlockBtn}
                      onPress={() => handleUnlock(l)}
                      disabled={unlockingKey === key}
                      activeOpacity={0.85}
                    >
                      {unlockingKey === key ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text style={styles.unlockBtnText}>{t('admin_attendance_analytics.unlock', 'Unlock')}</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: GLASS_SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: GLASS_BORDER,
  },
  backButton: { width: 32 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: INK },
  scrollContent: { padding: 16, paddingBottom: 40 },

  chipRow: { gap: 8, paddingBottom: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: GLASS_SURFACE,
  ...SHADOW.level1,
  },
  chipActive: { backgroundColor: EMERALD, borderColor: EMERALD },
  chipText: { fontSize: 12.5, fontWeight: '600', color: SUBTLE },
  chipTextActive: { color: '#FFFFFF' },

  errorBanner: { backgroundColor: '#FCEDED', borderRadius: 12, padding: 14, marginBottom: 12 },
  errorText: { color: '#E5484D', fontSize: 13.5, textAlign: 'center' },

  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, gap: 12 },
  statCard: {
    flex: 1,
    backgroundColor: GLASS_SURFACE,
    borderRadius: 16,
    padding: 16,
  ...SHADOW.level1,
  },
  statValue: { fontSize: 24, fontWeight: '800', color: INK },
  statLabel: { fontSize: 12, color: SUBTLE, marginTop: 4 },

  card: {
    backgroundColor: GLASS_SURFACE,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
  ...SHADOW.level1,
  },
  cardTitle: { fontSize: 14.5, fontWeight: '700', color: INK },
  cardSubtitle: { fontSize: 11.5, color: SUBTLE, marginTop: 2 },

  statusBarTrack: {
    flexDirection: 'row',
    height: 14,
    borderRadius: 7,
    overflow: 'hidden',
    marginTop: 14,
  },
  statusBarSegment: { height: '100%' },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11.5, color: SUBTLE, fontWeight: '600' },

  trendEmpty: { paddingVertical: 30, alignItems: 'center' },
  trendEmptyText: { fontSize: 12.5, color: SUBTLE },

  lockedEmptyText: { fontSize: 12.5, color: SUBTLE, marginTop: 12 },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FBF2DE',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  lockedRowTitle: { fontSize: 13, fontWeight: '700', color: INK },
  lockedRowMeta: { fontSize: 11.5, color: SUBTLE, marginTop: 2 },
  unlockBtn: {
    backgroundColor: EMERALD,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    minWidth: 72,
    alignItems: 'center',
  },
  unlockBtnText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' },
});
