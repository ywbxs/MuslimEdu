import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { House, MessageSquare, Bell, LayoutGrid, Plus, ScanLine, User } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import PressableScale from './PressableScale';

// Mirrors MainTabs.tsx's TabBar (same icons/order/colors/flat single-level
// layout) so screens pushed on the root stack still give one-tap access
// back to the app's main sections, and look like the same nav bar.
//
// Flat, single-level bar - every icon (including the center action) sits
// on the same row, same height, no raised/notched center button. The
// earlier raised-FAB-in-a-notch treatment was a Material "speed dial"
// pattern, not how Apple's own tab bars work: Apple's tab items (including
// a distinct circular action item, e.g. a capture/create button) all live
// in the same bar, at the same level - visually distinct via shape/fill,
// never elevated out of the bar itself.

const INACTIVE = '#6B8C88';
const ACTIVE = '#0D1E1C';
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

// Icons from lucide-react-native (already a react-native-svg peer, already
// installed) instead of hand-rolled SVG paths - one maintained, consistent
// icon family instead of one-off drawn glyphs per icon.
const ICONS: Record<string, (color: string) => React.ReactElement> = {
  Home: (c) => <House color={c} size={24} strokeWidth={2} />,
  // Admin center action (orphan-type and regular school type alike) - a
  // plain plus, not a person-related glyph, per the request that the admin
  // center icon simply read as "add/admission".
  Admission: (c) => <Plus color={c} size={22} strokeWidth={2.3} />,
  Scan: (c) => <ScanLine color={c} size={20} strokeWidth={2} />,
  // Student center action - opens their status report (classes,
  // attendance, grades - see MyProgressScreen/StudentProgressScreen.tsx).
  MyProgress: (c) => <User color={c} size={20} strokeWidth={2} />,
  Chat: (c) => <MessageSquare color={c} size={24} strokeWidth={2} />,
  Alerts: (c) => <Bell color={c} size={24} strokeWidth={2} />,
  Menu: (c) => <LayoutGrid color={c} size={24} strokeWidth={2} />,
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
  // Bar height covers the icon row PLUS the safe-area gutter below it, so
  // the (transparent) bar's touch/layout area reaches the true screen edge.
  const totalBarHeight = BAR_HEIGHT + bottomInset;
  const isAdminRole = user?.role === 'admin' || user?.role === 'superadmin';
  const isTeacherRole = user?.role === 'teacher';
  const isStudentRole = user?.role === 'student';

  // Same mapping as MainTabs.tsx's TabBar: Admission for both admin school
  // types, Scan for teachers, MyProgress (their status report) for
  // students - always exactly one, capping this bar at 5 total icons for
  // every role. Sits inline in the middle of the row now, not raised.
  const centerName = isAdminRole ? 'Admission' : isTeacherRole ? 'Scan' : isStudentRole ? 'MyProgress' : null;

  // Center item only inserted when this role actually has one - roles
  // without it (registrar, cashier, superadmin, alumni) get a plain
  // evenly-spaced 4-icon bar instead of a gap where the button would be.
  const tabs = centerName ? ['Home', 'Chat', centerName, 'Alerts', 'Menu'] : ['Home', 'Chat', 'Alerts', 'Menu'];

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
    <View
      style={[
        styles.tabBar,
        { width: windowWidth, height: totalBarHeight, paddingBottom: bottomInset, backgroundColor: BAR_BG },
      ]}
    >
      {tabs.map((name) => {
        const isCenter = name === centerName;
        const isActive = activeName === name;
        const color = isCenter ? '#FFFFFF' : isActive ? ACTIVE : INACTIVE;
        return (
          <PressableScale
            key={name}
            style={styles.tabItem}
            scaleTo={isCenter ? 0.9 : 0.88}
            onPress={() => goTo(name)}
            accessibilityRole="button"
            accessibilityLabel={name}
          >
            <View style={[styles.iconWrap, isCenter && styles.centerIconWrap]}>
              {ICONS[name](color)}
              {name === 'Alerts' && unreadCount > 0 && (
                <View style={styles.badge} pointerEvents="none">
                  <Text style={styles.badgeText} numberOfLines={1}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </View>
          </PressableScale>
        );
      })}
    </View>
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
  iconWrap: { alignItems: 'center', justifyContent: 'center' },
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
  badgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
});
