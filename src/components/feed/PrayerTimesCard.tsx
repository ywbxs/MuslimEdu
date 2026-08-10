import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';
import { fetchMySchoolBranding } from '../../services/academicSetupService';
import {
  fetchPrayerTimes,
  computeNextPrayer,
  formatCountdown,
  PrayerTimesResult,
  NextPrayerInfo,
  PrayerLocation,
} from '../../services/prayerTimesService';
import { getCurrentCoordinates } from '../../utils/geolocation';
import { Skeleton, SkeletonCircle } from '../Skeleton';
import { useWidgetCardMetrics } from './widgetCarouselMetrics';

const GRADIENT_TOP = '#0F3D2E';
const GRADIENT_BOTTOM = '#062318';
const WHITE = '#FFFFFF';
const FAINT = 'rgba(255,255,255,0.65)';
const GLASS_FILL = 'rgba(255,255,255,0.14)';
const SKELETON_BASE = 'rgba(255,255,255,0.16)';

function MoonIcon({ color = WHITE, size = 20 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}
function ArrowRightIcon({ color = WHITE, size = 15 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={0} fill="none" />
      <Path d="M9 6l6 6-6 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/**
 * Compact "short" widget - the first card in the feed's WidgetCarousel.
 * Location prefers the device's own GPS (if the user grants permission -
 * see utils/geolocation.ts) for accuracy, falling back to the school's own
 * address (fetchMySchoolBranding, callable by every role) when permission
 * is denied or a fix can't be obtained. Tapping it pushes
 * PrayerTimesDetailScreen for the full "long" view, carrying along
 * whichever location already resolved so the detail screen doesn't need
 * to re-prompt for permission or wait on GPS again.
 */
export default function PrayerTimesCard({ token }: { token: string }) {
  const navigation = useNavigation();
  const { CARD_W } = useWidgetCardMetrics();
  const [result, setResult] = useState<PrayerTimesResult | null>(null);
  const [location, setLocation] = useState<PrayerLocation | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [next, setNext] = useState<NextPrayerInfo | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    (async () => {
      try {
        const coords = await getCurrentCoordinates();
        let resolvedLocation: PrayerLocation;
        if (coords) {
          resolvedLocation = { kind: 'coords', latitude: coords.latitude, longitude: coords.longitude };
        } else {
          const branding = await fetchMySchoolBranding(token);
          const addr = branding.address ?? branding.name ?? '';
          if (!addr) throw new Error('No location available - GPS denied and no school address on file');
          resolvedLocation = { kind: 'address', address: addr };
        }
        if (cancelled) return;
        setLocation(resolvedLocation);
        const res = await fetchPrayerTimes(token, resolvedLocation);
        if (!cancelled) setResult(res);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!result) return;
    const tick = () => setNext(computeNextPrayer(result.timings));
    tick();
    tickRef.current = setInterval(tick, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [result]);

  const openDetail = () => (navigation as any).navigate('PrayerTimesDetail', { location });

  if (loading) {
    return (
      <LinearGradient colors={[GRADIENT_TOP, GRADIENT_BOTTOM]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.card, { width: CARD_W }]}>
        <View style={styles.headerRow}>
          <SkeletonCircle size={38} baseColor={SKELETON_BASE} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Skeleton width={100} height={13} baseColor={SKELETON_BASE} style={{ marginBottom: 6 }} />
            <Skeleton width={70} height={11} baseColor={SKELETON_BASE} />
          </View>
        </View>
        <Skeleton width="100%" height={38} baseColor={SKELETON_BASE} style={{ borderRadius: 12, marginTop: 16 }} />
      </LinearGradient>
    );
  }

  // Silent minimal fallback, same convention as TodayAttendanceCard /
  // UpcomingClassesCard - a passive widget, not a user action, so no Alert.
  if (error || !result || !next) {
    return (
      <LinearGradient colors={[GRADIENT_TOP, GRADIENT_BOTTOM]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.card, { width: CARD_W }]}>
        <View style={styles.headerRow}>
          <View style={styles.iconBox}>
            <MoonIcon />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.title}>Prayer Times</Text>
            <Text style={styles.subtitle}>Unavailable right now</Text>
          </View>
        </View>
      </LinearGradient>
    );
  }

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={openDetail} style={{ width: CARD_W }}>
      <LinearGradient colors={[GRADIENT_TOP, GRADIENT_BOTTOM]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.iconBox}>
            <MoonIcon />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.title}>Currently {next.current.name}</Text>
            <Text style={styles.subtitle}>{result.gregorianLabel}</Text>
          </View>
          <View style={styles.arrowCircle}>
            <ArrowRightIcon />
          </View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Next Prayer</Text>
          <View style={styles.heroRow}>
            <Text style={styles.heroName}>{next.next.name}</Text>
            <Text style={styles.heroTime}>{next.next.timeLabel}</Text>
          </View>
          <Text style={styles.countdown}>{formatCountdown(next.msRemaining)}</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: GLASS_FILL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 14.5, fontWeight: '700', color: WHITE },
  subtitle: { fontSize: 11.5, color: FAINT, marginTop: 2 },
  arrowCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: GLASS_FILL,
    alignItems: 'center',
    justifyContent: 'center',
  },

  hero: { marginTop: 16, alignItems: 'center', paddingVertical: 10 },
  heroLabel: { fontSize: 11, color: FAINT, textTransform: 'uppercase', letterSpacing: 0.5 },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6 },
  heroName: { fontSize: 24, fontWeight: '800', color: WHITE },
  heroTime: { fontSize: 15, color: FAINT, fontWeight: '600' },
  countdown: { fontSize: 13, color: WHITE, fontWeight: '700', marginTop: 8, letterSpacing: 1 },
});
