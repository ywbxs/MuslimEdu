import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { House, MessageSquare, Bell, LayoutGrid, Plus, ScanLine, User } from 'lucide-react-native';
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
import SetupChecklistScreen from '../screens/admin/SetupChecklistScreen';
import AcademicSetupWizardScreen from '../screens/admin/AcademicSetupWizardScreen';
import {
  fetchStudentEnrollmentWorkflowStatus,
  StudentEnrollmentWorkflowStatus,
} from '../services/enrollmentWorkflowService';
import { runSetupChecklistChecks } from '../hooks/useSetupChecklistProgress';
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

// Icons from lucide-react-native (already a react-native-svg peer, already
// installed) instead of hand-rolled SVG paths - one maintained, consistent
// icon family instead of one-off drawn glyphs per icon.
const ICONS: Record<string, (color: string) => React.ReactElement> = {
  Home: (c) => <House color={c} size={24} strokeWidth={2} />,
  // Admin center action (orphan-type and regular school type alike) - a
  // plain plus, not a person-related glyph, per the request that the admin
  // center icon simply read as "add/admission".
  Admission: (c) => <Plus color={c} size={22} strokeWidth={2.3} />,
  // Student center action - opens their status report (classes,
  // attendance, grades - see MyProgressScreen/StudentProgressScreen.tsx).
  MyProgress: (c) => <User color={c} size={20} strokeWidth={2} />,
  Scan: (c) => <ScanLine color={c} size={20} strokeWidth={2} />,
  Chat: (c) => <MessageSquare color={c} size={24} strokeWidth={2} />,
  Alerts: (c) => <Bell color={c} size={24} strokeWidth={2} />,
  Menu: (c) => <LayoutGrid color={c} size={24} strokeWidth={2} />,
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

const ADMIN_SETUP_GATE_CACHE_KEY = '@admin_setup_gate_completed_v1';

/**
 * Same cache-first, fail-closed-only-without-a-cache shape as
 * useEnrollmentGate above, gating a non-orphan admin's whole app behind
 * SetupChecklistScreen until every readiness check passes.
 *
 * The one thing this adds beyond useEnrollmentGate: `hasError` from
 * runSetupChecklistChecks. A single flaky request among the 9 checks must
 * never be read as "not complete" for an admin who was previously confirmed
 * done - that would lock a fully set-up school out of the entire app over
 * a dropped connection. On an errored check, this keeps the last cached
 * verdict (or fails closed only if there's no cache yet at all).
 *
 * `markComplete` lets SetupChecklistScreen itself flip the gate open the
 * instant its own (richer, per-item) load() sees every item done, instead
 * of waiting for this hook's independent recheck to notice.
 */
function useAdminSetupGate(userId: number | null, token: string | null): [boolean | null, () => void] {
  const [completed, setCompleted] = useState<boolean | null>(null);

  useEffect(() => {
    if (!userId || !token) {
      setCompleted(true);
      return;
    }
    let cancelled = false;
    const cacheKey = `${ADMIN_SETUP_GATE_CACHE_KEY}:${userId}`;
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
        // Best-effort cache read - fall through to the live check.
      }

      try {
        const { doneCount, total, hasError } = await runSetupChecklistChecks(token);
        if (cancelled) return;
        if (hasError) {
          if (!hasCachedVerdict) setCompleted(false);
          return;
        }
        const isComplete = total > 0 && doneCount >= total;
        setCompleted(isComplete);
        AsyncStorage.setItem(cacheKey, isComplete ? '1' : '0').catch(() => {});
      } catch {
        if (!cancelled && !hasCachedVerdict) setCompleted(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, token]);

  const markComplete = useCallback(() => {
    setCompleted(true);
    if (userId) {
      AsyncStorage.setItem(`${ADMIN_SETUP_GATE_CACHE_KEY}:${userId}`, '1').catch(() => {});
    }
  }, [userId]);

  return [completed, markComplete];
}

export default function MainTabs() {
  const { user, token } = useAuth();
  const isGatedStudent = !!user && user.role === 'student' && !isOrphanSchoolUser(user);
  const [gateCompleted, applyGateStatus] = useEnrollmentGate(isGatedStudent ? user!.id : null, token);

  // Orphan schools have no class/section/schedule concept at all - the same
  // reason AdminDashboard.tsx already hides every academic tile (including
  // Setup Checklist itself) for them via ACADEMIC_ADMIN_TILE_KEYS. Gating
  // them behind a checklist built around class-based setup would strand
  // them permanently, since most of those 9 checks can never pass for a
  // school type that doesn't use them. Superadmin is exempt too - it
  // manages the whole platform, not one school's academic setup.
  const isGatedAdmin = !!user && user.role === 'admin' && !isOrphanSchoolUser(user);
  // The one-time institution bootstrap (type/profile/first academic year)
  // has to happen BEFORE the fuller 9-item checklist below - Academic Year
  // is one of those 9 checks, so a school that hasn't even chosen an
  // institution type yet can't pass it. Only start the checklist gate's own
  // checks once this earlier flag is already true, so a brand-new admin
  // sees AcademicSetupWizardScreen first, exactly as before this change.
  const needsAcademicBootstrap = isGatedAdmin && user!.academic_setup_completed === false;
  const [setupCompleted, markSetupComplete] = useAdminSetupGate(
    isGatedAdmin && !needsAcademicBootstrap ? user!.id : null,
    token,
  );

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

  if (needsAcademicBootstrap) {
    return <AcademicSetupWizardScreen />;
  }

  if (isGatedAdmin && setupCompleted !== true) {
    // Same reasoning as the student gate above: null (still determining)
    // and false (confirmed incomplete) both show the Setup Assistant -
    // SetupChecklistScreen already renders its own "checking…" state per
    // item while its first load() is in flight. isGate hides the header's
    // back button and BottomNavBar (nothing to go back to, and those
    // buttons would be an escape hatch around this exact lock) in favor of
    // a small Log Out link, and disables "Skip" entirely - every item is
    // required before the rest of the app opens up.
    return <SetupChecklistScreen isGate onAllComplete={markSetupComplete} />;
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
