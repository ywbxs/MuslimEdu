import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Defs, LinearGradient, Stop, Rect, Circle, Path } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { EMERALD, EMERALD_SOFT, INK, SUBTLE } from './DashboardShell';

// Dark hero palette (kept local so it doesn't leak into other screens).
const HERO_TOP = '#124E38';
const HERO_BOTTOM = '#0A3325';
const REPORTS_BG = '#0B2E22';
const PALE_GREEN = '#7FD9A8';

// --- Depth layer sizing (mirrors StudentDashboard) --------------------
// The gradient hero is a separate Animated layer BEHIND the scroll content.
// It travels at half speed (parallax) and fades to nothing as you scroll,
// so the white body + cards visibly slide up and over it. Apple-style depth.
const HERO_HEIGHT = 300;
const PARALLAX_FACTOR = 0.5; // background moves at half the content's scroll speed

// --- Inline icons (react-native-svg, matches the app's existing approach) ---
function PeopleIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle cx="9" cy="8" r="3.2" stroke={color} strokeWidth={1.8} />
      <Path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M16 6.2a3 3 0 0 1 0 5.6M18 19c0-2.2-1-4-2.6-4.6" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function PresentationIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="4" width="18" height="12" rx="2" stroke={color} strokeWidth={1.8} />
      <Path d="M8 20l4-4 4 4" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="12" cy="10" r="2" stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}
function BookIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5A1.5 1.5 0 0 1 20 20.5z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}
function DocumentIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M6 3h8l4 4v14H6z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M14 3v4h4M9 12h6M9 16h6" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function CalendarIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Rect x="3.5" y="5" width="17" height="16" rx="2" stroke={color} strokeWidth={1.8} />
      <Path d="M3.5 9.5h17M8 3.5v3M16 3.5v3M8.5 14l2 2 4-4" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
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

type Variant = 'solid' | 'soft';
interface ManageItem {
  key: string;
  title: string;
  desc: string;
  variant: Variant;
  route: string | null;
  icon: (color: string) => React.ReactElement;
}

