import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';
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
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M7 6h10a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M9 12h6M9 16h6" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function ArrowRightIcon({ color = EMERALD, size = 16 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 12h16M14 6l6 6-6 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function CheckIcon({ color = '#FFFFFF', size = 10 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 12.5l5 5L20 6" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function ClockIcon({ color = '#FFFFFF', size = 10 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={3} />
      <Path d="M12 8v5l3 2" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function CalendarIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={5} width={16} height={16} rx={2} stroke={color} strokeWidth={2} />
      <Line x1={4} y1={9} x2={20} y2={9} stroke={color} strokeWidth={2} />
      <Line x1={8} y1={3} x2={8} y2={6} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={16} y1={3} x2={16} y2={6} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function BookIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v18H6.5A2.5 2.5 0 0 0 4 23.5v-18z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v18h5.5a2.5 2.5 0 0 1 2.5 2.5v-18z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  );
}
function PersonIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={4} stroke={color} strokeWidth={2} />
      <Path d="M4 20c0-3.3 3.6-5 8-5s8 1.7 8 5" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function DoorIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 21V4a1 1 0 0 1 1-1h8l3 3v15" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1={6} y1={21} x2={20} y2={21} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Circle cx={13} cy={13} r={0.8} stroke={color} strokeWidth={2} />
    </Svg>
  );
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
  tile: {
    width: '48%',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    ...SHADOW.level1,
  },
  tileOk: { backgroundColor: EMERALD_SOFT, borderColor: 'rgba(34,197,94,0.18)' },
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
