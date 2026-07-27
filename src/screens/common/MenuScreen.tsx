import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { getDashboardForRole } from '../../navigation/roleScreens';
import { GlassButton } from '../../components/glass/GlassKit';
import { RADIUS } from '../../theme/glass';

/**
 * Menu tab = the role dashboard itself (Manage/Reports cards etc, whatever
 * getDashboardForRole renders for this user's role) PLUS the log out button
 * appended at the very bottom of that same scroll view.
 *
 * There is no separate "Dashboard" page to tap into anymore - everything
 * lives on this one screen. The profile card (avatar/name/email/role) has
 * been removed - log out is styled to match the rest of the app's cards
 * (rounded-rect, RADIUS.lg) instead of a pill button.
 */
export default function MenuScreen() {
  const { user, logout } = useAuth();

  if (!user) return null;

  const footer = (
    <View style={styles.footerWrap}>
      <GlassButton
        label="Log Out"
        variant="danger"
        onPress={logout}
        radius={RADIUS.lg}
        style={styles.logoutButton}
      />
    </View>
  );

  return getDashboardForRole(user.role, footer);
}

const styles = StyleSheet.create({
  footerWrap: { marginTop: 8 },
  logoutButton: {},
});
