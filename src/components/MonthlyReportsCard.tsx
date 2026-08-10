import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path, Circle } from 'react-native-svg';
import { fetchReportOverview, ReportOverview } from '../services/adminOrphanReportService';
import { Skeleton } from './Skeleton';

const EMERALD = '#2BCBB0';
const PALE_GREEN = '#7FD9A8';
const DANGER_SOFT = '#F4A7A7';
// Same faux-glass values used by StudentDashboard's Profile card and
// AdminDashboard's header - no blur lib, just translucent white + a
// light border on top of the dark hero. Kept identical here on purpose
// so every "glass on dark green" surface in the app reads as one family.
const GLASS_BG = 'rgba(255,255,255,0.07)';
const GLASS_BG_STRONG = 'rgba(255,255,255,0.1)';
const GLASS_BORDER = 'rgba(255,255,255,0.14)';

function ReportDocIcon({ color }: { color: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
      <Path d="M6 3h8l4 4v14H6z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M14 3v4h4M9 12h6M9 16h4" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function ArrowRight({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12h13M13 6l6 6-6 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function CheckCircleIcon({ color }: { color: string }) {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.8} />
      <Path d="M8 12.5l2.5 2.5L16 9.5" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function AlertCircleIcon({ color }: { color: string }) {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.8} />
      <Path d="M12 8v5" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Circle cx={12} cy={16} r={1} fill={color} />
    </Svg>
  );
}

/** Circular icon button that scales down slightly on press (200-250ms spring). */
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

function StatChip({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
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
 * The admin dashboard's Monthly Reports widget. Fetches this month's real
 * submitted/missing counts (POST /admin_orphan_report_overview) so the
 * numbers on the card are never placeholders - it shows a skeleton while
 * that loads and an inline retry if the request fails.
 *
 * Note: the backend's report status is binary today (submitted vs. not) -
 * there's no "pending review" / "approved" / "late" distinction stored
 * anywhere, so this only surfaces the two stats that actually exist
 * (Submitted, Missing) rather than showing invented numbers for statuses
 * the API can't back up.
 */
export default function MonthlyReportsCard({ token }: { token: string }) {
  const navigation = useNavigation();
  const [overview, setOverview] = useState<ReportOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fadeIn = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const load = () => {
    setError(null);
    setIsLoading(true);
    fetchReportOverview(token)
      .then((data) => setOverview(data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load report stats.'))
      .finally(() => setIsLoading(false));
  };

  useEffect(load, [token]);

  const submitted = overview?.submitted_count ?? 0;
  const total = overview?.total_count ?? 0;
  const missing = Math.max(total - submitted, 0);
  const pct = total > 0 ? Math.round((submitted / total) * 100) : 0;

  useEffect(() => {
    if (isLoading || error) return;
    fadeIn.setValue(0);
    progressAnim.setValue(0);
    Animated.timing(fadeIn, { toValue: 1, duration: 260, useNativeDriver: true }).start();
    Animated.timing(progressAnim, { toValue: pct, duration: 320, useNativeDriver: false }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, error, pct]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  const goToOverview = () => (navigation as any).navigate('AdminOrphanOverview');

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
      <TouchableOpacity style={styles.headerRow} activeOpacity={0.85} onPress={goToOverview}>
        <View style={styles.iconBox}>
          <ReportDocIcon color={PALE_GREEN} />
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={styles.label}>MONTHLY REPORTS</Text>
          <Text style={styles.title}>Monthly Orphan Reports</Text>
        </View>
        <PressScaleCircle onPress={goToOverview}>
          <ArrowRight color={PALE_GREEN} />
        </PressScaleCircle>
      </TouchableOpacity>

      <Text style={styles.subtitle}>
        Monitor submissions, review what's pending, or add a report on a guardian's behalf.
      </Text>

      {total > 0 ? (
        <>
          <View style={styles.statsRow}>
            <StatChip icon={<CheckCircleIcon color={PALE_GREEN} />} value={submitted} label="Submitted" />
            <StatChip icon={<AlertCircleIcon color={DANGER_SOFT} />} value={missing} label="Missing" />
          </View>

          <View style={styles.progressSection}>
            <View style={styles.progressLabelRow}>
              <Text style={styles.progressLabel}>Monthly completion</Text>
              <Text style={styles.progressPct}>{pct}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
            </View>
          </View>
        </>
      ) : (
        <Text style={styles.emptyText}>No children assigned yet - reports will show up here once they are.</Text>
      )}

      <Pressable
        onPress={goToOverview}
        android_ripple={{ color: 'rgba(255,255,255,0.12)' }}
        style={({ pressed }) => [styles.manageBtn, pressed && { opacity: 0.85 }]}
      >
        <Text style={styles.manageBtnText}>Manage Reports</Text>
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

  errorText: { color: DANGER_SOFT, fontSize: 13, textAlign: 'center', marginBottom: 12 },
  retryBtn: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 9,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  retryBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 13 },
});
