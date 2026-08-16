import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ClipboardList, ArrowRight, Check, Clock, Calendar, BookOpen, User, DoorOpen } from 'lucide-react-native';
import { fetchMySchedule, AcademicSchedule } from '../services/academicScheduleService';
import { Skeleton, SkeletonCircle } from './Skeleton';
import { COLORS, RADIUS, SHADOW, SPACING } from '../theme/glass';

const EMERALD = COLORS.emerald;
const EMERALD_SOFT = COLORS.emeraldSoft;
const AMBER = '#B45309';
const AMBER_SOFT = '#FEF3C7';
const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const SURFACE = COLORS.surface;

function ClipboardIcon({ color = EMERALD, size = 22 }: { color?: string; size?: number }) {
  return <ClipboardList color={color} size={size} strokeWidth={2} />;
}
function ArrowRightIcon({ color = EMERALD, size = 16 }: { color?: string; size?: number }) {
  return <ArrowRight color={color} size={size} strokeWidth={2} />;
}
function CheckIcon({ color = '#FFFFFF', size = 10 }: { color?: string; size?: number }) {
  return <Check color={color} size={size} strokeWidth={3} />;
}
function ClockIcon({ color = '#FFFFFF', size = 10 }: { color?: string; size?: number }) {
  return <Clock color={color} size={size} strokeWidth={3} />;
}
function CalendarIcon({ color, size = 20 }: { color: string; size?: number }) {
  return <Calendar color={color} size={size} strokeWidth={2} />;
}
function BookIcon({ color, size = 20 }: { color: string; size?: number }) {
  return <BookOpen color={color} size={size} strokeWidth={2} />;
}
function PersonIcon({ color, size = 20 }: { color: string; size?: number }) {
  return <User color={color} size={size} strokeWidth={2} />;
}
function DoorIcon({ color, size = 20 }: { color: string; size?: number }) {
  return <DoorOpen color={color} size={size} strokeWidth={2} />;
}

interface StatusItem {
  key: string;
  label: string;
  assigned: boolean;
  Icon: (props: { color: string; size?: number }) => React.JSX.Element;
}

function computeStatus(rows: AcademicSchedule[]): StatusItem[] {
  return [
    { key: 'schedule', label: 'Days & Time', assigned: rows.length > 0, Icon: CalendarIcon },
    { key: 'subject', label: 'Subject', assigned: rows.some((r) => !!r.subject_name), Icon: BookIcon },
    { key: 'teacher', label: 'Teacher', assigned: rows.some((r) => !!r.teacher_name), Icon: PersonIcon },
    { key: 'room', label: 'Room', assigned: rows.some((r) => !!r.room_name), Icon: DoorIcon },
  ];
}

/**
 * Student dashboard/menu card: at-a-glance enrollment/schedule status - has
 * the school assigned this student a teacher, subject, room, and class
 * days/time yet? Distinct from UpcomingClassesCard (which only shows
 * *today's* classes and stays silent if there happen to be none today) -
 * this checks the student's *entire* published schedule so a student whose
 * class hasn't been set up at all sees a clear "not yet assigned" state
 * instead of an empty-looking "no classes today" card.
 *
 * Laid out as a 2x2 bento grid - one self-contained tile per fact (days/
 * time, subject, teacher, room) rather than a linear checklist, so the
 * "what's missing" gap reads at a glance instead of needing a full read
 * through a list.
 *
 * Regular schools only - same gating as "My Schedule"/UpcomingClassesCard.
 */
