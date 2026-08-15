import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import PressableScale from '../components/PressableScale';
import MenuScreen from '../screens/common/MenuScreen';
import FeedScreen from '../screens/common/FeedScreen';
import NotificationsScreen from '../screens/common/NotificationsScreen';
import AdmissionScreen from '../screens/admin/AdmissionScreen';
import ChatListScreen from '../screens/chat/ChatListScreen';
import TeacherAttendanceClassesScreen from '../screens/teachers/TeacherAttendanceClassesScreen';
import EnrollmentStatusScreen from '../screens/student/EnrollmentStatusScreen';
import {
  fetchStudentEnrollmentWorkflowStatus,
  StudentEnrollmentWorkflowStatus,
} from '../services/enrollmentWorkflowService';
import { isOrphanSchoolUser } from '../utils/orphanSchool';

// Teal/mint palette matching the login + feed redesign - see
// LoginScreen.tsx's own local-palette precedent. Floating pill bar (margin
// on all sides, not docked edge-to-edge) with a raised circular center
// button for whichever tab is this role's "primary action" (Admission for
// admin/superadmin, Scan for teacher), nesting into a curved notch cut into
// the pill's top edge.
const ACTIVE = '#0D1E1C';
const SUBTLE = '#6B8C88';
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

const Tab = createBottomTabNavigator();

// Whichever of these routes is present becomes the raised center button
// instead of an inline tab - first match wins, so an admin (who could in
// theory also satisfy a later check) always gets Admission, never Scan.
const CENTER_ROUTE_CANDIDATES = ['Admission', 'Scan'];

// Per-user cache of the last known enrollment gate verdict, so a student who
// opens the app offline sees the same gate decision as their last online
// check rather than being treated as "unknown" - see EnrollmentGate below.
const ENROLLMENT_GATE_CACHE_KEY = '@enrollment_gate_completed_v1';

// --- Inline tab icons (react-native-svg) ---
// Active side-tab icons render FILLED instead of outline-only (matching
// iOS's own filled/outline tab pair convention, e.g. house vs house.fill) -
// same path reused for both: the door/window notch is already carved into
// the path's own outline (the same technique the nav bar's own notch uses),
// so simply filling it instead of stroking it renders correctly with no
// separate "filled" artwork needed.
function HomeIcon({ color, filled }: { color: string; filled?: boolean }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"
        fill={filled ? color : 'none'}
        stroke={filled ? 'none' : color}
        strokeWidth={1.9}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
// Center button for both admin school types (orphan and regular) - a plain
// plus, not the old person+plus admission glyph, per the request that the
// admin center icon simply read as "add/admission".
function AdmissionIcon({ color }: { color: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}
// Student center button - opens their status report (classes, attendance,
// grades - see MyProgressScreen/StudentProgressScreen.tsx).
function ProfileIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8" r="3.4" stroke={color} strokeWidth={1.9} />
      <Path d="M4.5 19.5c0-3.6 3.3-6.2 7.5-6.2s7.5 2.6 7.5 6.2" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
    </Svg>
  );
}
function ChatIcon({ color, filled }: { color: string; filled?: boolean }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 5h16a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 20 17H9l-4.5 3.5V6.5A1.5 1.5 0 0 1 6 5z"
        fill={filled ? color : 'none'}
        stroke={filled ? 'none' : color}
        strokeWidth={1.9}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
function MenuIcon({ color, filled }: { color: string; filled?: boolean }) {
  const shared = filled
    ? { fill: color, stroke: 'none' as const }
    : { fill: 'none' as const, stroke: color, strokeWidth: 1.9 };
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Rect x="4" y="4" width="7" height="7" rx="1.6" {...shared} />
      <Rect x="13" y="4" width="7" height="7" rx="1.6" {...shared} />
      <Rect x="4" y="13" width="7" height="7" rx="1.6" {...shared} />
      <Rect x="13" y="13" width="7" height="7" rx="1.6" {...shared} />
    </Svg>
  );
}
function BellIcon({ color, filled }: { color: string; filled?: boolean }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 17h12l-1.4-2.2A6 6 0 0 1 16 11V9a4 4 0 0 0-8 0v2a6 6 0 0 1-.6 3.8L6 17z"
        fill={filled ? color : 'none'}
        stroke={filled ? 'none' : color}
        strokeWidth={1.9}
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="20" r="1.4" fill={color} />
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
      <Rect x="9" y="9" width="6" height="6" rx="1" stroke={color} strokeWidth={2} />
    </Svg>
  );
}

const ICONS: Record<string, (color: string, filled?: boolean) => React.ReactElement> = {
  Home: (c, f) => <HomeIcon color={c} filled={f} />,
  Admission: (c) => <AdmissionIcon color={c} />,
  MyProgress: (c) => <ProfileIcon color={c} />,
  Scan: (c) => <ScanIcon color={c} />,
  Chat: (c, f) => <ChatIcon color={c} filled={f} />,
  Alerts: (c, f) => <BellIcon color={c} filled={f} />,
  Menu: (c, f) => <MenuIcon color={c} filled={f} />,
};

