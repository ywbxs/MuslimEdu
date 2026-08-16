import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path, Rect, Line } from 'react-native-svg';
import { fetchStudentAttendance } from '../services/studentAcademicService';
import { Skeleton, SkeletonCircle } from './Skeleton';

const EMERALD = '#1FAE64';
const EMERALD_SOFT = '#E5F8F5';
const INK = '#1C1C1E';
const SUBTLE = '#8A9099';

type StatusKey = 'present' | 'late' | 'excused' | 'absent' | 'other';

const STATUS_ALIASES: Record<StatusKey, string[]> = {
  present: ['p', 'present', '1', 'in', 'presence'],
  late: ['l', 'late', 'tardy', '2'],
  excused: ['e', 'excused', 'leave', 'medical', 'medical leave', 'official', 'official activity', '3'],
  absent: ['a', 'absent', '0', 'abs'],
  other: [],
};

function bucketStatus(raw: unknown): StatusKey {
  const key = String(raw ?? '').trim().toLowerCase();
  const found = (Object.keys(STATUS_ALIASES) as StatusKey[]).find((bucket) => STATUS_ALIASES[bucket].includes(key));
  return found ?? 'other';
}

const STATUS_STYLE: Record<StatusKey, { color: string; soft: string; label: string }> = {
  present: { color: '#1FAE64', soft: '#E5F8F5', label: 'Present' },
  late: { color: '#B8860B', soft: '#FBF2DE', label: 'Late' },
  excused: { color: '#3B82F6', soft: '#EAF1FE', label: 'Excused' },
  absent: { color: '#E5484D', soft: '#FCEDED', label: 'Absent' },
  other: { color: SUBTLE, soft: '#F1F2F4', label: 'Recorded' },
};

function CalendarCheckIcon({ color = EMERALD, size = 22 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={5} width={16} height={16} rx={2} stroke={color} strokeWidth={2} />
      <Line x1={4} y1={9} x2={20} y2={9} stroke={color} strokeWidth={2} />
      <Line x1={8} y1={3} x2={8} y2={6} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={16} y1={3} x2={16} y2={6} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M8.5 13.5l2 2 4-4.5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
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

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Student home preview card: has today's attendance been marked yet, and
 * what was it? Same fetchStudentAttendance() (/attendance) the Attendance
 * tab on AcademicHub uses - pulls the current month and picks out today's
 * entry client-side, since there's no dedicated "just today" endpoint.
 * Regular schools only - same gating as UpcomingClassesCard, no
 * class/attendance concept on an orphan school.
 */
export default function TodayAttendanceCard({ token }: { token: string }) {
  const navigation = useNavigation();
  const [statusKey, setStatusKey] = useState<StatusKey | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setIsLoading(true);
    const now = new Date();
    fetchStudentAttendance(token, now.getMonth() + 1, now.getFullYear())
      .then((res) => {
        const today = res.attedances.find((d) => d.date.slice(0, 10) === todayISO());
        setStatusKey(today ? bucketStatus(today.status) : null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load your attendance.'))
      .finally(() => setIsLoading(false));
  }, [token]);

  useEffect(load, [load]);

  const goToAttendance = () => (navigation as any).navigate('AcademicHub', { initialTab: 'attendance' });

  if (isLoading) {
    return (
      <View style={styles.card}>
        <SkeletonCircle size={42} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Skeleton width={130} height={16} style={{ marginBottom: 6 }} />
          <Skeleton width={80} height={12} />
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

  const style = statusKey ? STATUS_STYLE[statusKey] : null;

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={goToAttendance}>
      <View style={[styles.iconBox, { backgroundColor: style?.soft ?? EMERALD_SOFT }]}>
        <CalendarCheckIcon color={style?.color ?? EMERALD} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.title}>Today's Attendance</Text>
        <Text style={styles.subtitle}>{style ? style.label : 'Not marked yet'}</Text>
      </View>
      {style ? (
        <View style={[styles.statusPill, { backgroundColor: style.soft }]}>
          <Text style={[styles.statusPillText, { color: style.color }]}>{style.label}</Text>
        </View>
      ) : (
        <View style={styles.arrowCircle}>
          <ArrowRightIcon />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 15, fontWeight: '700', color: INK },
  subtitle: { fontSize: 12, color: SUBTLE, marginTop: 2 },
  arrowCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  statusPillText: { fontSize: 12, fontWeight: '700' },

  errorText: { color: '#E5484D', fontSize: 13, textAlign: 'center', marginBottom: 10 },
  retryBtn: { alignSelf: 'center', backgroundColor: EMERALD_SOFT, paddingVertical: 9, paddingHorizontal: 20, borderRadius: 10 },
  retryBtnText: { color: EMERALD, fontWeight: '700', fontSize: 13 },
});
