import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Svg, { Polyline, Line, Circle, Path } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { AcademicSchedule, Day, fetchMySchedule } from '../../services/academicScheduleService';
import { Skeleton } from '../../components/Skeleton';
import { useAcademicGlassTheme, AcademicGlassTheme } from './academicGlassTheme';
import GlassBackground from '../../components/glass/GlassBackground';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Teacher: read-only "my schedule" - the piece that was missing even
 * though the backend (AcademicScheduleController::mine, routed as
 * POST /my_schedules) already fully supported it. Mirrors the student
 * schedule screen's data source; teachers see slots where they're the
 * assigned teacher, published only, resolved via role on the backend.
 *
 * Spatial/glass design pass: same day-grouped card list, brought up to the
 * same level of detail as the student schedule screen - a stats strip up
 * top, plus a period code + campus + unit badge on every class card
 * alongside the existing section/room badges.
 */

const DAYS: Day[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function dayLabel(t: (key: string, fallback: string) => string, day: Day): string {
  return t(`teacher_my_schedule.day_${day}`, day.charAt(0).toUpperCase() + day.slice(1));
}

function formatUnit(units: AcademicSchedule['units']): string | null {
  if (units === null || units === undefined || units === '') return null;
  const n = Number(units);
  if (Number.isNaN(n)) return String(units);
  const label = Number.isInteger(n) ? String(n) : String(n).replace(/\.?0+$/, '');
  return label;
}

function IconChevronLeft({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Polyline points="15 5 8 12 15 19" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
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
function IconBook({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5A1.5 1.5 0 0 1 20 20.5z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}
function IconCalendar({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 9h16M8 4v3M16 4v3" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M4.5 6.5A1.5 1.5 0 0 1 6 5h12a1.5 1.5 0 0 1 1.5 1.5V19A1.5 1.5 0 0 1 18 20.5H6A1.5 1.5 0 0 1 4.5 19V6.5Z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}
function IconClock({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" stroke={color} strokeWidth={1.8} />
      <Path d="M12 7v5l3.5 2" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function RowSkeleton({ styles, theme }: { styles: any; theme: AcademicGlassTheme }) {
  return (
    <View style={styles.card}>
      <Skeleton width="45%" height={15} borderRadius={4} baseColor={theme.skeletonBase} />
      <Skeleton width="60%" height={12} borderRadius={4} style={{ marginTop: 10 }} baseColor={theme.skeletonBase} />
    </View>
  );
}

function StatTile({
  styles,
  theme,
  icon,
  value,
  label,
}: {
  styles: any;
  theme: AcademicGlassTheme;
  icon: React.ReactElement;
  value: string;
  label: string;
}) {
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

export default function TeacherMyScheduleScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();
  const { t } = useLocale();
  const theme = useAcademicGlassTheme('emerald');
  const styles = useMemo(() => makeStyles(theme), [theme]);

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
        setError(err instanceof Error ? err.message : t('teacher_my_schedule.load_error', 'Could not load your schedule.'));
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

  const grouped = DAYS.map((day) => ({
    day,
    items: rows.filter((r) => r.day_of_week === day).sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
  })).filter((g) => g.items.length > 0);

  // Detail strip up top - weekly meetings, distinct subjects, and total
  // weekly teaching hours - so this screen carries the same level of
  // detail as the student schedule screen, above the day-grouped cards.
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

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
          <IconChevronLeft color={theme.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {t('teacher_my_schedule.header_title', 'My Schedule')}
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {t('teacher_my_schedule.header_subtitle', 'Your weekly timetable')}
          </Text>
        </View>
        <View style={styles.backButton} />
      </View>

      {isLoading ? (
        <View style={styles.listContent}>
          <View style={styles.statsRow}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.statTile}>
                <Skeleton width={32} height={32} borderRadius={10} baseColor={theme.skeletonBase} style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Skeleton width="60%" height={15} borderRadius={4} baseColor={theme.skeletonBase} style={{ marginBottom: 6 }} />
                  <Skeleton width="80%" height={10} borderRadius={4} baseColor={theme.skeletonBase} />
                </View>
              </View>
            ))}
          </View>
          <RowSkeleton styles={styles} theme={theme} />
          <RowSkeleton styles={styles} theme={theme} />
          <RowSkeleton styles={styles} theme={theme} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
        >
          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {!error && grouped.length === 0 ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconWrap}>
                <IconCalendar color={theme.accent} size={26} />
              </View>
              <Text style={styles.emptyTitle}>{t('teacher_my_schedule.empty_title', 'No published schedule yet')}</Text>
              <Text style={styles.emptyDesc}>{t('teacher_my_schedule.empty_desc', 'Your admin has not published your class schedule yet.')}</Text>
            </View>
          ) : null}

          {grouped.length > 0 ? (
            <View style={styles.statsRow}>
              <StatTile
                styles={styles}
                theme={theme}
                icon={<IconBook color={theme.accent} />}
                value={String(stats.meetings)}
                label={t('teacher_my_schedule.stat_meetings', 'Weekly meetings')}
              />
              <StatTile
                styles={styles}
                theme={theme}
                icon={<IconCalendar color={theme.accent} />}
                value={String(stats.subjects)}
                label={t('teacher_my_schedule.stat_subjects', 'Subjects')}
              />
              <StatTile
                styles={styles}
                theme={theme}
                icon={<IconClock color={theme.accent} />}
                value={stats.hoursLabel}
                label={t('teacher_my_schedule.stat_hours', 'Hours / week')}
              />
            </View>
          ) : null}

          {grouped.map((g) => (
            <View key={g.day} style={styles.dayGroup}>
              <Text style={styles.dayGroupTitle}>{dayLabel(t, g.day)}</Text>
              {g.items.map((item) => {
                const unit = formatUnit(item.units);
                return (
                  <View key={item.id} style={styles.card}>
                    <View style={styles.time}>
                      <Text style={styles.timeText}>{item.starts_at.slice(0, 5)}</Text>
                      <Text style={styles.to}>{t('teacher_my_schedule.to', 'to')}</Text>
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
                        {item.section_name ? (
                          <View style={[styles.badge, styles.badgeSchedule]}>
                            <Text style={[styles.badgeText, styles.badgeTextSchedule]}>{item.section_name}</Text>
                          </View>
                        ) : null}
                        {item.room_name ? (
                          <View style={[styles.badge, styles.badgeSchedule]}>
                            <IconDoor color={theme.textSecondary} />
                            <Text style={[styles.badgeText, styles.badgeTextSchedule]}>{item.room_name}</Text>
                          </View>
                        ) : null}
                        {item.campus_name ? (
                          <View style={[styles.badge, styles.badgeSchedule]}>
                            <IconMapPin color={theme.textSecondary} />
                            <Text style={[styles.badgeText, styles.badgeTextSchedule]}>{item.campus_name}</Text>
                          </View>
                        ) : null}
                        {unit ? (
                          <View style={[styles.badge, styles.badgeSchedule]}>
                            <Text style={[styles.badgeText, styles.badgeTextSchedule]}>
                              {t('teacher_my_schedule.unit_badge', '{unit} unit').replace('{unit}', unit)}
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
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (theme: AcademicGlassTheme) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingBottom: 16,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    backButton: { width: 32 },
    headerTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary, textAlign: 'center' },
    headerSubtitle: { fontSize: 12.5, color: theme.textSecondary, textAlign: 'center', marginTop: 2 },
    listContent: { padding: 16 },

    // --- Detail strip: same rows as the cards below, summarized. ---
    statsRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
    statTile: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 12,
      ...theme.elevation1,
    },
    statIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: theme.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    statValue: { fontSize: 16, fontWeight: '800', color: theme.textPrimary },
    statLabel: { fontSize: 10, color: theme.textSecondary, marginTop: 1 },

    dayGroup: { marginBottom: 18 },
    dayGroupTitle: { fontSize: 13, fontWeight: '800', color: theme.textSecondary, textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 14,
      marginBottom: 9,
      borderWidth: 1,
      borderColor: theme.border,
      ...theme.elevation1,
    },
    time: { width: 62 },
    timeText: { fontSize: 14, fontWeight: '800', color: theme.textPrimary },
    to: { fontSize: 10, color: theme.textSecondary, marginVertical: 2 },
    line: { width: 1, height: 40, backgroundColor: theme.accent, marginHorizontal: 12 },
    cardTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
    cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: theme.textPrimary },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      alignSelf: 'flex-start',
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    badgeSchedule: { backgroundColor: theme.background },
    badgeText: { fontSize: 12, fontWeight: '600' },
    badgeTextSchedule: { color: theme.textSecondary },
    badgeCode: { backgroundColor: theme.accentSoft },
    badgeTextCode: { color: theme.accentSoftText, fontWeight: '800', fontSize: 11 },
    emptyWrap: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
    emptyIconWrap: {
      width: 64,
      height: 64,
      borderRadius: 20,
      backgroundColor: theme.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, marginBottom: 8 },
    emptyDesc: { fontSize: 13.5, color: theme.textSecondary, textAlign: 'center', lineHeight: 19 },
    errorBanner: { backgroundColor: theme.dangerSoft, borderRadius: 12, padding: 14, marginBottom: 12 },
    errorText: { color: theme.danger, fontSize: 13.5, textAlign: 'center' },
  });