export default function EnrollmentStatusCard({ token }: { token: string }) {
  const navigation = useNavigation();
  const [rows, setRows] = useState<AcademicSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setIsLoading(true);
    fetchMySchedule(token)
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load your enrollment status.'))
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
            <Skeleton width={130} height={16} style={{ marginBottom: 6 }} />
            <Skeleton width={90} height={12} />
          </View>
        </View>
        <View style={styles.grid}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} width="48%" height={92} style={{ borderRadius: RADIUS.md }} />
          ))}
        </View>
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

  const items = computeStatus(rows);
  const allAssigned = items.every((i) => i.assigned);

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={goToSchedule}>
      <View style={styles.headerRow}>
        <View style={styles.iconBox}>
          <ClipboardIcon />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.title}>Enrollment Status</Text>
          <Text style={styles.subtitle}>{allAssigned ? 'Your class is fully set up' : 'Some details are still pending'}</Text>
        </View>
        <View style={[styles.statusPill, allAssigned ? styles.statusPillOk : styles.statusPillPending]}>
          <Text style={[styles.statusPillText, allAssigned ? styles.statusPillTextOk : styles.statusPillTextPending]}>
            {allAssigned ? 'Assigned' : 'Pending'}
          </Text>
        </View>
        <View style={styles.arrowCircle}>
          <ArrowRightIcon />
        </View>
      </View>

      <View style={styles.grid}>
        {items.map((item) => {
          const { Icon } = item;
          return (
            <View key={item.key} style={[styles.tile, item.assigned ? styles.tileOk : styles.tilePending]}>
              <View style={styles.tileTopRow}>
                <Icon color={item.assigned ? EMERALD : AMBER} size={22} />
                <View style={[styles.badge, item.assigned ? styles.badgeOk : styles.badgePending]}>
                  {item.assigned ? <CheckIcon /> : <ClockIcon />}
                </View>
              </View>
              <Text style={styles.tileLabel}>{item.label}</Text>
              <Text style={[styles.tileStatus, item.assigned ? styles.tileStatusOk : styles.tileStatusPending]}>
                {item.assigned ? 'Assigned' : 'Not yet'}
              </Text>
            </View>
          );
        })}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: SURFACE,
    borderRadius: RADIUS.lg,
    padding: SPACING.md + 2,
    marginBottom: SPACING.lg,
    ...SHADOW.level2,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.sm,
    backgroundColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 16, fontWeight: '700', color: INK },
  subtitle: { fontSize: 12, color: SUBTLE, marginTop: 2 },
  statusPill: { borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 5, marginRight: 8 },
  statusPillOk: { backgroundColor: EMERALD_SOFT },
  statusPillPending: { backgroundColor: AMBER_SOFT },
  statusPillText: { fontSize: 11, fontWeight: '700' },
  statusPillTextOk: { color: EMERALD },
  statusPillTextPending: { color: AMBER },
  arrowCircle: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.pill,
    backgroundColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // --- Bento grid: 4 self-contained tiles, 2 per row ---
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm - 2,
    marginTop: SPACING.md,
  },
  // No shadow/elevation here on purpose: Android renders `elevation`
  // combined with a translucent (rgba) backgroundColor as a visibly offset
  // ghost/duplicate box instead of a normal soft shadow - these tiles sit
  // inside an already-shadowed card (see `card` above), so they don't need
  // their own anyway.
  tile: {
    width: '48%',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
  },
  tileOk: { backgroundColor: EMERALD_SOFT, borderColor: 'rgba(31,174,100,0.18)' },
  tilePending: { backgroundColor: AMBER_SOFT, borderColor: 'rgba(180,83,9,0.16)' },
  tileTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeOk: { backgroundColor: EMERALD },
  badgePending: { backgroundColor: AMBER },
  tileLabel: { fontSize: 13.5, fontWeight: '700', color: INK, marginTop: 14 },
  tileStatus: { fontSize: 11.5, fontWeight: '600', marginTop: 2 },
  tileStatusOk: { color: EMERALD },
  tileStatusPending: { color: AMBER },

  errorText: { color: COLORS.danger, fontSize: 13, textAlign: 'center', marginBottom: 10 },
  retryBtn: { alignSelf: 'center', backgroundColor: EMERALD_SOFT, paddingVertical: 9, paddingHorizontal: 20, borderRadius: RADIUS.sm },
  retryBtnText: { color: EMERALD, fontWeight: '700', fontSize: 13 },
});
