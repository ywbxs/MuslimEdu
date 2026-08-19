import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { BookOpen, Calendar, Check, ChevronLeft, ChevronRight, CircleDollarSign, GraduationCap, Heart, Users } from 'lucide-react-native';
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
import { COLORS, RADIUS, SHADOW, BRAND } from '../../theme/glass';
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
  return <ChevronLeft size={22} color={INK} strokeWidth={2.1} />;
}
function CalendarIcon({ color = EMERALD, size = 22 }: { color?: string; size?: number }) {
  return <Calendar size={size} color={color} strokeWidth={2} />;
}
function CheckIcon({ color = EMERALD, size = 16 }: { color?: string; size?: number }) {
  return <Check size={size} color={color} strokeWidth={2.6} />;
}
function ChevronLeftIcon({ color = INK, size = 18 }: { color?: string; size?: number }) {
  return <ChevronLeft size={size} color={color} strokeWidth={2.2} />;
}
function ChevronRightIcon({ color = INK, size = 18 }: { color?: string; size?: number }) {
  return <ChevronRight size={size} color={color} strokeWidth={2.2} />;
}

const SERVICES: Array<{ key: string; label: string; icon: (color: string) => React.ReactElement }> = [
  { key: 'quran', label: 'Quran', icon: (c) => <BookOpen size={22} color={c} strokeWidth={1.8} /> },
  { key: 'dua', label: 'Dua', icon: (c) => <Heart size={22} color={c} strokeWidth={1.8} /> },
  { key: 'zakat', label: 'Zakat', icon: (c) => <CircleDollarSign size={22} color={c} strokeWidth={1.8} /> },
  { key: 'volunteer', label: 'Volunteer', icon: (c) => <Users size={22} color={c} strokeWidth={1.8} /> },
  { key: 'courses', label: 'Courses', icon: (c) => <GraduationCap size={22} color={c} strokeWidth={1.8} /> },
];

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
      <View style={[styles.header, { paddingTop: insets.top }]}>
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

            <View style={styles.listCard}>
              {result.timings.map((t, i) => {
                const passed = isToday && timingMinutes(t) <= nowMinutes;
                const isCurrent = isToday && next?.current.name === t.name;
                return (
                  <React.Fragment key={t.name}>
                    <View style={[styles.row, isCurrent && styles.rowCurrent]}>
                      <View style={[styles.rowCheck, passed && styles.rowCheckDone]}>
                        {passed ? <CheckIcon color={WHITE} size={14} /> : null}
                      </View>
                      <Text style={[styles.rowName, passed && styles.rowNamePassed]}>{t.name}</Text>
                      {isCurrent ? (
                        <View style={styles.nowTag}>
                          <Text style={styles.nowTagText}>NOW</Text>
                        </View>
                      ) : null}
                      <Text style={[styles.rowTime, passed && styles.rowTimePassed]}>{t.timeLabel}</Text>
                    </View>
                    {i < result.timings.length - 1 ? <View style={styles.rowDivider} /> : null}
                  </React.Fragment>
                );
              })}
            </View>

            <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Services</Text>
            <View style={styles.servicesGrid}>
              {SERVICES.map((s) => (
                <TouchableOpacity
                  key={s.key}
                  style={styles.serviceTile}
                  activeOpacity={0.8}
                  onPress={() => Alert.alert(s.label, "We're still building this - check back soon.")}
                >
                  <View style={styles.serviceIconWrap}>{s.icon(EMERALD)}</View>
                  <Text style={styles.serviceLabel} numberOfLines={1}>{s.label}</Text>
                  <View style={styles.soonPill}>
                    <Text style={styles.soonPillText}>Soon</Text>
                  </View>
                </TouchableOpacity>
              ))}
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

  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: SUBTLE,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  // Lighter than the old solid-dark-green bar - the hero card right above
  // already carries that weight; repeating it here read as two stacked
  // slabs of the same heavy material back to back.
  daySwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginBottom: 14,
    ...SHADOW.level1,
  },
  dayArrow: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.canvas },
  dayPill: { flex: 1, alignItems: 'center' },
  dayPillText: { color: INK, fontSize: 13.5, fontWeight: '700' },

  // One grouped card with hairline dividers instead of a separately
  // shadowed card per row - six stacked shadows read as visual noise for
  // a list this uniform; elevation belongs to the card as a whole.
  listCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    ...SHADOW.level1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowCurrent: { backgroundColor: COLORS.emeraldSoft },
  rowDivider: { height: 1, backgroundColor: COLORS.border, marginLeft: 52 },
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
  // Solid filled circle rather than an outline + green check - reads as a
  // completed state at a glance and keeps the check icon's white-on-fill
  // contrast well above the 3:1 UI-graphics minimum (outline + green-on-
  // white check previously measured 2.88:1).
  rowCheckDone: { backgroundColor: BRAND.emeraldDeep, borderColor: BRAND.emeraldDeep },
  rowName: { flex: 1, fontSize: 15, fontWeight: '600', color: INK },
  // BRAND.emeraldDeep, not COLORS.emerald - the lighter emerald measured
  // 2.44:1 against the emeraldSoft tint (fails WCAG AA's 4.5:1); deep
  // emerald measures 5.42:1 against white/near-white.
  rowNamePassed: { color: BRAND.emeraldDeep, fontWeight: '700' },
  nowTag: { backgroundColor: BRAND.emeraldDeep, borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 3, marginRight: 10 },
  nowTagText: { color: WHITE, fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  rowTime: { fontSize: 14, fontWeight: '700', color: SUBTLE },
  rowTimePassed: { color: BRAND.emeraldDeep },

  // Not-yet-built features get their own honest "Soon" pill rather than
  // being left off the page or pretending to work - same light-card
  // language as the rest of the screen (no separate dark section).
  servicesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  serviceTile: {
    width: '31%',
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    ...SHADOW.level1,
  },
  serviceIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.emeraldSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  serviceLabel: { fontSize: 12.5, fontWeight: '700', color: INK },
  soonPill: {
    marginTop: 6,
    backgroundColor: '#EEF0F2',
    borderRadius: RADIUS.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  soonPillText: { fontSize: 9.5, fontWeight: '700', color: SUBTLE, textTransform: 'uppercase', letterSpacing: 0.4 },
});
