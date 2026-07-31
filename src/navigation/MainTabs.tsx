import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { useAuth } from '../context/AuthContext';
import PlaceholderCardScreen from '../screens/common/PlaceholderCardScreen';
import MenuScreen from '../screens/common/MenuScreen';
import FeedScreen from '../screens/common/FeedScreen';
import ChildReportWizardScreen from '../screens/orphan/ChildReportWizardScreen';
import TeacherOrphanReportScreen from '../screens/teachers/TeacherOrphanReportScreen';
import AdminOrphanOverviewScreen from '../screens/orphan/AdminOrphanOverviewScreen';
import AdmissionScreen from '../screens/admin/AdmissionScreen';
import ChatListScreen from '../screens/chat/ChatListScreen';
import EnrollmentStatusScreen from '../screens/student/EnrollmentStatusScreen';
import { fetchStudentEnrollmentWorkflowStatus } from '../services/enrollmentWorkflowService';
import { COLORS, BRAND } from '../theme/glass';

// Per-user cache of the last known enrollment gate verdict, so a student who
// opens the app offline sees the same gate decision as their last online
// check rather than being treated as "unknown" - see EnrollmentGate below.
const ENROLLMENT_GATE_CACHE_KEY = '@enrollment_gate_completed_v1';

// Docked bar, no floating/pill styling - matches BottomNavBar.tsx (same
// icons/labels/order/colors) so there's one source of truth for "what does
// the active tab look like" whichever bar happens to be on screen.
const ACTIVE = BRAND.emerald;
const SUBTLE = COLORS.subtle;

const Tab = createBottomTabNavigator();

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

const ICONS: Record<string, (color: string) => React.ReactElement> = {
  Home: (c) => <HomeIcon color={c} />,
  Admission: (c) => <AdmissionIcon color={c} />,
  Reports: (c) => <ReportsIcon color={c} />,
  Chat: (c) => <ChatIcon color={c} />,
  Menu: (c) => <MenuIcon color={c} />,
};

// Docked bar attached to the bottom edge of the screen - full width, square
// corners, no shadow/blur/margins. Active tab is indicated by icon+label
// color and a small top indicator bar, not a pill background.
function TabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();

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

  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route: any, index: number) => {
        const isRouteFocused = state.index === index;
        const renderIcon = ICONS[route.name];
        const color = isRouteFocused ? ACTIVE : SUBTLE;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isRouteFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isRouteFocused ? { selected: true } : {}}
            onPress={onPress}
            style={styles.tabItem}
            activeOpacity={0.7}
          >
            {isRouteFocused && <View style={styles.activeIndicator} pointerEvents="none" />}
            <View style={styles.iconWrap}>{renderIcon && renderIcon(color)}</View>
            <Text style={[styles.label, { color }]} numberOfLines={1}>
              {route.name}
            </Text>
          </TouchableOpacity>
        );
      })}
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

  if (!user.is_orphan) {
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

// A logged-in student whose enrollment workflow isn't `completed` yet must
// see EnrollmentStatusScreen instead of the rest of the app - reuses the
// existing student-facing status fetch/screen as-is, no new backend or UI.
// Orphan-school students have no enrollment pipeline (confirmed elsewhere in
// this codebase, e.g. ReportsRouter above) and are never gated.
function useEnrollmentGate(userId: number | null, token: string | null): boolean | null {
  const [completed, setCompleted] = useState<boolean | null>(null);

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
        const isCompleted = status.record?.status === 'completed';
        if (!cancelled) setCompleted(isCompleted);
        await AsyncStorage.setItem(cacheKey, isCompleted ? '1' : '0');
      } catch {
        // Fetch failed (offline, etc). Keep the cached verdict if there was
        // one; otherwise fail open rather than locking a student out with
        // no data to show them.
        if (!cancelled && !hasCachedVerdict) setCompleted(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, token]);

  return completed;
}

export default function MainTabs() {
  const { user, token } = useAuth();
  const isGatedStudent = !!user && user.role === 'student' && !user.is_orphan;
  const gateCompleted = useEnrollmentGate(isGatedStudent ? user!.id : null, token);

  if (!user) return null;

  if (isGatedStudent && gateCompleted !== true) {
    // gateCompleted === false (workflow not completed) or null (still
    // determining) both show the status screen rather than flashing tabs -
    // it already renders its own loading skeleton while null.
    return <EnrollmentStatusScreen />;
  }

  const isAdminRole = user.role === 'admin' || user.role === 'superadmin';

  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      {/* Home is the social feed (hearts/comments/reposts). The role
          dashboard (teacher/children/manage cards etc) lives directly on
          the Menu tab now, with profile + log out at the bottom of the
          same screen - see MenuScreen.tsx. */}
      <Tab.Screen name="Home" component={FeedScreen} />

      {/* Admins get a real single-student admission form here. */}
      {isAdminRole && <Tab.Screen name="Admission" component={AdmissionScreen} />}

      <Tab.Screen name="Reports" component={ReportsRouter} />
      <Tab.Screen name="Chat" component={ChatListScreen} />
      <Tab.Screen name="Menu" component={MenuScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  activeIndicator: {
    position: 'absolute',
    top: 0,
    width: 28,
    height: 3,
    borderRadius: 2,
    backgroundColor: ACTIVE,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
  },
});
