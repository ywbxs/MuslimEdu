import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path, Rect, Line } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { fetchMySchoolBranding } from '../../services/academicSetupService';
import {
  fetchPrayerTimes,
  computeNextPrayer,
  formatCountdown,
  PrayerTimesResult,
  NextPrayerInfo,
  PrayerTiming,
  PrayerLocation,
} from '../../services/prayerTimesService';
import { getCurrentCoordinates } from '../../utils/geolocation';
import { COLORS, RADIUS, SHADOW } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';

const EMERALD = COLORS.emerald;
const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const GRADIENT_TOP = '#0F3D2E';
const GRADIENT_BOTTOM = '#062318';
const WHITE = '#FFFFFF';
const FAINT = 'rgba(255,255,255,0.65)';
const GLASS_FILL = 'rgba(255,255,255,0.14)';

function BackIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M15 5 8 12l7 7" stroke={INK} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
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
function CheckIcon({ color = EMERALD, size = 16 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 12.5l5 5L20 6.5" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function ChevronLeftIcon({ color = INK, size = 18 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M15 5 8 12l7 7" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function ChevronRightIcon({ color = INK, size = 18 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 5l7 7-7 7" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}
function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}
function timingMinutes(t: PrayerTiming): number {
  const [h, m] = t.time24.split(':').map((n) => parseInt(n, 10));
  return h * 60 + m;
}

/**
 * The "long" prayer-times widget - a pushed screen (this codebase's Modal
 * usage is reserved for small transient confirmations, not full detail
 * views; a tap-to-see-more from the feed always pushes, e.g.
 * PostComments/ImageViewer). Mirrors the reference screenshot: date card,
 * big "Currently {prayer}" countdown hero, full prayer list with
 * checkmarks for passed prayers, and a prev/today/next day switcher.
 */
export default function PrayerTimesDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const { token } = useAuth();
  const routeLocation = (route.params as any)?.location as PrayerLocation | undefined;

  const [location, setLocation] = useState<PrayerLocation | null>(routeLocation ?? null);
  const [schoolName, setSchoolName] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [result, setResult] = useState<PrayerTimesResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [next, setNext] = useState<NextPrayerInfo | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isToday = startOfDay(selectedDate).getTime() === startOfDay(new Date()).getTime();

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        let loc = location;
        if (!loc) {
          const coords = await getCurrentCoordinates();
          if (cancelled) return;
          if (coords) {
            loc = { kind: 'coords', latitude: coords.latitude, longitude: coords.longitude };
          } else {
            const branding = await fetchMySchoolBranding(token);
            if (cancelled) return;
            const addr = branding.address ?? branding.name ?? '';
            if (!addr) throw new Error('No location available - GPS denied and no school address on file.');
            loc = { kind: 'address', address: addr };
            setSchoolName(branding.name ?? null);
          }
          setLocation(loc);
        }
        const res = await fetchPrayerTimes(token, loc, selectedDate);
        if (!cancelled) setResult(res);
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? 'Could not load prayer times.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, selectedDate]);

  useEffect(() => {
    if (!result || !isToday) {
      setNext(null);
      return;
    }
    const tick = () => setNext(computeNextPrayer(result.timings));
    tick();
    tickRef.current = setInterval(tick, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [result, isToday]);

  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const locationLabel = location?.kind === 'coords' ? 'Current Location' : schoolName ?? location?.address ?? null;

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <BackIcon />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Prayer Times</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {loading && !result ? (
          <View style={styles.centerFill}>
            <ActivityIndicator color={EMERALD} />
          </View>
        ) : error && !result ? (
          <View style={styles.centerFill}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : result ? (
          <>
            <View style={styles.dateCard}>
              <View style={styles.dateIconBox}>
                <CalendarIcon />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.dateGregorian}>{result.gregorianLabel}</Text>
                {!!result.hijriLabel && <Text style={styles.dateHijri}>{result.hijriLabel}</Text>}
                {!!locationLabel && <Text style={styles.dateAddress}>{locationLabel}</Text>}
              </View>
            </View>

            {isToday && next ? (
              <LinearGradient colors={[GRADIENT_TOP, GRADIENT_BOTTOM]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
                <View style={styles.heroTopRow}>
                  <View style={styles.heroBadge}>
                    <Text style={styles.heroBadgeText}>Currently {next.current.name}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.heroCountdownLabel}>Next Prayer In</Text>
                    <Text style={styles.heroCountdown}>{formatCountdown(next.msRemaining)}</Text>
                  </View>
                </View>
                <View style={styles.heroCenter}>
                  <Text style={styles.heroNextLabel}>Next Prayer</Text>
                  <Text style={styles.heroNextName}>{next.next.name}</Text>
                  <Text style={styles.heroNextTime}>{next.next.timeLabel}</Text>
                </View>
              </LinearGradient>
            ) : null}

            <Text style={styles.sectionLabel}>Prayer Times</Text>
            <View style={styles.daySwitcher}>
              <TouchableOpacity style={styles.dayArrow} hitSlop={10} onPress={() => setSelectedDate((d) => addDays(d, -1))}>
                <ChevronLeftIcon />
              </TouchableOpacity>
              <View style={styles.dayPill}>
                <Text style={styles.dayPillText}>{isToday ? `Today, ${result.gregorianLabel.split(', ')[1] ?? result.gregorianLabel}` : result.gregorianLabel}</Text>
              </View>
              <TouchableOpacity style={styles.dayArrow} hitSlop={10} onPress={() => setSelectedDate((d) => addDays(d, 1))}>
                <ChevronRightIcon />
              </TouchableOpacity>
            </View>

            <View style={styles.list}>
              {result.timings.map((t) => {
                const passed = isToday && timingMinutes(t) <= nowMinutes;
                return (
                  <View key={t.name} style={[styles.row, passed && styles.rowPassed]}>
                    <View style={[styles.rowCheck, passed && styles.rowCheckDone]}>{passed && <CheckIcon />}</View>
                    <Text style={[styles.rowName, passed && styles.rowNamePassed]}>{t.name}</Text>
                    <Text style={styles.rowTime}>{t.timeLabel}</Text>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.canvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: INK },
  body: { padding: 16, paddingBottom: 40 },
  centerFill: { paddingVertical: 80, alignItems: 'center' },
  errorText: { color: COLORS.danger, fontSize: 14, textAlign: 'center' },

  dateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.md,
    padding: 16,
    marginBottom: 14,
    ...SHADOW.level1,
  },
  dateIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.emeraldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateGregorian: { fontSize: 15.5, fontWeight: '700', color: INK },
  dateHijri: { fontSize: 12.5, color: EMERALD, fontWeight: '600', marginTop: 2 },
  dateAddress: { fontSize: 11.5, color: SUBTLE, marginTop: 2 },

  heroCard: {
    borderRadius: RADIUS.lg,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 7,
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: GLASS_FILL, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  heroBadgeText: { color: WHITE, fontSize: 13, fontWeight: '700' },
  heroCountdownLabel: { color: FAINT, fontSize: 10.5 },
  heroCountdown: { color: WHITE, fontSize: 20, fontWeight: '800', letterSpacing: 1, marginTop: 2 },
  heroCenter: { alignItems: 'center', marginTop: 22, paddingBottom: 4 },
  heroNextLabel: { color: FAINT, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  heroNextName: { color: WHITE, fontSize: 32, fontWeight: '800', marginTop: 6 },
  heroNextTime: { color: FAINT, fontSize: 16, fontWeight: '600', marginTop: 2 },

  sectionLabel: { fontSize: 15, fontWeight: '700', color: INK, marginBottom: 10 },
  daySwitcher: { flexDirection: 'row', alignItems: 'center', backgroundColor: GRADIENT_TOP, borderRadius: RADIUS.pill, paddingVertical: 10, paddingHorizontal: 10, marginBottom: 14 },
  dayArrow: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: GLASS_FILL },
  dayPill: { flex: 1, alignItems: 'center' },
  dayPillText: { color: WHITE, fontSize: 13.5, fontWeight: '700' },

  list: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
    ...SHADOW.level1,
  },
  rowPassed: { backgroundColor: COLORS.emeraldSoft },
  rowCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowCheckDone: { backgroundColor: '#FFFFFF', borderColor: EMERALD },
  rowName: { flex: 1, fontSize: 15, fontWeight: '600', color: INK },
  rowNamePassed: { color: EMERALD, fontWeight: '700' },
  rowTime: { fontSize: 14, fontWeight: '700', color: SUBTLE },
});
