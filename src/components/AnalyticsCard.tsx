import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChartNoAxesColumn, ArrowRight as ArrowRightGlyph, Users, CalendarCheck } from 'lucide-react-native';
import { fetchAcademicAnalytics, Analytics } from '../services/academicAnalyticsService';
import { Skeleton } from './Skeleton';

const EMERALD = '#1FAE64';
const PALE_GREEN = '#7FD9A8';
// Same faux-glass values MonthlyReportsCard uses - kept identical so every
// "glass on dark green" hero card in the app reads as one family.
const GLASS_BG = 'rgba(255,255,255,0.07)';
const GLASS_BG_STRONG = 'rgba(255,255,255,0.1)';
const GLASS_BORDER = 'rgba(255,255,255,0.14)';

function ChartIcon({ color }: { color: string }) {
  return <ChartNoAxesColumn color={color} size={26} strokeWidth={1.8} />;
}
function ArrowRight({ color, size = 18 }: { color: string; size?: number }) {
  return <ArrowRightGlyph color={color} size={size} strokeWidth={2} />;
}
function StudentsIcon({ color }: { color: string }) {
  return <Users color={color} size={15} strokeWidth={1.8} />;
}
function AttendanceIcon({ color }: { color: string }) {
  return <CalendarCheck color={color} size={15} strokeWidth={1.8} />;
}

/** Circular icon button that scales down slightly on press - identical to
 *  MonthlyReportsCard's own, duplicated rather than shared since it's a
 *  10-line presentational wrapper with no state of its own to diverge on. */
function PressScaleCircle({
  onPress,
  children,
  size = 44,
}: {
  onPress: () => void;
  children: React.ReactNode;
  size?: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const animateTo = (v: number) =>
    Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 6 }).start();

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => animateTo(0.9)}
      onPressOut={() => animateTo(1)}
      android_ripple={{ color: 'rgba(255,255,255,0.15)', radius: size / 2 }}
      hitSlop={8}
    >
      <Animated.View
        style={[
          styles.arrowCircle,
          { width: size, height: size, borderRadius: size / 2, transform: [{ scale }] },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

function StatChip({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <View style={styles.statChip}>
      <View style={styles.statChipIconWrap}>{icon}</View>
      <View>
        <Text style={styles.statChipValue}>{value}</Text>
        <Text style={styles.statChipLabel}>{label}</Text>
      </View>
    </View>
  );
}

/**
 * The admin dashboard's Academic Analytics widget - same dark-glass hero
 * treatment as MonthlyReportsCard (orphan schools' equivalent), fetching
 * real numbers via POST /admin_academic_analytics_dashboard so this never
 * shows placeholder stats. Shown for every non-orphan school (mahad,
 * madrasa, markaz, regular_school) since they all share the class-based
 * academic subsystem this reports on - the same boundary orphanSchool.ts
 * already draws for the rest of the academic tile set, not a narrower
 * regular_school-only cut.
 */
export default function AnalyticsCard({ token }: { token: string }) {
  const navigation = useNavigation();
  const [data, setData] = useState<Analytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fadeIn = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const load = () => {
    setError(null);
    setIsLoading(true);
    fetchAcademicAnalytics(token)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load analytics.'))
      .finally(() => setIsLoading(false));
  };

  useEffect(load, [token]);

  const students = data?.summary.students ?? 0;
  const attendanceRate = data?.summary.attendance_rate ?? null;
  const hasData = students > 0 || attendanceRate != null;

  useEffect(() => {
    if (isLoading || error) return;
    fadeIn.setValue(0);
    progressAnim.setValue(0);
    Animated.timing(fadeIn, { toValue: 1, duration: 260, useNativeDriver: true }).start();
    Animated.timing(progressAnim, { toValue: attendanceRate ?? 0, duration: 320, useNativeDriver: false }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, error, attendanceRate]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  const goToAnalytics = () => (navigation as any).navigate('AcademicAnalytics');

  if (isLoading) {
    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Skeleton width={56} height={56} style={{ borderRadius: 16 }} />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Skeleton width={110} height={11} style={{ marginBottom: 8, borderRadius: 4 }} />
            <Skeleton width="80%" height={16} style={{ borderRadius: 4 }} />
          </View>
          <Skeleton width={44} height={44} style={{ borderRadius: 22 }} />
        </View>
        <View style={[styles.statsRow, { marginTop: 18 }]}>
          <Skeleton width="48%" height={54} style={{ borderRadius: 14 }} />
          <Skeleton width="48%" height={54} style={{ borderRadius: 14 }} />
        </View>
        <Skeleton width="100%" height={40} style={{ borderRadius: 20, marginTop: 16 }} />
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

  return (
    <Animated.View style={[styles.card, { opacity: fadeIn }]}>
      <TouchableOpacity style={styles.headerRow} activeOpacity={0.85} onPress={goToAnalytics}>
        <View style={styles.iconBox}>
          <ChartIcon color={PALE_GREEN} />
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={styles.label}>SCHOOL ANALYTICS</Text>
          <Text style={styles.title}>Academic Analytics</Text>
        </View>
        <PressScaleCircle onPress={goToAnalytics}>
          <ArrowRight color={PALE_GREEN} />
        </PressScaleCircle>
      </TouchableOpacity>

      <Text style={styles.subtitle}>Students, attendance, and grades at a glance.</Text>

      {hasData ? (
        <>
          <View style={styles.statsRow}>
            <StatChip icon={<StudentsIcon color={PALE_GREEN} />} value={String(students)} label="Students" />
            <StatChip
              icon={<AttendanceIcon color={PALE_GREEN} />}
              value={attendanceRate == null ? '—' : `${attendanceRate}%`}
              label="Attendance"
            />
          </View>

          {attendanceRate != null ? (
            <View style={styles.progressSection}>
              <View style={styles.progressLabelRow}>
                <Text style={styles.progressLabel}>Attendance rate</Text>
                <Text style={styles.progressPct}>{attendanceRate}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
              </View>
            </View>
          ) : null}
        </>
      ) : (
        <Text style={styles.emptyText}>No academic activity yet - stats will show up here once there is.</Text>
      )}

      <Pressable
        onPress={goToAnalytics}
        android_ripple={{ color: 'rgba(255,255,255,0.12)' }}
        style={({ pressed }) => [styles.manageBtn, pressed && { opacity: 0.85 }]}
      >
        <Text style={styles.manageBtnText}>View Analytics</Text>
        <ArrowRight color={EMERALD} size={15} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 26,
    padding: 18,
    marginHorizontal: 20,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { color: PALE_GREEN, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 4 },
  title: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', lineHeight: 21 },
  arrowCircle: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: { color: 'rgba(255,255,255,0.62)', fontSize: 12.5, lineHeight: 18, marginTop: 12 },

  statsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  statChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GLASS_BG_STRONG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 9,
  },
  statChipIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statChipValue: { color: '#FFFFFF', fontSize: 17, fontWeight: '800', lineHeight: 20 },
  statChipLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600' },

  progressSection: { marginTop: 16 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' },
  progressPct: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' },
  progressTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: PALE_GREEN },

  emptyText: { color: 'rgba(255,255,255,0.55)', fontSize: 12.5, marginTop: 16, lineHeight: 18 },

  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingVertical: 12,
    marginTop: 18,
  },
  manageBtnText: { color: EMERALD, fontSize: 14, fontWeight: '700' },

  errorText: { color: '#F4A7A7', fontSize: 13, textAlign: 'center', marginBottom: 12 },
  retryBtn: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 9,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  retryBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 13 },
});
