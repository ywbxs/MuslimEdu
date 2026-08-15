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
// Solid white pill - no translucency/glass. An earlier version split the
// fill and border into two separate SVG paths (fill traced the notch
// shape, border traced a plain notch-less rect) specifically so the
// border wouldn't outline the notch cutout - but that meant the two
// layers had different silhouettes, which is exactly what read as a
// "nested pill" / nested-layer look: the border line ran straight across
// where the fill actually dipped down for the notch. Both now use the
// SAME path (see barPath), so there's only ever one shape.
const BAR_BG = '#FFFFFF';
// Subtle edge so the pill still separates cleanly from a similarly light
// screen behind it even with no shadow defining its silhouette - see the
// no-shadow/elevation note on tabBar below for why there's no other
// definition.
const BAR_STROKE = 'rgba(13,30,28,0.1)';

// Floating pill, not edge-to-edge - margin on all sides instead of docking
// flush to the screen.
const OUTER_MARGIN_H = 16;
const OUTER_MARGIN_BOTTOM = 12;
const CORNER_RADIUS = 26;

const BAR_PADDING_TOP = 14;
const BAR_PADDING_BOTTOM = 14;
const ICON_SIZE = 24;
const BAR_HEIGHT = BAR_PADDING_TOP + ICON_SIZE + BAR_PADDING_BOTTOM;

const CENTER_BTN_SIZE = 52;
const CENTER_BTN_RADIUS = CENTER_BTN_SIZE / 2;
// How deep the bar's notch cuts in, and how wide its opening is at the
// bar's top edge. Deliberately a bit WIDER and DEEPER than the button's own
// radius so the curve is actually visible peeking out past the button's
// silhouette at a normal viewing scale - sizing it to hide entirely behind
// the button (as an earlier version of this did) made it effectively
// invisible except under heavy zoom. There's no View-level shadow on this
// bar (see the note on tabBar below), so the small sliver of exposed
// transparent gap this leaves around the button doesn't risk the "shadow
// bleeds into the cutout" bug from the earlier full-width notch attempt.
const NOTCH_DEPTH = CENTER_BTN_RADIUS + 6;
const NOTCH_HALF_WIDTH = CENTER_BTN_RADIUS + 20;
// Reserved gap between Chat and Alerts, matching the notch's opening width,
// so they sit pulled in close to the button instead of the wide empty
// stretch four evenly-flexed tabs would otherwise leave in the middle.
const CENTER_GAP = NOTCH_HALF_WIDTH * 2;
/**
 * Rounded-rect pill outline with a smooth curved dip at the top-center for
 * the raised button to nest into. Built directly in the bar's own pixel
 * dimensions (no stretched viewBox) so there's no non-uniform scaling to
 * throw the curve or corners off.
 *
 * Both notch curves reach the apex with a HORIZONTAL tangent (their control
 * point shares the apex's own y) - a true rounded minimum, like the bottom
 * of a parabola. An earlier version gave both curves a control point at the
 * SAME (x, y) as each other, which put them at exactly opposite tangent
 * directions right at the apex (one arriving straight down, the other
 * departing straight up) - mathematically a cusp, not a curve, which
 * rendered as a visible spike/glitch once the notch was made deep enough
 * for it to be noticeable.
 */
function buildBarPath(width: number, height: number): string {
  const r = CORNER_RADIUS;
  const cx = width / 2;
  const left = cx - NOTCH_HALF_WIDTH;
  const right = cx + NOTCH_HALF_WIDTH;
  const armX = NOTCH_HALF_WIDTH * 0.6;
  const apexArmX = NOTCH_HALF_WIDTH * 0.35;
  return [
    `M ${r},0`,
    `L ${left},0`,
    `C ${left + armX},0 ${cx - apexArmX},${NOTCH_DEPTH} ${cx},${NOTCH_DEPTH}`,
    `C ${cx + apexArmX},${NOTCH_DEPTH} ${right - armX},0 ${right},0`,
    `L ${width - r},0`,
    `Q ${width},0 ${width},${r}`,
    `L ${width},${height - r}`,
    `Q ${width},${height} ${width - r},${height}`,
    `L ${r},${height}`,
    `Q 0,${height} 0,${height - r}`,
    `L 0,${r}`,
    `Q 0,0 ${r},0`,
    'Z',
  ].join(' ');
}

// Buffer added around the notch cutout's own extent when backing it in white
// (see NOTCH_CAP below) - a plain rect a few px larger on every side than
// the actual cutout, rather than a shape tracing the exact bezier curve.
// Trying to match the curve precisely left a visible seam (two independently
// anti-aliased edges that are SUPPOSED to align exactly don't always
// perfectly agree pixel-for-pixel), which read as a thin gray line right
// where they met. A generously oversized rect sidesteps that: everywhere it
// extends past the actual cutout is simply hidden under the outline's own
// opaque white fill (same color, so even overlapping it's invisible), and
// the only place it's ever actually visible is the cutout itself, fully
// covered with margin to spare.
const NOTCH_CAP_BUFFER = 6;

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
  const barWidth = windowWidth - OUTER_MARGIN_H * 2;
  const barPath = buildBarPath(barWidth, BAR_HEIGHT);
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
    <View style={[styles.tabBarWrap, { marginBottom: OUTER_MARGIN_BOTTOM + bottomInset }]}>
      {centerName && (
        <PressableScale style={styles.centerBtn} scaleTo={0.9} onPress={() => goTo(centerName)} accessibilityRole="button" accessibilityLabel={centerName}>
          {ICONS[centerName]('#FFFFFF')}
        </PressableScale>
      )}

      <View style={[styles.tabBar, { width: barWidth, height: BAR_HEIGHT, marginHorizontal: OUTER_MARGIN_H }]}>
        <Svg width={barWidth} height={BAR_HEIGHT} style={StyleSheet.absoluteFill} pointerEvents="none">
          {/* Notch backing first (behind) - a generously oversized rect, not
              a shape tracing the cutout's exact curve - see NOTCH_CAP_BUFFER
              above for why. */}
          <Rect
            x={barWidth / 2 - NOTCH_HALF_WIDTH - NOTCH_CAP_BUFFER}
            y={0}
            width={(NOTCH_HALF_WIDTH + NOTCH_CAP_BUFFER) * 2}
            height={NOTCH_DEPTH + NOTCH_CAP_BUFFER}
            fill={BAR_BG}
          />
          {/* One path for both fill and stroke, so the border and the
              filled shape are always exactly the same silhouette - see
              BAR_BG above for why this used to be two separate paths. */}
          <Path d={barPath} fill={BAR_BG} stroke={BAR_STROKE} strokeWidth={1} />
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
  // pill and the button, not a second white surface behind them. Only the
  // pill's own SVG fill (BAR_BG) is white; wrapping it in an additional
  // opaque backdrop was tried and reverted - it fixed the screen background
  // showing through the margin gutter, but made the floating footer visibly
  // taller/more padded than intended.
  tabBarWrap: {},
  // No shadow* or elevation here at all. shadow*-only (no elevation) was
  // tried on the theory that Android only reacts to elevation and shadow*
  // is a no-op there - but on this build, adding shadow* back brought the
  // exact same symptoms as elevation had (the translucent fill and notch
  // cutout both disappeared again), so whatever the precise mechanism,
  // this View can't carry any shadow property at all while its fill lives
  // on a child Svg with no backgroundColor of its own. The pill's own SVG
  // stroke (see BAR_STROKE) is what gives it a visible edge instead.
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: CORNER_RADIUS,
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
