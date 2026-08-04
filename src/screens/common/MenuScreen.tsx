import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { getDashboardForRole } from '../../navigation/roleScreens';
import { GlassButton } from '../../components/glass/GlassKit';
import AccessibilityCard from '../../components/AccessibilityCard';
import { RADIUS } from '../../theme/glass';

/**
 * Menu tab = the role dashboard itself (Manage/Reports cards etc, whatever
 * getDashboardForRole renders for this user's role) PLUS the accessibility
 * card and log out button appended at the very bottom of that same scroll
 * view - adding the card here puts it on every role's Menu tab for free.
 *
 * There is no separate "Dashboard" page to tap into anymore - everything
 * lives on this one screen. The profile card (avatar/name/email/role) has
 * been removed - log out is styled to match the rest of the app's cards
 * (rounded-rect, RADIUS.lg) instead of a pill button.
 */
export default function MenuScreen() {
  const { user, logout } = useAuth();
  const { t } = useLocale();

  if (!user) return null;

  const footer = (
    <View style={styles.footerWrap}>
      <AccessibilityCard />
      <GlassButton
        label={t('menu.log_out', 'Log Out')}
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
  logoutButton: { marginTop: 16 },
});
