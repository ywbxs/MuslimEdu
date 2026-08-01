import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Svg, { Polyline, Line, Circle, Path } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { AcademicSchedule, Day, fetchMySchedule } from '../../services/academicScheduleService';
import { Skeleton } from '../../components/Skeleton';

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
 * POST /my_schedules) - previously broken (imported functions that didn't
 * exist in scheduleService.ts, so opening this screen crashed). Now wired
 * to the same working endpoint the admin builder and teacher schedule
 * screens use.
 */

const DAYS: Day[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function dayLabel(t: (key: string, fallback: string) => string, day: Day): string {
  return t(`student_schedule.day_${day}`, day.charAt(0).toUpperCase() + day.slice(1));
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

function RowSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton width="45%" height={15} borderRadius={4} />
      <Skeleton width="60%" height={12} borderRadius={4} style={{ marginTop: 10 }} />
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

  const grouped = useMemo(
    () =>
      DAYS.map((day) => ({
        day,
        items: rows.filter((r) => r.day_of_week === day).sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
      })).filter((g) => g.items.length > 0),
    [rows]
  );

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
        <ScrollView contentContainerStyle={styles.list}>
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={EMERALD} />}
        >
          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {!error && grouped.length === 0 ? (
            <Text style={styles.empty}>{t('student_schedule.empty', 'No published schedule yet.')}</Text>
          ) : null}

          {grouped.map((g) => (
            <View key={g.day} style={styles.dayGroup}>
              <Text style={styles.dayGroupTitle}>{dayLabel(t, g.day)}</Text>
              {g.items.map((item) => (
                <View key={item.id} style={styles.card}>
                  <Text style={styles.day}>{dayLabel(t, item.day_of_week)}</Text>
                  <Text style={styles.time}>
                    {item.starts_at.slice(0, 5)} - {item.ends_at.slice(0, 5)}
                  </Text>
                  <Text style={styles.subject}>{item.subject_name ?? item.code}</Text>
                  <View style={styles.metaRow}>
                    {item.teacher_name ? <Text style={styles.meta}>{t('student_schedule.teacher_label', 'Teacher')}: {item.teacher_name}</Text> : null}
                    {item.room_name ? (
                      <View style={styles.roomRow}>
                        <IconDoor color={SUBTLE} />
                        <Text style={styles.meta}>{t('student_schedule.room_label', 'Room')}: {item.room_name}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
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
  list: { padding: 16 },
  dayGroup: { marginBottom: 18 },
  dayGroupTitle: { fontSize: 13, fontWeight: '800', color: SUBTLE, textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 10 },
  day: { fontWeight: '800', color: EMERALD, fontSize: 12, textTransform: 'uppercase' },
  time: { fontSize: 20, fontWeight: '800', color: INK, marginTop: 4 },
  subject: { fontSize: 15, fontWeight: '700', color: INK, marginTop: 6 },
  metaRow: { marginTop: 6, gap: 4 },
  roomRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  meta: { fontSize: 12, color: SUBTLE },
  empty: { textAlign: 'center', color: SUBTLE, marginTop: 36 },
  errorBanner: { backgroundColor: DANGER_SOFT, borderRadius: 14, padding: 16, marginBottom: 12 },
  errorText: { color: DANGER, fontSize: 13.5, textAlign: 'center' },
});
