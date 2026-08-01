import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path, Rect, Line, Circle } from 'react-native-svg';
import { fetchMySchedule, AcademicSchedule, Day } from '../services/academicScheduleService';
import { Skeleton, SkeletonCircle } from './Skeleton';

const EMERALD = '#0F9D58';
const EMERALD_SOFT = '#E7F5EC';
const INK = '#1C1C1E';
const SUBTLE = '#8A9099';
const HAIRLINE = '#EDEEF0';

const DAY_INDEX_TO_KEY: Day[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function CalendarIcon({ color = EMERALD, size = 22 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={5} width={16} height={16} rx={2} stroke={color} strokeWidth={2} />
      <Line x1={4} y1={9} x2={20} y2={9} stroke={color} strokeWidth={2} />
      <Line x1={8} y1={3} x2={8} y2={6} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={16} y1={3} x2={16} y2={6} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function ArrowRightIcon({ color = EMERALD, size = 16 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1={4} y1={12} x2={20} y2={12} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M14 6l6 6-6 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function DoorIcon({ color = SUBTLE, size = 13 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 21V4a1 1 0 0 1 1-1h8l3 3v15" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1={6} y1={21} x2={20} y2={21} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Circle cx={13} cy={13} r={0.8} stroke={color} strokeWidth={2} />
    </Svg>
  );
}
function PersonIcon({ color = SUBTLE, size = 13 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={4} stroke={color} strokeWidth={2} />
      <Path d="M4 20c0-3.3 3.6-5 8-5s8 1.7 8 5" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

/**
 * Student dashboard preview card: today's classes at a glance (subject,
 * time, teacher, room), so a student doesn't have to leave Home to see
 * what's next - the full weekly view still lives at StudentSchedule.
 * Regular schools only; orphan schools have no class/schedule concept
 * (caller gates this out for orphan students, same as the "My Schedule"
 * Quick Action tile).
 *
 * Data: same fetchMySchedule() (/my_schedules) the full schedule screen
 * uses - already scoped server-side to this student's enrolled section
 * and published-only, already denormalized with subject/teacher/room
 * names. "Today" is computed client-side from the device's own date.
 */
export default function UpcomingClassesCard({ token }: { token: string }) {
  const navigation = useNavigation();
  const [todayClasses, setTodayClasses] = useState<AcademicSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setIsLoading(true);
    fetchMySchedule(token)
      .then((rows) => {
        const todayKey = DAY_INDEX_TO_KEY[new Date().getDay()];
        const today = rows
          .filter((r) => r.day_of_week === todayKey)
          .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
        setTodayClasses(today);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load your schedule.'))
      .finally(() => setIsLoading(false));
  }, [token]);

  useEffect(load, [load]);

  const goToSchedule = () => (navigation as any).navigate('StudentSchedule');

  if (isLoading) {
    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <SkeletonCircle size={42} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Skeleton width={120} height={16} style={{ marginBottom: 6 }} />
            <Skeleton width={90} height={12} />
          </View>
        </View>
        <Skeleton width="100%" height={54} style={{ borderRadius: 14, marginTop: 14 }} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.card}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={load} activeOpacity={0.8}>
          <Text style={styles.retryBtnText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const preview = todayClasses.slice(0, 3);

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.headerRow} activeOpacity={0.85} onPress={goToSchedule}>
        <View style={styles.iconBox}>
          <CalendarIcon />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.title}>Today's Classes</Text>
          <Text style={styles.subtitle}>Your schedule for today</Text>
        </View>
        <View style={styles.arrowCircle}>
          <ArrowRightIcon />
        </View>
      </TouchableOpacity>

      {preview.length === 0 ? (
        <Text style={styles.emptyText}>No classes scheduled for today.</Text>
      ) : (
        <View style={styles.rows}>
          {preview.map((item) => (
            <View key={item.id} style={styles.row}>
              <View style={styles.timeCol}>
                <Text style={styles.timeText}>{item.starts_at.slice(0, 5)}</Text>
                <Text style={styles.timeSub}>{item.ends_at.slice(0, 5)}</Text>
              </View>
              <View style={styles.divider} />
              <View style={{ flex: 1 }}>
                <Text style={styles.subjectText}>{item.subject_name ?? item.code}</Text>
                <View style={styles.metaRow}>
                  {item.teacher_name ? (
                    <View style={styles.metaItem}>
                      <PersonIcon />
                      <Text style={styles.metaText}>{item.teacher_name}</Text>
                    </View>
                  ) : null}
                  {item.room_name ? (
                    <View style={styles.metaItem}>
                      <DoorIcon />
                      <Text style={styles.metaText}>{item.room_name}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 16, fontWeight: '700', color: INK },
  subtitle: { fontSize: 12, color: SUBTLE, marginTop: 2 },
  arrowCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyText: { fontSize: 13, color: SUBTLE, marginTop: 16, lineHeight: 18 },

  rows: { marginTop: 14 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: HAIRLINE },
  timeCol: { width: 50 },
  timeText: { fontSize: 13, fontWeight: '800', color: INK },
  timeSub: { fontSize: 11, color: SUBTLE, marginTop: 1 },
  divider: { width: 1, height: 32, backgroundColor: HAIRLINE, marginHorizontal: 12 },
  subjectText: { fontSize: 14.5, fontWeight: '700', color: INK },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11.5, color: SUBTLE },

  errorText: { color: '#E5484D', fontSize: 13, textAlign: 'center', marginBottom: 10 },
  retryBtn: { alignSelf: 'center', backgroundColor: EMERALD_SOFT, paddingVertical: 9, paddingHorizontal: 20, borderRadius: 10 },
  retryBtnText: { color: EMERALD, fontWeight: '700', fontSize: 13 },
});
