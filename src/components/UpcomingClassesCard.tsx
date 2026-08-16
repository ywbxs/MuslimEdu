import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import { Calendar, ArrowRight, DoorOpen, User, Clock } from 'lucide-react-native';
import { fetchMySchedule, AcademicSchedule, Day } from '../services/academicScheduleService';
import { Skeleton, SkeletonCircle } from './Skeleton';

function formatTime12h(hhmm: string): string {
  const [hStr, mStr] = hhmm.slice(0, 5).split(':');
  let h = parseInt(hStr, 10);
  const m = mStr ?? '00';
  const suffix = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${suffix}`;
}

// Dark hero gradient - same black tone the Admin/Teacher/Student dashboard
// heroes already use (HERO_TOP/HERO_BOTTOM), so this card reads as part of
// the same visual language wherever it's dropped (dashboard, feed).
const GRADIENT_TOP = '#1C1C1E';
const GRADIENT_BOTTOM = '#000000';
const PALE_GREEN = '#8FD9AE';
const WHITE = '#FFFFFF';
const FAINT = 'rgba(255,255,255,0.6)';
const FAINTER = 'rgba(255,255,255,0.55)';
const GLASS_FILL = 'rgba(255,255,255,0.12)';
const HAIRLINE = 'rgba(255,255,255,0.14)';
const SKELETON_BASE = 'rgba(255,255,255,0.14)';

const DAY_INDEX_TO_KEY: Day[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function CalendarIcon({ color = PALE_GREEN, size = 22 }: { color?: string; size?: number }) {
  return <Calendar color={color} size={size} strokeWidth={2} />;
}
function ArrowRightIcon({ color = PALE_GREEN, size = 16 }: { color?: string; size?: number }) {
  return <ArrowRight color={color} size={size} strokeWidth={2} />;
}
function DoorIcon({ color = FAINTER, size = 13 }: { color?: string; size?: number }) {
  return <DoorOpen color={color} size={size} strokeWidth={2} />;
}
function PersonIcon({ color = FAINTER, size = 13 }: { color?: string; size?: number }) {
  return <User color={color} size={size} strokeWidth={2} />;
}
function ClockIcon({ color = PALE_GREEN, size = 13 }: { color?: string; size?: number }) {
  return <Clock color={color} size={size} strokeWidth={2} />;
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
 *
 * Dark gradient card - matches the dashboards' own hero black gradient
 * instead of a plain white card, so it reads as a distinct highlight
 * wherever it's dropped (dashboard, feed).
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
      <LinearGradient colors={[GRADIENT_TOP, GRADIENT_BOTTOM]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <View style={styles.headerRow}>
          <SkeletonCircle size={42} baseColor={SKELETON_BASE} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Skeleton width={120} height={16} baseColor={SKELETON_BASE} style={{ marginBottom: 6 }} />
            <Skeleton width={90} height={12} baseColor={SKELETON_BASE} />
          </View>
        </View>
        <Skeleton width="100%" height={54} baseColor={SKELETON_BASE} style={{ borderRadius: 14, marginTop: 14 }} />
      </LinearGradient>
    );
  }

  if (error) {
    return (
      <LinearGradient colors={[GRADIENT_TOP, GRADIENT_BOTTOM]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={load} activeOpacity={0.8}>
          <Text style={styles.retryBtnText}>Try again</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  const preview = todayClasses.slice(0, 3);

  return (
    <LinearGradient colors={[GRADIENT_TOP, GRADIENT_BOTTOM]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
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
              <View style={{ flex: 1 }}>
                <View style={styles.timeBadge}>
                  <ClockIcon />
                  <Text style={styles.timeText}>
                    {formatTime12h(item.starts_at)} - {formatTime12h(item.ends_at)}
                  </Text>
                </View>
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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    padding: 18,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: GLASS_FILL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 16, fontWeight: '700', color: WHITE },
  subtitle: { fontSize: 12, color: FAINT, marginTop: 2 },
  arrowCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: GLASS_FILL,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyText: { fontSize: 13, color: FAINT, marginTop: 16, lineHeight: 18 },

  rows: { marginTop: 14 },
  row: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: HAIRLINE },
  timeBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5 },
  timeText: { fontSize: 12, fontWeight: '700', color: PALE_GREEN },
  subjectText: { fontSize: 14.5, fontWeight: '700', color: WHITE },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11.5, color: FAINTER },

  errorText: { color: '#FF8A8A', fontSize: 13, textAlign: 'center', marginBottom: 10 },
  retryBtn: { alignSelf: 'center', backgroundColor: GLASS_FILL, paddingVertical: 9, paddingHorizontal: 20, borderRadius: 10 },
  retryBtnText: { color: WHITE, fontWeight: '700', fontSize: 13 },
});
