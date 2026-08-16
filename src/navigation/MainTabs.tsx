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
// LoginScreen.tsx's own local-palette precedent. Flat, single-level bar -
// every icon (including the center action) sits on the same row, same
// height, no raised/notched center button. The earlier raised-FAB-in-a-
// notch treatment was a Material "speed dial" pattern, not how Apple's own
// tab bars work: Apple's tab items (including a distinct circular action
// item, e.g. a capture/create button) all live in the same bar, at the
// same level - visually distinct via shape/fill, never elevated out of
// the bar itself.
const ACTIVE = '#0D1E1C';
const SUBTLE = '#6B8C88';
const DANGER = '#D9534F';
const CENTER_BTN_BG = '#16211F';
// Fully transparent - the bar has no background of its own, so the icons
// float directly over whatever the screen behind them is doing.
const BAR_BG = 'transparent';

// Edge-to-edge docked bar - full screen width, no margin lifting it off the
// bottom edge. Side padding for the icons only (no outer margin, since the
// bar itself reaches the screen edges).
const BAR_SIDE_PADDING = 20;

const BAR_PADDING_TOP = 14;
const BAR_PADDING_BOTTOM = 14;
const ICON_SIZE = 24;
const BAR_HEIGHT = BAR_PADDING_TOP + ICON_SIZE + BAR_PADDING_BOTTOM;

// Sized to sit comfortably within the flat row (BAR_HEIGHT) alongside the
// plain 24px icons - bigger than them for visual prominence as the primary
// action, but not so big it needs to be raised out of the bar to fit.
const CENTER_BTN_SIZE = 40;

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
function HomeIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"
        stroke={color}
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
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}
// Student center button - opens their status report (classes, attendance,
// grades - see MyProgressScreen/StudentProgressScreen.tsx).
function ProfileIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8" r="3.4" stroke={color} strokeWidth={1.9} />
      <Path d="M4.5 19.5c0-3.6 3.3-6.2 7.5-6.2s7.5 2.6 7.5 6.2" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
    </Svg>
  );
}
function ChatIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 5h16a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 20 17H9l-4.5 3.5V6.5A1.5 1.5 0 0 1 6 5z"
        stroke={color}
        strokeWidth={1.9}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
function MenuIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Rect x="4" y="4" width="7" height="7" rx="1.6" stroke={color} strokeWidth={1.9} />
      <Rect x="13" y="4" width="7" height="7" rx="1.6" stroke={color} strokeWidth={1.9} />
      <Rect x="4" y="13" width="7" height="7" rx="1.6" stroke={color} strokeWidth={1.9} />
      <Rect x="13" y="13" width="7" height="7" rx="1.6" stroke={color} strokeWidth={1.9} />
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
      <Circle cx="12" cy="20" r="1.4" fill={color} />
    </Svg>
  );
}
function ScanIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
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

const ICONS: Record<string, (color: string) => React.ReactElement> = {
  Home: (c) => <HomeIcon color={c} />,
  Admission: (c) => <AdmissionIcon color={c} />,
  MyProgress: (c) => <ProfileIcon color={c} />,
  Scan: (c) => <ScanIcon color={c} />,
  Chat: (c) => <ChatIcon color={c} />,
  Alerts: (c) => <BellIcon color={c} />,
  Menu: (c) => <MenuIcon color={c} />,
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
  // Bar height covers the icon row PLUS the safe-area gutter below it, so
  // the (transparent) bar's touch/layout area reaches the true screen edge.
  const totalBarHeight = BAR_HEIGHT + bottomInset;

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

  // visibleRoutes is always [Home, Chat, Alerts, Menu] in that order (JSX
  // registration order minus whichever center route was filtered out) -
  // split it around the middle so the center action (real route or the
  // student's synthetic MyProgress button) renders between Chat and Alerts,
  // same visual position as before, but inline/same-level now instead of
  // notched.
  const beforeCenter = visibleRoutes.slice(0, 2);
  const afterCenter = visibleRoutes.slice(2);

  const renderRouteItem = (route: any) => {
    const index = state.routes.indexOf(route);
    const isRouteFocused = state.index === index;
    const renderIcon = ICONS[route.name];
    const color = isRouteFocused ? ACTIVE : SUBTLE;
    return (
      <PressableScale
        key={route.key}
        accessibilityRole="button"
        accessibilityState={isRouteFocused ? { selected: true } : {}}
        onPress={() => goToRoute(route, isRouteFocused)}
        style={styles.tabItem}
        scaleTo={0.88}
      >
        <View style={styles.iconWrap}>
          {renderIcon && renderIcon(color)}
          {route.name === 'Alerts' && <TabBadge count={unreadCount} />}
        </View>
      </PressableScale>
    );
  };

  return (
    <View
      style={[
        styles.tabBar,
        { width: windowWidth, height: totalBarHeight, paddingBottom: bottomInset, backgroundColor: BAR_BG },
      ]}
    >
      {beforeCenter.map(renderRouteItem)}

      {centerRouteName && (
        <PressableScale
          style={styles.tabItem}
          scaleTo={0.9}
          onPress={() => goToRoute(state.routes[centerIndex], centerFocused)}
          accessibilityRole="button"
          accessibilityLabel={centerRouteName}
        >
          <View style={[styles.iconWrap, styles.centerIconWrap]}>{(ICONS[centerRouteName] ?? (() => null))('#FFFFFF')}</View>
        </PressableScale>
      )}
      {showStudentCenter && (
        <PressableScale
          style={styles.tabItem}
          scaleTo={0.9}
          onPress={() => (navigation.getParent() ?? navigation).navigate('MyProgress')}
          accessibilityRole="button"
          accessibilityLabel="My Progress"
        >
          <View style={[styles.iconWrap, styles.centerIconWrap]}>{ICONS.MyProgress('#FFFFFF')}</View>
        </PressableScale>
      )}

      {afterCenter.map(renderRouteItem)}
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
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: BAR_SIDE_PADDING,
  },
  // flex:1 per item - even horizontal distribution and vertical centering
  // both come straight from flexbox, no manual pixel math or reserved-gap
  // spacer to keep in sync with a button size.
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Same row, same height as every other icon - just a filled circle
  // instead of a plain glyph, for visual prominence as the primary action.
  centerIconWrap: {
    width: CENTER_BTN_SIZE,
    height: CENTER_BTN_SIZE,
    borderRadius: CENTER_BTN_SIZE / 2,
    backgroundColor: CENTER_BTN_BG,
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
