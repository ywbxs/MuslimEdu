import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Stop, Rect, Path, Circle } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import HeroGlow from '../../components/HeroGlow';

const EMERALD = '#1FAE64';
const EMERALD_SOFT = '#E5F8F5';
const INK = '#1C1C1E';
const SUBTLE = '#8E8E93';

// --- Glass theme switch --------------------------------------------------
// Frosted/translucent "glass" panels (semi-transparent white over a dark
// hero) used to be the look for cards like the Profile panel on the Student
// dashboard. Flip GLASS_ENABLED back to true to restore that look; every
// screen that imports these from here (instead of hardcoding its own rgba
// values) follows this one switch. When off, panels fall back to a solid
// opaque dark-green card instead of the frosted effect.
export const GLASS_ENABLED = false;
export const GLASS_BG = GLASS_ENABLED ? 'rgba(255,255,255,0.07)' : '#0E2A1E';
export const GLASS_BORDER = GLASS_ENABLED ? 'rgba(255,255,255,0.14)' : '#1B3B2C';
export const GLASS_DIVIDER = GLASS_ENABLED ? 'rgba(255,255,255,0.12)' : '#1B3B2C';
export const GLASS_ICON_BG = GLASS_ENABLED ? 'rgba(255,255,255,0.08)' : '#173225';

// Black-gradient parallax hero, same pattern as AdminDashboard/
// TeacherDashboard/StudentDashboard's own custom implementations (proven
// working there) - brought here so every OTHER role that renders this
// shared shell (SuperAdmin, Cashier, Registrar, Alumni, Placeholder) gets
// the same look instead of the old flat white header.
const HERO_TOP = '#1C1C1E';
const HERO_BOTTOM = '#000000';
const HERO_HEIGHT = 220;
const PARALLAX_FACTOR = 0.5;

function CameraIcon({ color = '#FFFFFF', size = 12 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1-2h7l1 2h2A1.5 1.5 0 0 1 20 8.5V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18V8.5Z" stroke={color} strokeWidth={2.2} strokeLinejoin="round" />
      <Circle cx={12} cy={13} r={3.4} stroke={color} strokeWidth={2.2} />
    </Svg>
  );
}

function GearIcon({ color = '#FFFFFF', size = 18 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 15a3 3 0 100-6 3 3 0 000 6z"
        stroke={color}
        strokeWidth={1.8}
      />
      <Path
        d="M19.4 13a7.5 7.5 0 000-2l1.9-1.5-2-3.4-2.2.9a7.6 7.6 0 00-1.7-1L15 3.8h-4l-.4 2.2a7.6 7.6 0 00-1.7 1l-2.2-.9-2 3.4L6.6 11a7.5 7.5 0 000 2l-1.9 1.5 2 3.4 2.2-.9c.5.4 1.1.8 1.7 1l.4 2.2h4l.4-2.2c.6-.2 1.2-.6 1.7-1l2.2.9 2-3.4L19.4 13z"
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

interface DashboardShellProps {
  title: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * Shared wrapper for every role's dashboard that doesn't have its own fully
 * custom hero (Admin/Teacher/Student do - see their own files): greeting +
 * name, profile photo (synced from the backend's user record, falling back
 * to initials if missing OR if the image URL fails to actually load), a
 * role badge, and whatever content that role's screen provides below it -
 * now on the same black-gradient parallax hero as the custom-hero roles,
 * instead of a flat white header, so every role's Menu screen looks like
 * one app.
 *
 * Logout lives in the Menu tab, not here - tapping the avatar jumps there
 * instead.
 */
export default function DashboardShell({ title, children, footer }: DashboardShellProps) {
  const { user } = useAuth();
  const navigation = useNavigation();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const [photoFailed, setPhotoFailed] = useState(false);
  const [heroHeight, setHeroHeight] = useState(HERO_HEIGHT);
  const scrollY = useRef(new Animated.Value(0)).current;

  const initial = user?.name?.trim()?.[0]?.toUpperCase() ?? '?';
  const showPhoto = !!user?.photo && !photoFailed;

  const bgTranslateY = scrollY.interpolate({
    inputRange: [0, heroHeight],
    outputRange: [0, -heroHeight * PARALLAX_FACTOR],
    extrapolate: 'clamp',
  });
  const bgOpacity = scrollY.interpolate({
    inputRange: [0, heroHeight * 0.6, heroHeight],
    outputRange: [1, 1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.flex}>
      {/* Background depth layer - slower + fading, sits BEHIND the scroll
          view, same technique as AdminDashboard's bgLayer. */}
      <Animated.View
        style={[styles.bgLayer, { height: heroHeight, opacity: bgOpacity, transform: [{ translateY: bgTranslateY }] }]}
        pointerEvents="none"
        renderToHardwareTextureAndroid
      >
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <LinearGradient id="shellHeroGrad" x1="0" y1="0" x2="0.4" y2="1">
              <Stop offset="0" stopColor={HERO_TOP} />
              <Stop offset="1" stopColor={HERO_BOTTOM} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#shellHeroGrad)" />
        </Svg>
        <HeroGlow />
      </Animated.View>

      <Animated.ScrollView
        style={styles.scrollFlex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
      >
        <View
          onLayout={(e) => {
            const measured = e.nativeEvent.layout.height;
            if (Math.abs(measured - heroHeight) > 1) setHeroHeight(measured);
          }}
        >
          <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greetingSmall}>{t('dashboard_shell.greeting', 'Assalamu Alaykum,')}</Text>
              <Text style={styles.greetingName}>{user?.name}</Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>{title}</Text>
              </View>
            </View>

            <View style={styles.headerRight}>
              <TouchableOpacity
                style={styles.settingsBtn}
                onPress={() => (navigation as any).navigate('AccountSettings')}
                hitSlop={10}
              >
                <GearIcon />
              </TouchableOpacity>

              <TouchableOpacity onPress={() => (navigation as any).navigate('Menu')} hitSlop={10}>
                {showPhoto ? (
                  <Image
                    source={{ uri: user!.photo! }}
                    style={styles.avatar}
                    onError={() => setPhotoFailed(true)}
                  />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarFallbackText}>{initial}</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.avatarEditBadge}
                  onPress={() => (navigation as any).navigate('EditProfile')}
                  hitSlop={8}
                >
                  <CameraIcon color={EMERALD} size={11} />
                </TouchableOpacity>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* White rounded body panel rides up over the dark hero, same as
            AdminDashboard's own body. */}
        <View style={styles.body}>
          {children}
          {footer}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#000000' },
  scrollFlex: { flex: 1 },
  scrollContent: { flexGrow: 1 },

  bgLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
    zIndex: 0,
    elevation: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  greetingSmall: { fontSize: 14, color: 'rgba(255,255,255,0.75)', fontWeight: '600' },
  greetingName: { fontSize: 23, fontWeight: '800', color: '#FFFFFF', marginTop: 2, letterSpacing: -0.3 },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    marginTop: 9,
  },
  roleBadgeText: { fontSize: 10.5, fontWeight: '800', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: 0.6 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  settingsBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#F2F2F7', borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  avatarFallbackText: { color: EMERALD, fontSize: 19, fontWeight: '800' },
  avatarEditBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  body: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    marginTop: -18,
    paddingHorizontal: 20,
    paddingTop: 26,
    paddingBottom: 110,
  },
});

export { EMERALD, EMERALD_SOFT, INK, SUBTLE };
