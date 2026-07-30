import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { useAuth } from '../context/AuthContext';
import { getDashboardForRole } from './roleScreens';
import PlaceholderCardScreen from '../screens/common/PlaceholderCardScreen';
import MenuScreen from '../screens/common/MenuScreen';
import OrphanReportScreen from '../screens/orphan/OrphanReportScreen';
import AdminOrphanOverviewScreen from '../screens/orphan/AdminOrphanOverviewScreen';
import AdmissionScreen from '../screens/admin/AdmissionScreen';

const EMERALD = '#0F9D58';
const SUBTLE = '#9AA0A6';

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

// Anchored (non-floating) bar, icons only, no labels, no active pill.
function TabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
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
            {renderIcon && renderIcon(isFocused ? EMERALD : SUBTLE)}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function AdmissionPlaceholder() {
  return <PlaceholderCardScreen title="Admission" />;
}
function ChatPlaceholder() {
  return <PlaceholderCardScreen title="Chat" />;
}
function ReportsPlaceholder() {
  return <PlaceholderCardScreen title="Reports" />;
}

function HomeRouter() {
  const { user } = useAuth();
  if (!user) return null;
  return getDashboardForRole(user.role);
}

function ReportsRouter() {
  const { user } = useAuth();
  if (!user) return null;

  const isAdmin = user.role === 'admin' || user.role === 'superadmin';

  if (user.is_orphan) {
    return isAdmin ? <AdminOrphanOverviewScreen /> : <OrphanReportScreen />;
  }
  return <ReportsPlaceholder />;
}

export default function MainTabs() {
  const { user } = useAuth();
  if (!user) return null;

  const isAdminRole = user.role === 'admin' || user.role === 'superadmin';

  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tab.Screen name="Home" component={HomeRouter} />

      {/* Admins get a real single-student admission form here. */}
      {isAdminRole && <Tab.Screen name="Admission" component={AdmissionScreen} />}

      <Tab.Screen name="Reports" component={ReportsRouter} />
      <Tab.Screen name="Chat" component={ChatPlaceholder} />
      <Tab.Screen name="Menu" component={MenuScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#ECEEF0',
    paddingTop: 12,
    // Subtle lift on iOS; Android keeps a clean hairline border (elevation on
    // a bordered bar renders as a hard gray block, so we skip it there).
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: -2 },
      },
      default: {},
    }),
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
});