export default function AdminDashboard() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const scrollY = useRef(new Animated.Value(0)).current;

  const [photoFailed, setPhotoFailed] = useState(false);
  const initial = user?.name?.trim()?.[0]?.toUpperCase() ?? '?';
  // Profile photo comes back already-absolute (authService runs it through
  // absoluteUrl). Show it when present, fall back to the initial otherwise.
  const showPhoto = !!user?.photo && !photoFailed;

  const childLabel = user?.is_orphan ? 'children' : 'students';
  const childTitle = user?.is_orphan ? 'Children' : 'Students';

  const items: ManageItem[] = [
    {
      key: 'students',
      title: childTitle,
      desc: `View and manage all ${childLabel}`,
      variant: 'solid',
      route: 'StudentsList',
      icon: (c) => <PeopleIcon color={c} />,
    },
    {
      key: 'teachers',
      title: 'Teachers',
      desc: 'Manage teachers and permissions',
      variant: 'soft',
      route: null,
      icon: (c) => <PresentationIcon color={c} />,
    },
    {
      key: 'classes',
      title: 'Classes',
      desc: 'Manage classes and sections',
      variant: 'soft',
      route: null,
      icon: (c) => <BookIcon color={c} />,
    },
    {
      key: 'fees',
      title: 'Fee Reports',
      desc: 'View and manage fee collections',
      variant: 'solid',
      route: null,
      icon: (c) => <DocumentIcon color={c} />,
    },
    {
      key: 'attendance',
      title: 'Attendance',
      desc: 'Track daily attendance',
      variant: 'soft',
      route: null,
      icon: (c) => <CalendarIcon color={c} />,
    },
  ];

  // --- Parallax + fade for the background layer only. The ScrollView content
  // (greeting, reports card, grid) scrolls at normal speed on top, so it
  // "moves over" this slower, fading dark layer. That gap is the depth.
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

  return (
    <View style={styles.flex}>
      {/* Background depth layer - slower + fading, sits BEHIND the scroll view */}
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
            <LinearGradient id="heroGrad" x1="0" y1="0" x2="0.4" y2="1">
              <Stop offset="0" stopColor={HERO_TOP} />
              <Stop offset="1" stopColor={HERO_BOTTOM} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#heroGrad)" />
          <Circle cx="88%" cy="14%" r="80" fill="rgba(255,255,255,0.05)" />
          <Circle cx="70%" cy="-2%" r="46" fill="rgba(255,255,255,0.04)" />
        </Svg>
      </Animated.View>

      <Animated.ScrollView
        style={styles.scrollFlex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
        scrollEventThrottle={16}
      >
        {/* Greeting + avatar (foreground, scrolls at normal speed over the bg) */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greetingSmall}>Assalamu Alaykum,</Text>
            <Text style={styles.greetingName}>{user?.name ?? ''}</Text>
          </View>
          <TouchableOpacity onPress={() => (navigation as any).navigate('Menu')} hitSlop={10}>
            <View style={styles.avatarRing}>
              {showPhoto ? (
                <Image
                  source={{ uri: user!.photo as string }}
                  style={styles.avatarImg}
                  onError={() => setPhotoFailed(true)}
                />
              ) : (
                <View style={styles.avatarInner}>
                  <Text style={styles.avatarInitial}>{initial}</Text>
                </View>
              )}
              <View style={styles.avatarDot} />
            </View>
          </TouchableOpacity>
        </View>

        {user?.is_orphan ? (
          <TouchableOpacity
            style={styles.reportsCard}
            activeOpacity={0.85}
            onPress={() => (navigation as any).navigate('AdminOrphanOverview')}
          >
            <View style={styles.reportsIcon}>
              <ReportDocIcon color={PALE_GREEN} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.reportsLabel}>MONTHLY REPORTS</Text>
              <Text style={styles.reportsTitle}>Track this month's submissions</Text>
              <Text style={styles.reportsSubtitle}>
                See who's submitted, review reports, or add one on a child's behalf
              </Text>
            </View>
            <View style={styles.reportsArrow}>
              <ArrowRight color={PALE_GREEN} />
            </View>
          </TouchableOpacity>
        ) : null}

        {/* White body panel - rounded top edge rides up over the dark layer */}
        <View style={styles.body}>
          <Text style={styles.sectionLabel}>Manage</Text>
          <View style={styles.grid}>
            {items.map((item) => {
              const solid = item.variant === 'solid';
              const fg = solid ? '#FFFFFF' : EMERALD;
              return (
                <TouchableOpacity
                  key={item.key}
                  activeOpacity={item.route ? 0.85 : 1}
                  style={[styles.card, solid ? styles.cardSolid : styles.cardSoft]}
                  onPress={() => {
                    if (item.route) (navigation as any).navigate(item.route);
                  }}
                >
                  <View style={[styles.cardIcon, solid ? styles.cardIconSolid : styles.cardIconSoft]}>
                    {item.icon(fg)}
                  </View>
                  <Text style={[styles.cardTitle, solid ? styles.cardTitleSolid : null]}>
                    {item.title}
                  </Text>
                  <Text style={[styles.cardDesc, solid ? styles.cardDescSolid : null]}>
                    {item.desc}
                  </Text>
                  <View style={styles.cardArrowRow}>
                    <View style={[styles.cardArrow, solid ? styles.cardArrowSolid : styles.cardArrowSoft]}>
                      <ArrowRight color={fg} size={16} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#FFFFFF', overflow: 'hidden' },

  bgLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    overflow: 'hidden',
    backgroundColor: HERO_BOTTOM,
    // Animated transforms on Android can promote a view to its own layer and
    // paint above later siblings; explicit zIndex keeps this behind content.
    zIndex: 0,
    elevation: 0,
  },
  scrollFlex: { flex: 1, zIndex: 1, elevation: 1 },
  scrollContent: { paddingBottom: 40 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    marginBottom: 22,
  },
  greetingSmall: { fontSize: 15, color: PALE_GREEN },
  greetingName: { fontSize: 30, fontWeight: '800', color: '#FFFFFF', marginTop: 4 },

  avatarRing: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: { width: 56, height: 56, borderRadius: 28 },
  avatarInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: EMERALD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: '#FFFFFF', fontSize: 22, fontWeight: '700' },
  avatarDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: '#5FE38A',
    borderWidth: 2,
    borderColor: HERO_TOP,
  },

  reportsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: REPORTS_BG,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 20,
  },
  reportsIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  reportsLabel: {
    color: PALE_GREEN,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 5,
  },
  reportsTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginBottom: 6, lineHeight: 23 },
  reportsSubtitle: { color: 'rgba(255,255,255,0.6)', fontSize: 12.5, lineHeight: 18 },
  reportsArrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },

  // The white panel that scrolls up over the dark layer. Its rounded top +
  // opaque white background is what visually "covers" the hero as you scroll.
  body: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 26,
    marginTop: 24,
    minHeight: 520,
  },
  sectionLabel: {
    fontSize: 13,
    color: SUBTLE,
    marginBottom: 14,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: {
    width: '48%',
    borderRadius: 22,
    padding: 16,
    minHeight: 176,
    marginBottom: 14,
  },
  cardSolid: { backgroundColor: EMERALD },
  cardSoft: { backgroundColor: EMERALD_SOFT },
  cardIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  cardIconSolid: { backgroundColor: 'rgba(255,255,255,0.16)' },
  cardIconSoft: { backgroundColor: 'rgba(15,157,88,0.12)' },
  cardTitle: { fontSize: 18, fontWeight: '700', color: INK, marginBottom: 5 },
  cardTitleSolid: { color: '#FFFFFF' },
  cardDesc: { fontSize: 12.5, color: SUBTLE, lineHeight: 17 },
  cardDescSolid: { color: 'rgba(255,255,255,0.8)' },
  cardArrowRow: { marginTop: 'auto', alignItems: 'flex-end' },
  cardArrow: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardArrowSolid: { backgroundColor: 'rgba(255,255,255,0.2)' },
  cardArrowSoft: { backgroundColor: 'rgba(15,157,88,0.12)' },
});
