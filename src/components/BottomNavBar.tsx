import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import PressableScale from './PressableScale';

// Mirrors MainTabs.tsx's TabBar (same icons/order/colors/pill+notch shape)
// so screens pushed on the root stack still give one-tap access back to the
// app's main sections, and look like the same nav bar.

const INACTIVE = '#6B8C88';
const ACTIVE = '#0D1E1C';
const DANGER = '#D9534F';
const CENTER_BTN_BG = '#16211F';
// Fully transparent - the bar has no background of its own at all now, so
// the icons and the center button float directly over whatever the screen
// behind them is doing. The notch-cutout path (see buildBarPath) still
// exists structurally but is a no-op visually while this is transparent -
// left in place rather than ripped out so a solid fill can come back
// later without rebuilding the shape.
const BAR_BG = 'transparent';

// Edge-to-edge docked bar, not a floating pill - full screen width, square
// corners, no margin lifting it off the bottom edge, no border. Side
// padding for the icons only (no outer margin, since the bar itself now
// reaches the screen edges).
const BAR_SIDE_PADDING = 20;

const BAR_PADDING_TOP = 14;
const BAR_PADDING_BOTTOM = 14;
const ICON_SIZE = 24;
const BAR_HEIGHT = BAR_PADDING_TOP + ICON_SIZE + BAR_PADDING_BOTTOM;

const CENTER_BTN_SIZE = 52;
const CENTER_BTN_RADIUS = CENTER_BTN_SIZE / 2;
// The notch is a true semicircle, CONCENTRIC with the button: same center
// point (the button's own center always lands exactly on the pill's top
// edge - see centerBtn's `top: -CENTER_BTN_RADIUS` below, which makes that
// true by construction regardless of any other spacing value). Its radius
// is the button's own radius plus a small fixed gap, so the cutout traces
// the button's exact circular curvature at a uniform distance all the way
// around - a perfect circle, not an approximated wider/shallower dip.
const NOTCH_GAP = 6;
const NOTCH_RADIUS = CENTER_BTN_RADIUS + NOTCH_GAP;
// Reserved gap between Chat and Alerts, matching the notch's opening width,
// so they sit pulled in close to the button instead of the wide empty
// stretch four evenly-flexed tabs would otherwise leave in the middle.
const CENTER_GAP = NOTCH_RADIUS * 2;
/**
 * Full-width rectangle, square corners, with a true semicircular notch cut
 * into the top-center for the raised button to nest into - drawn with a
 * single SVG elliptical-arc command (rx=ry=NOTCH_RADIUS), not an
 * approximated bezier dip, so it's exactly as round as the button by
 * definition, everywhere along the curve. Built directly in the bar's own
 * pixel dimensions (no stretched viewBox) so there's no non-uniform
 * scaling to throw the curve off.
 */
function buildBarPath(width: number, height: number): string {
  const cx = width / 2;
  const R = NOTCH_RADIUS;
  const left = cx - R;
  const right = cx + R;
  return [
    `M 0,0`,
    `L ${left},0`,
    // sweep-flag 0 traces the arc through the BOTTOM of the circle centered
    // at (cx, 0) - i.e. dipping down into the bar - rather than the top
    // (which would bulge up and out of it).
    `A ${R},${R} 0 0 0 ${right},0`,
    `L ${width},0`,
    `L ${width},${height}`,
    `L 0,${height}`,
    'Z',
  ].join(' ');
}

function HomeIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M3 11l9-7 9 7v8a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" stroke={color} strokeWidth={1.9} strokeLinejoin="round" />
    </Svg>
  );
}
// Admin center button (orphan-type and regular school type alike) - a plain
// plus, matching MainTabs.tsx's TabBar.
function AdmissionIcon({ color }: { color: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}
function ScanIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 8V6a2 2 0 0 1 2-2h2M4 16v2a2 2 0 0 0 2 2h2M20 8V6a2 2 0 0 0-2-2h-2M20 16v2a2 2 0 0 1-2 2h-2"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Rect x={9} y={9} width={6} height={6} rx={1} stroke={color} strokeWidth={2} />
    </Svg>
  );
}
// Student center button - opens their status report (classes, attendance,
// grades - see MyProgressScreen/StudentProgressScreen.tsx).
function ProfileIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={3.4} stroke={color} strokeWidth={1.9} />
      <Path d="M4.5 19.5c0-3.6 3.3-6.2 7.5-6.2s7.5 2.6 7.5 6.2" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
    </Svg>
  );
}
function ChatIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M4 5h16a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 20 17H9l-4.5 3.5V6.5A1.5 1.5 0 0 1 6 5z" stroke={color} strokeWidth={1.9} strokeLinejoin="round" />
    </Svg>
  );
}
function BellIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 17h12l-1.4-2.2A6 6 0 0 1 16 11V9a4 4 0 0 0-8 0v2a6 6 0 0 1-.6 3.8L6 17z"
        stroke={color}
        strokeWidth={1.9}
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={20} r={1.4} fill={color} />
    </Svg>
  );
}
function MenuIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={4} width={7} height={7} rx={1.6} stroke={color} strokeWidth={1.9} />
      <Rect x={13} y={4} width={7} height={7} rx={1.6} stroke={color} strokeWidth={1.9} />
      <Rect x={4} y={13} width={7} height={7} rx={1.6} stroke={color} strokeWidth={1.9} />
      <Rect x={13} y={13} width={7} height={7} rx={1.6} stroke={color} strokeWidth={1.9} />
    </Svg>
  );
}

