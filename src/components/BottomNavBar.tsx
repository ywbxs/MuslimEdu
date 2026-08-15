import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';

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
// The notch is a true semicircle, CONCENTRIC with the button: same center
// point (the button's own center always lands exactly on the pill's top
// edge - see centerBtn's `top: -CENTER_BTN_RADIUS` below, which makes that
// true by construction regardless of any other spacing value). Its radius is
// the button's radius plus a small fixed gap, so the cutout traces the
// button's exact curvature at a uniform distance all the way around instead
// of a wider/shallower shape that only roughly frames it.
const NOTCH_GAP = 6;
const NOTCH_RADIUS = CENTER_BTN_RADIUS + NOTCH_GAP;
// Reserved gap between Chat and Alerts, matching the notch's opening width,
// so they sit pulled in close to the button instead of the wide empty
// stretch four evenly-flexed tabs would otherwise leave in the middle.
const CENTER_GAP = NOTCH_RADIUS * 2;
// Clearance above the pill inside tabBarWrap's own white backing panel (see
// tabBarWrap below) - tall enough for the button's full height above the
// pill's top edge PLUS its shadow blur (shadowRadius 10) to still land on
// white, not spill past the panel's edge onto whatever the screen behind it
// is doing.
const WRAP_PADDING_TOP = CENTER_BTN_RADIUS + 14;

/**
 * Rounded-rect pill outline with a true semicircular notch cut into the
 * top-center for the raised button to nest into. Built directly in the
 * bar's own pixel dimensions (no stretched viewBox) so there's no
 * non-uniform scaling to throw the curve or corners off.
 *
 * The notch is drawn with a single elliptical-arc command (rx=ry=NOTCH_RADIUS)
 * rather than a pair of cubic beziers - an earlier version approximated the
 * dip with two bezier curves, which was both wider/shallower than the button
 * (leaving an uneven gap) and prone to a tangent mismatch at the apex if the
 * two curves' control points weren't set up exactly right. A real circular
 * arc has neither problem: it's exactly as round as the button by
 * definition, everywhere along it.
 */
function buildBarPath(width: number, height: number): string {
  const r = CORNER_RADIUS;
  const cx = width / 2;
  const R = NOTCH_RADIUS;
  const left = cx - R;
  const right = cx + R;
  return [
    `M ${r},0`,
    `L ${left},0`,
    // sweep-flag 0 traces the arc through the BOTTOM of the circle centered
    // at (cx, 0) - i.e. dipping down into the pill - rather than the top
    // (which would bulge up and out of it).
    `A ${R},${R} 0 0 0 ${right},0`,
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
    <View style={[styles.tabBarWrap, { paddingTop: WRAP_PADDING_TOP, paddingBottom: OUTER_MARGIN_BOTTOM + bottomInset }]}>
      {centerName && (
        <TouchableOpacity style={styles.centerBtn} activeOpacity={0.85} onPress={() => goTo(centerName)} accessibilityRole="button" accessibilityLabel={centerName}>
          {ICONS[centerName]('#FFFFFF')}
        </TouchableOpacity>
      )}

      <View style={[styles.tabBar, { width: barWidth, height: BAR_HEIGHT, marginHorizontal: OUTER_MARGIN_H }]}>
        <Svg width={barWidth} height={BAR_HEIGHT} style={StyleSheet.absoluteFill} pointerEvents="none">
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
              <TouchableOpacity style={styles.tabItem} activeOpacity={0.7} onPress={() => goTo(name)}>
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
              </TouchableOpacity>
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Opaque white backing panel for the whole floating-pill footer area, not
  // just the pill itself. Without this, the screen's own background (e.g.
  // FeedScreen's CANVAS_SOFT->CANVAS gradient) shows through the transparent
  // margin gutter around the pill and above the raised center button - that
  // gutter reads as a distinct gray/tinted shape hugging the white pill's
  // silhouette, which looks exactly like an unwanted second layer even
  // though nothing extra is actually being drawn. Making this wrapper itself
  // solid white (full width, from above the button down to the safe-area
  // edge via paddingTop/paddingBottom below) means the pill always floats on
  // white no matter what the screen behind it does.
  tabBarWrap: { backgroundColor: '#FFFFFF' },
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
    shadowColor: '#0D1E1C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 9,
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
