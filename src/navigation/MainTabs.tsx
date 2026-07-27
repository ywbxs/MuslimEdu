import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from '@react-native-community/blur';
import LinearGradient from 'react-native-linear-gradient';
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
import { BRAND, GLASS, SHADOW } from '../theme/glass';

const EMERALD = BRAND.emerald;
// Was rgba(19,42,32,0.45) - too low-contrast against the frosted white tab
// bar, so inactive icons barely showed. Bumped opacity for visibility.
const SUBTLE = 'rgba(17,24,39,0.75)';

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
        d="M20 12a7 7 0 0 1-9.9 6.36L5 19.5l1.14-4.1A7 7 0 1 1 20 12z"
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

// Floating frosted-glass pill bar, anchored above the safe area with a gap
// on every side so the mesh background shows around it (true "spatial" nav —
// the bar reads as an object floating over the screen, not a docked strip).
function TabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.tabBarWrap, { paddingBottom: Math.max(insets.bottom, 14) }]}>
      <View style={[styles.tabBar, SHADOW.level3]}>
        <BlurView blurType="light" blurAmount={GLASS.blurAmount.strong} reducedTransparencyFallbackColor="rgba(255,255,255,0.92)" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, styles.tabBarTint]} />
        {state.routes.map((route: any, index: number) => {
          const isFocused = state.index === index;
          const renderIcon = ICONS[route.name];

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              onPress={onPress}
              style={styles.tabItem}
              activeOpacity={0.7}
            >
              {isFocused && (
                <LinearGradient
                  colors={[BRAND.emeraldLight, BRAND.emerald]}
                  style={[styles.activePill, { backgroundColor: BRAND.emerald }]}
                  pointerEvents="none"
                />
              )}
              <View style={styles.iconWrap}>
                {renderIcon && renderIcon(isFocused ? '#FFFFFF' : SUBTLE)}
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

export default function MainTabs() {
  const { user } = useAuth();
  if (!user) return null;

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
  tabBarWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  tabBar: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 480,
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  tabBarTint: {
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 999,
  },
  activePill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    margin: 2,
    zIndex: 0,
  },
  iconWrap: {
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