const ICONS: Record<string, (color: string) => React.ReactElement> = {
  Home: (c) => <HomeIcon color={c} />,
  Admission: (c) => <AdmissionIcon color={c} />,
  Scan: (c) => <ScanIcon color={c} />,
  MyProgress: (c) => <ProfileIcon color={c} />,
  Chat: (c) => <ChatIcon color={c} />,
  Alerts: (c) => <BellIcon color={c} />,
  Menu: (c) => <MenuIcon color={c} />,
};

// Best-effort read of the currently focused tab inside MainTabs so we can
// highlight it. Falls back to no active tab if the shape isn't found.
function useActiveTabName(): string | null {
  return useNavigationState((state) => {
    try {
      const findTabs = (s: any): any => {
        if (!s) return null;
        const route = s.routes?.[s.index];
        if (!route) return null;
        if (route.name === 'MainTabs' && route.state) return route.state;
        return route.state ? findTabs(route.state) : null;
      };
      const tabState = findTabs(state);
      if (tabState && typeof tabState.index === 'number') {
        return tabState.routes[tabState.index]?.name ?? null;
      }
    } catch {
      /* noop */
    }
    return null;
  });
}

export default function BottomNavBar() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const activeName = useActiveTabName();
  const bottomInset = Math.max(insets.bottom, 8);
  const barWidth = windowWidth;
  // The bar's own rendered height covers the icon row PLUS the safe-area
  // gutter below it, so the white fill reaches the true screen edge instead
  // of leaving a gap that would expose the screen's background there.
  const totalBarHeight = BAR_HEIGHT + bottomInset;
  const barPath = buildBarPath(barWidth, totalBarHeight);
  const isAdminRole = user?.role === 'admin' || user?.role === 'superadmin';
  const isTeacherRole = user?.role === 'teacher';
  const isStudentRole = user?.role === 'student';

  // Raised center button, same mapping as MainTabs.tsx's TabBar: Admission
  // for both admin school types, Scan for teachers, MyProgress (their
  // status report) for students - always exactly one, capping this bar at
  // 5 total icons for every role.
  const centerName = isAdminRole ? 'Admission' : isTeacherRole ? 'Scan' : isStudentRole ? 'MyProgress' : null;

  const sideTabs = ['Home', 'Chat', 'Alerts', 'Menu'];

  const goTo = (name: string) => {
    // MyProgress is a RootNavigator stack screen, not a MainTabs tab - push
    // it directly instead of routing through MainTabs' screen param.
    if (name === 'MyProgress') {
      (navigation as any).navigate('MyProgress');
      return;
    }
    (navigation as any).navigate('MainTabs', { screen: name });
  };

  return (
    <View style={styles.tabBarWrap}>
      {centerName && (
        <PressableScale style={styles.centerBtn} scaleTo={0.9} onPress={() => goTo(centerName)} accessibilityRole="button" accessibilityLabel={centerName}>
          {ICONS[centerName]('#FFFFFF')}
        </PressableScale>
      )}

      <View style={[styles.tabBar, { width: barWidth, height: totalBarHeight, paddingBottom: bottomInset }]}>
        <Svg width={barWidth} height={totalBarHeight} style={StyleSheet.absoluteFill} pointerEvents="none">
          {/* The notch cutout is genuinely transparent - no white backing
              shape and no border - it shows whatever's actually behind the
              bar there. */}
          <Path d={barPath} fill={BAR_BG} />
        </Svg>
        {sideTabs.map((name, i) => {
          const isActive = activeName === name;
          const color = isActive ? ACTIVE : INACTIVE;
          return (
            <React.Fragment key={name}>
              {i === 2 && <View style={styles.centerSpacer} pointerEvents="none" />}
              <PressableScale style={styles.tabItem} scaleTo={0.88} onPress={() => goTo(name)}>
                <View style={styles.iconWrap}>
                  {ICONS[name](color)}
                  {name === 'Alerts' && unreadCount > 0 && (
                    <View style={styles.badge} pointerEvents="none">
                      <Text style={styles.badgeText} numberOfLines={1}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </Text>
                    </View>
                  )}
                </View>
              </PressableScale>
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // No backgroundColor here - this wrapper is just a positioning box for the
  // bar and the button, not a second white surface behind them. Only the
  // bar's own SVG fill (BAR_BG) is white.
  tabBarWrap: {},
  // No shadow* or elevation here at all. shadow*-only (no elevation) was
  // tried on the theory that Android only reacts to elevation and shadow*
  // is a no-op there - but on this build, adding shadow* back brought the
  // exact same symptoms as elevation had (the fill and notch cutout both
  // disappeared again), so whatever the precise mechanism, this View can't
  // carry any shadow property at all while its fill lives on a child Svg
  // with no backgroundColor of its own.
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: BAR_SIDE_PADDING,
  },
  // flex:1 per item + centered content - even horizontal distribution and
  // vertical centering both come straight from flexbox, no manual pixel
  // math to keep in sync with anything else. Home/Chat split the space left
  // of centerSpacer, Alerts/Menu split the space right of it.
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerSpacer: { width: CENTER_GAP },
  iconWrap: { alignItems: 'center', justifyContent: 'center' },
  centerBtn: {
    position: 'absolute',
    top: -CENTER_BTN_RADIUS,
    left: '50%',
    marginLeft: -CENTER_BTN_RADIUS,
    width: CENTER_BTN_SIZE,
    height: CENTER_BTN_SIZE,
    borderRadius: CENTER_BTN_RADIUS,
    backgroundColor: CENTER_BTN_BG,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    // No shadow/elevation. The button's own drop shadow used to bleed into
    // the transparent notch gap around it - a cast shadow needs a surface to
    // land on, and where the notch is genuinely transparent (revealing the
    // screen behind the bar) it just showed up as an isolated gray blob
    // instead of blending into anything. The button's solid dark fill
    // against the white pill gives it enough definition without one.
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: DANGER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
});
