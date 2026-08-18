import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Calendar, ArrowRight, DoorOpen, User, Clock } from 'lucide-react-native';
import { fetchMySchedule, AcademicSchedule, Day } from '../services/academicScheduleService';
import { Skeleton, SkeletonCircle } from './Skeleton';
import { COLORS, GLASS, RADIUS, SHADOW } from '../theme/glass';

function formatTime12h(hhmm: string): string {
  const [hStr, mStr] = hhmm.slice(0, 5).split(':');
  let h = parseInt(hStr, 10);
  const m = mStr ?? '00';
  const suffix = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${suffix}`;
}

// Light glass card - same fillOnLight/borderOnLight surface the admin
// menu's cards use, in place of the dark hero-black gradient this used to
// carry. That gradient read as a heavy, disconnected block sitting on the
// white body panel it's actually placed on (dashboard/feed both put this
// on a light background, not the dark hero) - this keeps it in the same
// visual family as everything around it.
const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const EMERALD = COLORS.emerald;
const EMERALD_SOFT = COLORS.emeraldSoft;
const GLASS_SURFACE = GLASS.fillOnLightStrong;
const GLASS_BORDER = GLASS.borderOnLight;
const SKELETON_BASE = '#EDEFF2';

const DAY_INDEX_TO_KEY: Day[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function CalendarIcon({ color = EMERALD, size = 18 }: { color?: string; size?: number }) {
  return <Calendar color={color} size={size} strokeWidth={2} />;
}
function ArrowRightIcon({ color = EMERALD, size = 15 }: { color?: string; size?: number }) {
  return <ArrowRight color={color} size={size} strokeWidth={2} />;
}
function DoorIcon({ color = SUBTLE, size = 12 }: { color?: string; size?: number }) {
  return <DoorOpen color={color} size={size} strokeWidth={2} />;
}
function PersonIcon({ color = SUBTLE, size = 12 }: { color?: string; size?: number }) {
  return <User color={color} size={size} strokeWidth={2} />;
}
function ClockIcon({ color = EMERALD, size = 12 }: { color?: string; size?: number }) {
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
          <SkeletonCircle size={36} baseColor={SKELETON_BASE} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Skeleton width={110} height={14} baseColor={SKELETON_BASE} style={{ marginBottom: 5 }} />
            <Skeleton width={80} height={11} baseColor={SKELETON_BASE} />
          </View>
        </View>
        <Skeleton width="100%" height={44} baseColor={SKELETON_BASE} style={{ borderRadius: 12, marginTop: 12 }} />
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
      <TouchableOpacity style={styles.headerRow} activeOpacity={0.8} onPress={goToSchedule}>
        <View style={styles.iconBox}>
          <CalendarIcon />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: GLASS_SURFACE,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginBottom: 16,
    ...SHADOW.level1,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 14.5, fontWeight: '700', color: INK },
  subtitle: { fontSize: 11.5, color: SUBTLE, marginTop: 1 },
  arrowCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyText: { fontSize: 12.5, color: SUBTLE, marginTop: 12, lineHeight: 17 },

  rows: { marginTop: 10 },
  row: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: GLASS_BORDER },
  timeBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  timeText: { fontSize: 11.5, fontWeight: '700', color: EMERALD },
  subjectText: { fontSize: 13.5, fontWeight: '700', color: INK },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 3 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, color: SUBTLE },

  errorText: { color: COLORS.danger, fontSize: 12.5, textAlign: 'center', marginBottom: 8 },
  retryBtn: { alignSelf: 'center', backgroundColor: EMERALD_SOFT, paddingVertical: 8, paddingHorizontal: 18, borderRadius: 10 },
  retryBtnText: { color: EMERALD, fontWeight: '700', fontSize: 12.5 },
});
