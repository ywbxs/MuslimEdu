import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { useAuth } from '../context/AuthContext';
import { COLORS, RADIUS, SHADOW } from '../theme/glass';

// Mirrors MainTabs.tsx's TabBar (same icons/labels/order) so screens pushed on
// the root stack still give one-tap access back to the app's main sections.
// The active tab is rendered as a solid black pill with a white icon + label;
// every other tab stays transparent.

const INACTIVE = '#6B7280';
const ACTIVE_PILL = COLORS.ink; // near-black
const ACTIVE_FG = '#FFFFFF';

function HomeIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M3 11l9-7 9 7v8a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" stroke={color} strokeWidth={1.9} strokeLinejoin="round" />
    </Svg>
  );
}
function AdmissionIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle cx={9} cy={8} r={3.2} stroke={color} strokeWidth={1.9} />
      <Path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
      <Path d="M18 8v6M15 11h6" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
    </Svg>
  );
}
function ReportsIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M6 20V11M12 20V4M18 20v-7" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}
function ChatIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M4 5h16a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 20 17H9l-4.5 3.5V6.5A1.5 1.5 0 0 1 6 5z" stroke={color} strokeWidth={1.9} strokeLinejoin="round" />
    </Svg>
  );
}
function MenuIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
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
  const activeName = useActiveTabName();
  const isAdminRole = user?.role === 'admin' || user?.role === 'superadmin';

  const tabs = ['Home', ...(isAdminRole ? ['Admission'] : []), 'Reports', 'Chat', 'Menu'];

  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom > 0 ? insets.bottom : 8, 8) }]}>
      {tabs.map((name) => {
        const isActive = activeName === name;
        const fg = isActive ? ACTIVE_FG : INACTIVE;
        return (
          <TouchableOpacity
            key={name}
            style={styles.tabItem}
            activeOpacity={0.8}
            onPress={() => (navigation as any).navigate('MainTabs', { screen: name })}
          >
            <View style={[styles.pill, isActive && styles.pillActive]}>
              {ICONS[name](fg)}
              {isActive && <Text style={styles.pillLabel}>{name}</Text>}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    marginHorizontal: 14,
    borderRadius: RADIUS.xl,
    paddingTop: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.level3,
  },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: RADIUS.pill,
  },
  pillActive: { backgroundColor: ACTIVE_PILL },
  pillLabel: { color: ACTIVE_FG, fontSize: 13, fontWeight: '700', marginLeft: 8 },
});