// Docked bar attached to the bottom edge of the screen - full width, square
// corners, no shadow/blur/margins. Active tab is indicated by icon+label
// color and a small top indicator bar, not a pill background.
function TabBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View style={styles.badge} pointerEvents="none">
      <Text style={styles.badgeText} numberOfLines={1}>
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  );
}

function TabBar({ state, navigation, isStudent }: any) {
  const insets = useSafeAreaInsets();
  const { unreadCount } = useNotifications();
  const { width: windowWidth } = useWindowDimensions();
  const bottomInset = Math.max(insets.bottom, 8);
  const barWidth = windowWidth - OUTER_MARGIN_H * 2;
  const barPath = buildBarPath(barWidth, BAR_HEIGHT);

  // MainTabs stays mounted underneath every screen pushed on top of it in
  // RootNavigator (e.g. ClassListScreen, GradingSystemsScreen - the ones
  // that render their own <BottomNavBar/>). Without this check, this bar
  // renders too, so two bottom bars are visible/overlapping at once.
  // useIsFocused() here tracks whether MainTabs' currently active tab
  // route - and therefore MainTabs itself - is the focused screen in the
  // parent stack; when a screen is pushed on top, this goes false and we
  // simply render nothing.
  const isFocused = useIsFocused();
  if (!isFocused) {
    return null;
  }

  const centerRouteName = CENTER_ROUTE_CANDIDATES.find((name) => state.routes.some((r: any) => r.name === name)) ?? null;
  const visibleRoutes = state.routes.filter((r: any) => r.name !== centerRouteName);
  const centerIndex = centerRouteName ? state.routes.findIndex((r: any) => r.name === centerRouteName) : -1;
  const centerFocused = centerIndex === state.index;
  // Students have no Admission/Scan tab, so their center button isn't a tab
  // at all - it pushes MyProgress (StudentProgressScreen: classes,
  // attendance, grades) on the parent stack instead of switching tabs.
  const showStudentCenter = isStudent && !centerRouteName;

  const goToRoute = (route: any, isRouteFocused: boolean) => {
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!isRouteFocused && !event.defaultPrevented) {
      navigation.navigate(route.name);
    }
  };

  return (
    <View style={[styles.tabBarWrap, { marginBottom: OUTER_MARGIN_BOTTOM + bottomInset }]}>
      {centerRouteName && (
        <PressableScale
          style={styles.centerBtn}
          scaleTo={0.9}
          onPress={() => goToRoute(state.routes[centerIndex], centerFocused)}
          accessibilityRole="button"
          accessibilityLabel={centerRouteName}
        >
          {(ICONS[centerRouteName] ?? (() => null))('#FFFFFF')}
        </PressableScale>
      )}
      {showStudentCenter && (
        <PressableScale
          style={styles.centerBtn}
          scaleTo={0.9}
          onPress={() => (navigation.getParent() ?? navigation).navigate('MyProgress')}
          accessibilityRole="button"
          accessibilityLabel="My Progress"
        >
          {ICONS.MyProgress('#FFFFFF')}
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
        {visibleRoutes.map((route: any, i: number) => {
          const index = state.routes.indexOf(route);
          const isRouteFocused = state.index === index;
          const renderIcon = ICONS[route.name];
          const color = isRouteFocused ? ACTIVE : SUBTLE;

          return (
            <React.Fragment key={route.key}>
              {i === 2 && <View style={styles.centerSpacer} pointerEvents="none" />}
              <PressableScale
                accessibilityRole="button"
                accessibilityState={isRouteFocused ? { selected: true } : {}}
                onPress={() => goToRoute(route, isRouteFocused)}
                style={styles.tabItem}
                scaleTo={0.88}
              >
                <View style={styles.iconWrap}>
                  {renderIcon && renderIcon(color, isRouteFocused)}
                  {route.name === 'Alerts' && <TabBadge count={unreadCount} />}
                </View>
              </PressableScale>
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

// A student with no workflow record at all (`started === false`) is not yet
// in the tracked pipeline - e.g. enrolled before this feature existed, or
// the admin hasn't started their workflow yet. Only an actually-started,
// not-yet-completed record should gate them; "never started" must stay
// open, not be treated as "incomplete".
function isEnrollmentCompleted(status: StudentEnrollmentWorkflowStatus): boolean {
  return !status.started || status.record?.status === 'completed';
}

// A logged-in student whose enrollment workflow isn't `completed` yet must
// see EnrollmentStatusScreen instead of the rest of the app - reuses the
// existing student-facing status fetch/screen as-is, no new backend or UI.
// Orphan-school students have no enrollment pipeline and are never gated.
//
// Returns [completed, applyStatus] - `applyStatus` lets EnrollmentStatusScreen
// feed its own (independent) fetch result back into this gate. Without it, a
// student stuck here after a failed initial check (see the fail-closed catch
// below) would stay stuck forever: tapping "Try again" only re-runs the
// screen's own fetch, never this hook's, so the gate's verdict would never
// update even after enrollment is genuinely completed.
function useEnrollmentGate(
  userId: number | null,
  token: string | null,
): [boolean | null, (status: StudentEnrollmentWorkflowStatus) => void] {
  const [completed, setCompleted] = useState<boolean | null>(null);

  const applyStatus = useCallback(
    (status: StudentEnrollmentWorkflowStatus) => {
      if (!userId) return;
      const isCompleted = isEnrollmentCompleted(status);
      setCompleted(isCompleted);
      AsyncStorage.setItem(`${ENROLLMENT_GATE_CACHE_KEY}:${userId}`, isCompleted ? '1' : '0').catch(() => {
        // Best-effort cache write - a failed write just means the next cold
        // start re-checks live instead of trusting a stale cache, not a bug.
      });
    },
    [userId],
  );

  useEffect(() => {
    if (!userId || !token) {
      setCompleted(true);
      return;
    }
    let cancelled = false;
    const cacheKey = `${ENROLLMENT_GATE_CACHE_KEY}:${userId}`;
    // Reset before checking this user - avoids carrying over a previous
    // user's verdict if this component instance persists across a
    // logout/login switch (e.g. user A gated, then user B logs in).
    setCompleted(null);

    (async () => {
      let hasCachedVerdict = false;
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached !== null) {
          hasCachedVerdict = true;
          if (!cancelled) setCompleted(cached === '1');
        }
      } catch {
        // Best-effort cache read - fall through to the live fetch.
      }

      try {
        const status = await fetchStudentEnrollmentWorkflowStatus(token);
        if (!cancelled) applyStatus(status);
      } catch {
        // Fetch failed (offline, a backend error, etc). Keep the cached
        // verdict if there was one. With no cache to fall back on, fail
        // CLOSED (stay gated) rather than open - failing open here meant any
        // transient error (or a broken backend endpoint) silently unlocked
        // the whole app past an incomplete enrollment, which is exactly the
        // gate this hook exists to enforce. EnrollmentStatusScreen already
        // has its own error banner + "Try again" retry, and its result now
        // feeds back into this gate via applyStatus, so staying gated on a
        // failed fetch doesn't strand the student without a way forward.
        if (!cancelled && !hasCachedVerdict) setCompleted(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, token, applyStatus]);

  return [completed, applyStatus];
}

export default function MainTabs() {
  const { user, token } = useAuth();
  const isGatedStudent = !!user && user.role === 'student' && !isOrphanSchoolUser(user);
  const [gateCompleted, applyGateStatus] = useEnrollmentGate(isGatedStudent ? user!.id : null, token);

  if (!user) return null;

  if (isGatedStudent && gateCompleted !== true) {
    // gateCompleted === false (workflow not completed) or null (still
    // determining) both show the status screen rather than flashing tabs -
    // it already renders its own loading skeleton while null. Passing
    // applyGateStatus lets the screen's own fetch (e.g. on "Try again",
    // or its initial load if the gate's own check failed) unlock the gate
    // too, instead of the two staying out of sync.
    return <EnrollmentStatusScreen onStatusLoaded={applyGateStatus} />;
  }

  const isAdminRole = user.role === 'admin' || user.role === 'superadmin';
  const isTeacherRole = user.role === 'teacher';
  const isStudentRole = user.role === 'student';

  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <TabBar {...props} isStudent={isStudentRole} />}
    >
      {/* Home is the social feed (hearts/comments/reposts). The role
          dashboard (teacher/children/manage cards etc) lives directly on
          the Menu tab now, with profile + log out at the bottom of the
          same screen - see MenuScreen.tsx. */}
      <Tab.Screen name="Home" component={FeedScreen} />

      {/* Admins (orphan-type and regular school type alike) get the raised
          plus center button here, for a real single-student admission
          form. Capped at exactly 5 total bottom-bar icons for every role
          (Home, center, Chat, Alerts, Menu) - the old orphan-only Reports
          tab was dropped; admins reach the equivalent monthly-report
          screen from a dashboard tile instead (see AdminDashboard.tsx). */}
      {isAdminRole && <Tab.Screen name="Admission" component={AdmissionScreen} />}

      {/* Teacher-only, every school type: raised center button jumps into
          the class picker with directTo=AttendanceScan, so tapping a class
          goes straight into scanning instead of the Manual/Scan/Face
          chooser. */}
      {isTeacherRole && (
        <Tab.Screen
          name="Scan"
          component={TeacherAttendanceClassesScreen}
          initialParams={{ directTo: 'AttendanceScan' }}
        />
      )}

      <Tab.Screen name="Chat" component={ChatListScreen} />
      <Tab.Screen name="Alerts" component={NotificationsScreen} />
      <Tab.Screen name="Menu" component={MenuScreen} />
    </Tab.Navigator>
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
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
});
