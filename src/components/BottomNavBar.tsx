import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from '@react-native-community/blur';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { isOrphanSchoolUser } from '../utils/orphanSchool';

// Mirrors MainTabs.tsx's TabBar (same icons/order/colors/floating-pill
// treatment) so screens pushed on the root stack still give one-tap access
// back to the app's main sections, and look like the same nav bar.

const INACTIVE = '#6B8C88';
const ACTIVE = '#0D1E1C';
const DANGER = '#D9534F';
const GLASS_BORDER = 'rgba(255,255,255,0.65)';
const GLASS_FILL = 'rgba(255,255,255,0.55)';
const CENTER_BTN_BG = '#16211F';

function HomeIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M3 11l9-7 9 7v8a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" stroke={color} strokeWidth={1.9} strokeLinejoin="round" />
    </Svg>
  );
}
function AdmissionIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Circle cx={9} cy={8} r={3.2} stroke={color} strokeWidth={1.9} />
      <Path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
      <Path d="M18 8v6M15 11h6" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
    </Svg>
  );
}
function ReportsIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M6 20V11M12 20V4M18 20v-7" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
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
  Reports: (c) => <ReportsIcon color={c} />,
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
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const activeName = useActiveTabName();
  const isAdminRole = user?.role === 'admin' || user?.role === 'superadmin';
  // Reports only has real content on orphan schools - see MainTabs.tsx.
  const showReports = isOrphanSchoolUser(user);

  // Admission (admin/superadmin only) is the raised center button, same as
  // MainTabs.tsx - this simplified bar has no "Scan" tab to fall back to.
  const centerName = isAdminRole ? 'Admission' : null;

  const sideTabs = ['Home', ...(showReports ? ['Reports'] : []), 'Chat', 'Alerts', 'Menu'];

  const goTo = (name: string) => (navigation as any).navigate('MainTabs', { screen: name });

  return (
    <View style={[styles.tabBarWrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {centerName && (
        <TouchableOpacity style={styles.centerBtn} activeOpacity={0.85} onPress={() => goTo(centerName)} accessibilityRole="button" accessibilityLabel={centerName}>
          {ICONS[centerName]('#FFFFFF')}
        </TouchableOpacity>
      )}

      <View style={styles.tabBar}>
        <BlurView blurType="light" blurAmount={24} reducedTransparencyFallbackColor="#FFFFFF" style={StyleSheet.absoluteFillObject} />
        <View style={[StyleSheet.absoluteFillObject, styles.tabBarTint]} />
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
  tabBarWrap: { paddingHorizontal: 16, paddingTop: 0 },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 64,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    overflow: 'hidden',
    shadowColor: '#0D1E1C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 8,
  },
  tabBarTint: { backgroundColor: GLASS_FILL },
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
  badgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
});
