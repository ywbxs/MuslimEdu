import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';

// Mirrors MainTabs.tsx's TabBar (same icons/order/colors/notch treatment)
// so screens pushed on the root stack still give one-tap access back to the
// app's main sections, and look like the same nav bar.

const INACTIVE = '#6B8C88';
const ACTIVE = '#0D1E1C';
const DANGER = '#D9534F';
// No backdrop-blur equivalent for a curved shape without a masking library
// (see MainTabs.tsx's TabBar) - opaque enough on its own to stay legible.
const GLASS_FILL = 'rgba(255,255,255,0.82)';
const CENTER_BTN_BG = '#16211F';
// Same notch silhouette as MainTabs.tsx's TabBar - keep these in sync if
// either changes.
const NOTCH_PATH = 'M0,0 L329,0 C400,0 430,460 500,460 C570,460 600,0 671,0 L1000,0 L1000,1000 L0,1000 Z';
// Computed, never measured - see MainTabs.tsx for the full story on why
// onLayout must not come back here.
const ICON_SIZE = 24;
const BAR_PADDING_TOP = 14;
const BAR_PADDING_BOTTOM = 14;

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
  const barHeight = BAR_PADDING_TOP + ICON_SIZE + BAR_PADDING_BOTTOM + bottomInset;
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
        <TouchableOpacity style={styles.centerBtn} activeOpacity={0.85} onPress={() => goTo(centerName)} accessibilityRole="button" accessibilityLabel={centerName}>
          {ICONS[centerName]('#FFFFFF')}
        </TouchableOpacity>
      )}

      <View style={[styles.tabBar, { height: barHeight, paddingBottom: BAR_PADDING_BOTTOM + bottomInset }]}>
        <View style={styles.barBackground} pointerEvents="none">
          <Svg width={windowWidth} height={barHeight} viewBox="0 0 1000 1000" preserveAspectRatio="none">
            <Path d={NOTCH_PATH} fill={GLASS_FILL} />
          </Svg>
        </View>
        {sideTabs.map((name) => {
          const isActive = activeName === name;
          const color = isActive ? ACTIVE : INACTIVE;
          return (
            <TouchableOpacity key={name} style={styles.tabItem} activeOpacity={0.7} onPress={() => goTo(name)}>
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
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Edge-to-edge, no side margins/rounded pill - matches MainTabs.tsx.
  // No padding on the wrap at all - the safe-area inset lives on tabBar's
  // own paddingBottom below, so the glass fill reaches the literal screen
  // edge instead of leaving a gap of bare canvas underneath the bar.
  tabBarWrap: {},
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: BAR_PADDING_TOP,
    paddingHorizontal: 20,
    // Fixed breathing room between each icon, on top of the flex:1 spacing
    // tabItem already gives them - see MainTabs.tsx's TabBar (keep in sync).
    columnGap: 10,
    // No `elevation` - see MainTabs.tsx's tabBar for why (rectangular
    // Android shadow cutting straight across the notch dip).
    shadowColor: '#0D1E1C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
  },
  barBackground: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconWrap: { alignItems: 'center', justifyContent: 'center' },
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
    // No ring border - see MainTabs.tsx's centerBtn (it read as a grey
    // halo over the notch cutout).
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
