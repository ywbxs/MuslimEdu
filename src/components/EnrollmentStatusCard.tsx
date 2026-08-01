import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path, Circle } from 'react-native-svg';
import { fetchMySchedule, AcademicSchedule } from '../services/academicScheduleService';
import { Skeleton, SkeletonCircle } from './Skeleton';

const EMERALD = '#0F9D58';
const EMERALD_SOFT = '#E7F5EC';
const AMBER = '#B45309';
const AMBER_SOFT = '#FEF3C7';
const INK = '#1C1C1E';
const SUBTLE = '#8A9099';
const HAIRLINE = '#EDEEF0';

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
function CheckCircleIcon({ color = EMERALD, size = 18 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} />
      <Path d="M8 12.5l2.5 2.5L16 9.5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function PendingCircleIcon({ color = AMBER, size = 18 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} />
      <Path d="M12 8v4.5l3 2" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

interface StatusItem {
  key: string;
  label: string;
  assigned: boolean;
}

function computeStatus(rows: AcademicSchedule[]): StatusItem[] {
  return [
    { key: 'schedule', label: 'Class days & time', assigned: rows.length > 0 },
    { key: 'subject', label: 'Subject', assigned: rows.some((r) => !!r.subject_name) },
    { key: 'teacher', label: 'Teacher', assigned: rows.some((r) => !!r.teacher_name) },
    { key: 'room', label: 'Room', assigned: rows.some((r) => !!r.room_name) },
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
        <Skeleton width="100%" height={90} style={{ borderRadius: 14, marginTop: 14 }} />
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

      <View style={styles.itemsWrap}>
        {items.map((item) => (
          <View key={item.key} style={styles.itemRow}>
            {item.assigned ? <CheckCircleIcon /> : <PendingCircleIcon />}
            <Text style={styles.itemLabel}>{item.label}</Text>
            <Text style={[styles.itemStatus, item.assigned ? styles.itemStatusOk : styles.itemStatusPending]}>
              {item.assigned ? 'Assigned' : 'Not yet assigned'}
            </Text>
          </View>
        ))}
      </View>
    </TouchableOpacity>
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
  statusPill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, marginRight: 8 },
  statusPillOk: { backgroundColor: EMERALD_SOFT },
  statusPillPending: { backgroundColor: AMBER_SOFT },
  statusPillText: { fontSize: 11, fontWeight: '700' },
  statusPillTextOk: { color: EMERALD },
  statusPillTextPending: { color: AMBER },
  arrowCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  itemsWrap: { marginTop: 14 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
  },
  itemLabel: { flex: 1, fontSize: 13.5, color: INK, fontWeight: '600' },
  itemStatus: { fontSize: 12, fontWeight: '700' },
  itemStatusOk: { color: EMERALD },
  itemStatusPending: { color: AMBER },

  errorText: { color: '#E5484D', fontSize: 13, textAlign: 'center', marginBottom: 10 },
  retryBtn: { alignSelf: 'center', backgroundColor: EMERALD_SOFT, paddingVertical: 9, paddingHorizontal: 20, borderRadius: 10 },
  retryBtnText: { color: EMERALD, fontWeight: '700', fontSize: 13 },
});
