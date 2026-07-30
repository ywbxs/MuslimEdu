import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Animated,
  TouchableOpacity,
  RefreshControl,
  Image,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Defs, LinearGradient, Stop, Rect, Circle, Polyline } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { fetchReportOverview, ReportOverview } from '../../services/adminOrphanReportService';
import { Skeleton } from '../../components/Skeleton';

const EMERALD = '#0F9D58';
const EMERALD_DEEP = '#0B7C46';
const EMERALD_SOFT = '#E7F5EC';
const INK = '#1C1C1E';
const SUBTLE = '#8A9099';
const HAIRLINE = '#EDEEF0';
const CANVAS = '#F6F7F9';
const DANGER = '#E5484D';
const DANGER_SOFT = '#FCEDED';

// Same dark hero palette as AdminDashboard, so navigating one level deeper
// into Monthly Reports feels like a continuation of the same screen rather
// than a different app.
const HERO_TOP = '#124E38';
const HERO_BOTTOM = '#0A3325';
const PALE_GREEN = '#7FD9A8';

// --- Depth layer sizing (mirrors AdminDashboard / StudentDashboard) ---------
// The gradient hero is a separate Animated layer BEHIND the list. It travels
// at half speed (parallax) and fades to nothing as you scroll, so the white
// body + cards visibly slide up and over it - the Apple-style depth effect.
const HERO_HEIGHT = 260;
const PARALLAX_FACTOR = 0.5;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function ChevronLeftIcon({ color = EMERALD }: { color?: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Polyline points="15 5 8 12 15 19" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const AnimatedFlatList = Animated.FlatList as unknown as typeof FlatList;

function Avatar({ name, photo, submitted }: { name: string; photo: string | null; submitted: boolean }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const initial = name?.trim()?.[0]?.toUpperCase() ?? '?';

  if (photo && !photoFailed) {
    return (
      <Image
        source={{ uri: photo }}
        style={styles.avatarPhoto}
        onError={() => setPhotoFailed(true)}
      />
    );
  }

  return (
    <View style={[styles.avatar, { backgroundColor: submitted ? EMERALD_SOFT : DANGER_SOFT }]}>
      <Text style={[styles.avatarText, { color: submitted ? EMERALD : DANGER }]}>{initial}</Text>
    </View>
  );
}

export default function AdminOrphanOverviewScreen() {
  const navigation = useNavigation();
  const { token, user } = useAuth();
  const scrollY = useRef(new Animated.Value(0)).current;

  const [overview, setOverview] = useState<ReportOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Admin's own profile photo in the hero. user.photo already comes back
  // absolutized from authService's normalizeUser(), same source AdminDashboard
  // uses, so this stays in sync with whatever photo the backend has on file -
  // if the admin updates their photo elsewhere, it shows here too on next load.
  const [heroPhotoFailed, setHeroPhotoFailed] = useState(false);
  const heroInitial = user?.name?.trim()?.[0]?.toUpperCase() ?? '?';
  const showHeroPhoto = !!user?.photo && !heroPhotoFailed;

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const data = await fetchReportOverview(token);
      setOverview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report overview.');
    }
  }, [token]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  };

  const now = new Date();
  const monthLabel = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;
  const submitted = overview?.submitted_count ?? 0;
  const total = overview?.total_count ?? 0;
  const missing = Math.max(total - submitted, 0);
  const progress = total > 0 ? submitted / total : 0;
  const pct = Math.round(progress * 100);

  // --- Parallax + fade for the background layer only. The list content
  // (greeting, progress card, children) scrolls at normal speed on top, so it
  // "moves over" this slower, fading dark layer - the gap between the two
  // speeds is what reads as depth.
  const bgTranslateY = scrollY.interpolate({
    inputRange: [0, HERO_HEIGHT],
    outputRange: [0, -HERO_HEIGHT * PARALLAX_FACTOR],
    extrapolate: 'clamp',
  });
  const bgOpacity = scrollY.interpolate({
    inputRange: [0, HERO_HEIGHT * 0.6, HERO_HEIGHT],
    outputRange: [1, 1, 0],
    extrapolate: 'clamp',
  });

  const listHeader = (
    <View>
      {/* Spacer - the actual hero is the animated bgLayer sitting behind the
          list; this just reserves the scroll-space it occupies so the
          greeting/avatar/back button land in the right spot. */}
      <View style={styles.heroSpacer}>
        <View style={styles.heroHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greetingSmall}>Assalamu Alaykum,</Text>
            <Text style={styles.greetingName}>{user?.name ?? ''}</Text>
          </View>
          <View style={styles.avatarRing}>
            {showHeroPhoto ? (
              <Image
                source={{ uri: user!.photo as string }}
                style={styles.avatarImg}
                onError={() => setHeroPhotoFailed(true)}
              />
            ) : (
              <View style={styles.avatarInner}>
                <Text style={styles.avatarInitial}>{heroInitial}</Text>
              </View>
            )}
            <View style={styles.avatarDot} />
          </View>
        </View>
      </View>

      {/* Progress card floats half on the hero, half on the white body below -
          same overlapping-card language as the reports teaser on AdminDashboard. */}
      <View style={styles.progressCard}>
        <Text style={styles.progressMonth}>{monthLabel}</Text>
        <View style={styles.progressRow}>
          <Text style={styles.progressCount}>{submitted}</Text>
          <Text style={styles.progressTotal}> / {total} submitted</Text>
          <View style={styles.flex1} />
          <Text style={styles.progressPct}>{pct}%</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct}%` }]} />
        </View>
        <View style={styles.progressMetaRow}>
          <View style={styles.progressMeta}>
            <View style={[styles.metaDot, { backgroundColor: '#FFFFFF' }]} />
            <Text style={styles.progressMetaText}>{submitted} submitted</Text>
          </View>
          <View style={styles.progressMeta}>
            <View style={[styles.metaDot, { backgroundColor: 'rgba(255,255,255,0.5)' }]} />
            <Text style={styles.progressMetaText}>{missing} missing</Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionLabel}>Children</Text>
    </View>
  );

  return (
    <View style={styles.flex}>
      {/* Background depth layer - slower + fading, sits BEHIND the list */}
      <Animated.View
        style={[
          styles.bgLayer,
          { height: HERO_HEIGHT, opacity: bgOpacity, transform: [{ translateY: bgTranslateY }] },
        ]}
        pointerEvents="none"
        renderToHardwareTextureAndroid
      >
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <LinearGradient id="orphanHeroGrad" x1="0" y1="0" x2="0.4" y2="1">
              <Stop offset="0" stopColor={HERO_TOP} />
              <Stop offset="1" stopColor={HERO_BOTTOM} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#orphanHeroGrad)" />
          <Circle cx="88%" cy="10%" r="80" fill="rgba(255,255,255,0.05)" />
          <Circle cx="70%" cy="-4%" r="46" fill="rgba(255,255,255,0.04)" />
        </Svg>
      </Animated.View>

      {/* Fixed back button - stays put regardless of scroll, opaque so it
          reads clearly whether it's sitting over the dark hero or, once
          scrolled, over the white body. */}
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={12} activeOpacity={0.8}>
        <ChevronLeftIcon color={EMERALD} />
      </TouchableOpacity>

      {isLoading ? (
        <View style={styles.listContent}>
          <View style={{ height: HERO_HEIGHT - 90 }} />
          <Skeleton width={'100%'} height={132} style={{ borderRadius: 22, marginBottom: 20 }} />
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} width={'100%'} height={72} style={{ borderRadius: 16, marginBottom: 10 }} />
          ))}
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={load}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <AnimatedFlatList
          data={overview?.children ?? []}
          keyExtractor={(item: any) => String(item.student_id)}
          contentContainerStyle={styles.listContentNoTopPad}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
            useNativeDriver: true,
          })}
          scrollEventThrottle={16}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={EMERALD} />}
          ListHeaderComponent={listHeader}
          renderItem={({ item }: { item: any }) => (
            <TouchableOpacity
              style={styles.childRow}
              activeOpacity={0.85}
              onPress={() =>
                (navigation as any).navigate('AdminChildReportDetail', {
                  studentId: item.student_id,
                  studentName: item.name,
                })
              }
            >
              <View style={[styles.statusDot, { backgroundColor: item.submitted ? EMERALD : DANGER }]} />
              <Avatar name={item.name} photo={item.photo} submitted={item.submitted} />
              <View style={styles.flex1}>
                <Text style={styles.childName}>{item.name}</Text>
                {item.submitted ? (
                  <Text style={styles.childSubmitted}>
                    Submitted{item.submitted_by ? ` by ${item.submitted_by}` : ''}
                  </Text>
                ) : (
                  <Text style={styles.childMissing}>Not submitted yet</Text>
                )}
              </View>
              {item.submitted ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>Submitted</Text>
                </View>
              ) : (
                <View style={[styles.badge, styles.badgeMissing]}>
                  <Text style={[styles.badgeText, styles.badgeTextMissing]}>Missing</Text>
                </View>
              )}
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No children assigned yet.</Text>}
          ListFooterComponent={<View style={{ height: 24 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: CANVAS, overflow: 'hidden' },
  flex1: { flex: 1 },

  bgLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
    backgroundColor: HERO_BOTTOM,
    // Animated transforms on Android can promote a view to its own layer and
    // paint above later siblings; explicit zIndex keeps this behind content.
    zIndex: 0,
    elevation: 0,
  },

  backButton: {
    position: 'absolute',
    top: 56,
    left: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },

  heroSpacer: {
    paddingTop: 104,
    paddingBottom: 44,
  },
  heroHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  greetingSmall: { fontSize: 14, color: PALE_GREEN },
  greetingName: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', marginTop: 3 },

  avatarRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: { width: 50, height: 50, borderRadius: 25 },
  avatarInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: EMERALD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: '#FFFFFF', fontSize: 19, fontWeight: '700' },
  avatarDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#5FE38A',
    borderWidth: 2,
    borderColor: HERO_TOP,
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  errorText: { color: DANGER, textAlign: 'center', marginBottom: 12 },
  retryButton: { backgroundColor: '#EEF0F2', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  retryText: { color: INK, fontWeight: '600' },
  listContent: { padding: 20, paddingBottom: 40 },
  listContentNoTopPad: { paddingHorizontal: 20, paddingBottom: 40, zIndex: 1 },

  progressCard: {
    backgroundColor: EMERALD,
    borderRadius: 22,
    padding: 22,
    marginTop: -32,
    marginBottom: 22,
    shadowColor: EMERALD_DEEP,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  progressMonth: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600', marginBottom: 10 },
  progressRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 14 },
  progressCount: { color: '#FFFFFF', fontSize: 34, fontWeight: '800', lineHeight: 36 },
  progressTotal: { color: 'rgba(255,255,255,0.85)', fontSize: 15, marginBottom: 4, marginLeft: 2 },
  progressPct: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  progressTrack: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#FFFFFF', borderRadius: 4 },
  progressMetaRow: { flexDirection: 'row', marginTop: 14, gap: 20 },
  progressMeta: { flexDirection: 'row', alignItems: 'center' },
  metaDot: { width: 8, height: 8, borderRadius: 4, marginRight: 7 },
  progressMetaText: { color: 'rgba(255,255,255,0.9)', fontSize: 12.5, fontWeight: '600' },

  sectionLabel: {
    fontSize: 13,
    color: SUBTLE,
    marginBottom: 12,
    marginHorizontal: 0,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
  },

  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: HAIRLINE,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 16, fontWeight: '700' },
  avatarPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: '#F0F0F0',
  },
  childName: { fontSize: 15, fontWeight: '700', color: INK },
  childSubmitted: { fontSize: 12.5, color: EMERALD, marginTop: 2, fontWeight: '600' },
  childMissing: { fontSize: 12.5, color: DANGER, marginTop: 2, fontWeight: '600' },
  badge: {
    backgroundColor: EMERALD_SOFT,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginRight: 4,
  },
  badgeMissing: { backgroundColor: DANGER_SOFT },
  badgeText: { color: EMERALD, fontSize: 11.5, fontWeight: '700' },
  badgeTextMissing: { color: DANGER },
  chevron: { fontSize: 22, color: '#C4C9CF', fontWeight: '400', marginLeft: 2 },
  empty: { textAlign: 'center', color: SUBTLE, fontSize: 14, marginTop: 40 },
});
