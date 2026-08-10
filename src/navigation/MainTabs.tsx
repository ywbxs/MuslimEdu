import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import PlaceholderCardScreen from '../screens/common/PlaceholderCardScreen';
import MenuScreen from '../screens/common/MenuScreen';
import FeedScreen from '../screens/common/FeedScreen';
import NotificationsScreen from '../screens/common/NotificationsScreen';
import ChildReportWizardScreen from '../screens/orphan/ChildReportWizardScreen';
import TeacherOrphanReportScreen from '../screens/teachers/TeacherOrphanReportScreen';
import AdminOrphanOverviewScreen from '../screens/orphan/AdminOrphanOverviewScreen';
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
// LoginScreen.tsx's own local-palette precedent. Floating glass pill bar
// with a raised circular center button for whichever tab is this role's
// "primary action" (Admission for admin/superadmin, Scan for teacher),
// instead of the old docked square bar with that tab inline.
const ACTIVE = '#0D1E1C';
const SUBTLE = '#6B8C88';
const DANGER = '#D9534F';
// No backdrop-blur equivalent without a masking library (see TabBar's
// notch rendering), so this needs to be opaque enough on its own to keep
// icons legible over whatever's scrolling underneath - higher than a
// typical "glass" alpha would be if it were sitting on real blur.
const GLASS_FILL = 'rgba(255,255,255,0.82)';
// Shape of the tab bar's top edge: flat, dips into a shallow curved notch
// for the raised center button to nest into, flat again to the far edge -
// same silhouette as the login/feed mockups' SVG clipPath, expressed as a
// fillable Path instead (RN has no clip-path equivalent for arbitrary
// View shapes). Coordinates are in a 0-1000 unit box; stretched to the
// bar's actual pixel size by the Svg's width/height="100%".
const NOTCH_PATH = 'M0,0 L329,0 C400,0 430,460 500,460 C570,460 600,0 671,0 L1000,0 L1000,1000 L0,1000 Z';
const CENTER_BTN_BG = '#16211F';

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
function AdmissionIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Circle cx="9" cy="8" r="3.2" stroke={color} strokeWidth={1.9} />
      <Path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
      <Path d="M18 8v6M15 11h6" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
    </Svg>
  );
}
function ReportsIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M5 20V10M12 20V4M19 20v-7" stroke={color} strokeWidth={2} strokeLinecap="round" />
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

const ICONS: Record<string, (color: string) => React.ReactElement> = {
  Home: (c) => <HomeIcon color={c} />,
  Admission: (c) => <AdmissionIcon color={c} />,
  Reports: (c) => <ReportsIcon color={c} />,
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

function TabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { unreadCount } = useNotifications();

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

  const goToRoute = (route: any, isRouteFocused: boolean) => {
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!isRouteFocused && !event.defaultPrevented) {
      navigation.navigate(route.name);
    }
  };

  return (
    <View style={styles.tabBarWrap}>
      {centerRouteName && (
        <TouchableOpacity
          style={styles.centerBtn}
          activeOpacity={0.85}
          onPress={() => goToRoute(state.routes[centerIndex], centerFocused)}
          accessibilityRole="button"
          accessibilityLabel={centerRouteName}
        >
          {(ICONS[centerRouteName] ?? (() => null))('#FFFFFF')}
        </TouchableOpacity>
      )}

      <View style={[styles.tabBar, { paddingBottom: 14 + Math.max(insets.bottom, 8) }]}>
        {/* A rectangular BlurView can't be clipped to this curved shape
            without a masking library, so the "glass" here is a translucent
            fill + shadow rather than a true backdrop blur - same tradeoff
            noted on centerBtn. preserveAspectRatio="none" stretches the
            path non-uniformly to fill the bar's real width/height, the same
            way the mockup's objectBoundingBox clipPath did. */}
        <Svg width="100%" height="100%" viewBox="0 0 1000 1000" preserveAspectRatio="none" style={StyleSheet.absoluteFillObject}>
          <Path d={NOTCH_PATH} fill={GLASS_FILL} />
        </Svg>
        {visibleRoutes.map((route: any) => {
          const index = state.routes.indexOf(route);
          const isRouteFocused = state.index === index;
          const renderIcon = ICONS[route.name];
          const color = isRouteFocused ? ACTIVE : SUBTLE;

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isRouteFocused ? { selected: true } : {}}
              onPress={() => goToRoute(route, isRouteFocused)}
              style={styles.tabItem}
              activeOpacity={0.7}
            >
              <View style={styles.iconWrap}>
                {renderIcon && renderIcon(color)}
                {route.name === 'Alerts' && <TabBadge count={unreadCount} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function AdmissionPlaceholder() {
  return <PlaceholderCardScreen title="Admission" />;
}
function ReportsPlaceholder() {
  return <PlaceholderCardScreen title="Reports" />;
}

function ReportsRouter() {
  const { user } = useAuth();
  if (!user) return null;

  const isAdmin = user.role === 'admin' || user.role === 'superadmin';

  if (!isOrphanSchoolUser(user)) {
    return <ReportsPlaceholder />;
  }

  if (isAdmin) {
    return <AdminOrphanOverviewScreen />;
  }

  // A "teacher-orphan" (role === 'teacher' && is_orphan) is a different
  // person/feature from a child-orphan (student) - they must never share
  // the same monthly-report screen or payload. See
  // TeacherOrphanReportScreen.tsx / ChildReportWizardScreen.tsx.
  if (user.role === 'teacher') {
    return <TeacherOrphanReportScreen />;
  }
  return <ChildReportWizardScreen />;
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
// Orphan-school students have no enrollment pipeline (confirmed elsewhere in
// this codebase, e.g. ReportsRouter above) and are never gated.
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
  // Reports is the monthly-report feature (child report wizard / teacher-
  // orphan report / admin orphan overview) - it only has real content for
  // orphan schools (see ReportsRouter above); everywhere else it was just a
  // dead placeholder tab. Hidden for every role, including admin, on a
  // non-orphan school.
  const showReports = isOrphanSchoolUser(user);

  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      {/* Home is the social feed (hearts/comments/reposts). The role
          dashboard (teacher/children/manage cards etc) lives directly on
          the Menu tab now, with profile + log out at the bottom of the
          same screen - see MenuScreen.tsx. */}
      <Tab.Screen name="Home" component={FeedScreen} />

      {/* Admins get a real single-student admission form here. */}
      {isAdminRole && <Tab.Screen name="Admission" component={AdmissionScreen} />}

      {showReports && <Tab.Screen name="Reports" component={ReportsRouter} />}

      {/* Teacher-only, every school type: jumps into the class picker with
          directTo=AttendanceScan, so tapping a class goes straight into
          scanning instead of the Manual/Scan/Face chooser. Sits next to
          Reports (or in Reports' old spot when hidden) so it lands near the
          middle of the bar. */}
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
  // Edge-to-edge, no side margins/rounded pill - full-width glass bar, same
  // as the login/feed mockups' tab-bar-wrap (0 padding at all, including
  // bottom - the safe-area inset lives on tabBar's own paddingBottom below
  // instead, so the glass fill itself reaches the literal screen edge
  // rather than leaving a gap of bare canvas underneath the bar).
  tabBarWrap: {},
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 14,
    paddingHorizontal: 20,
    shadowColor: '#0D1E1C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerBtn: {
    position: 'absolute',
    top: -15,
    left: '50%',
    marginLeft: -24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: CENTER_BTN_BG,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    shadowColor: '#0D1E1C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 9,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.55)',
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
