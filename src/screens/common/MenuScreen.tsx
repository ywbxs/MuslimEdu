import React from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import Svg, { Path, Polyline, Line } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { getDashboardForRole } from '../../navigation/roleScreens';
import { COLORS, RADIUS, SHADOW } from '../../theme/glass';

const DANGER = COLORS.danger;
const DANGER_SOFT = 'rgba(239,68,68,0.12)';
const SUBTLE = COLORS.subtle;

function LogOutIcon({ color = DANGER, size = 20 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Polyline points="16 17 21 12 16 7" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1={21} y1={12} x2={9} y2={12} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function ChevronIcon({ color = SUBTLE, size = 18 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 6l6 6-6 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/**
 * Menu tab = the role dashboard itself (Manage/Reports cards etc, whatever
 * getDashboardForRole renders for this user's role) PLUS the log out card
 * appended at the very bottom of that same scroll view - so this one
 * component is every role's log out entry point.
 *
 * There is no separate "Dashboard" page to tap into anymore - everything
 * lives on this one screen. The profile card (avatar/name/email/role) has
 * been removed. Log out is a bordered card row (icon badge + title/subtitle)
 * matching the rest of the app's list-row styling, with a confirmation
 * prompt before it actually signs out - a destructive action shouldn't
 * fire on a single mis-tap. Accessibility (display size) now lives in
 * Account Settings rather than as a card directly on this screen - each
 * dashboard's own Settings tile already reaches it.
 */
export default function MenuScreen() {
  const { user, logout } = useAuth();
  const { t } = useLocale();

  if (!user) return null;

  const confirmLogout = () => {
    Alert.alert(
      t('menu.log_out_confirm_title', 'Log out?'),
      t('menu.log_out_confirm_message', "You'll need to sign in again to continue."),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        { text: t('menu.log_out', 'Log Out'), style: 'destructive', onPress: logout },
      ],
    );
  };

  const footer = (
    <View style={styles.footerWrap}>
      <TouchableOpacity style={styles.logoutCard} activeOpacity={0.7} onPress={confirmLogout}>
        <View style={styles.logoutIconBadge}>
          <LogOutIcon />
        </View>
        <View style={styles.logoutTextWrap}>
          <Text style={styles.logoutTitle}>{t('menu.log_out', 'Log Out')}</Text>
          <Text style={styles.logoutSubtitle}>{t('menu.log_out_subtitle', 'Sign out of your account')}</Text>
        </View>
        <ChevronIcon />
      </TouchableOpacity>
    </View>
  );

  return getDashboardForRole(user.role, footer);
}

const styles = StyleSheet.create({
  footerWrap: { marginTop: 8 },
  logoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
    ...SHADOW.level1,
  },
  logoutIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: DANGER_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutTextWrap: { flex: 1 },
  logoutTitle: { fontSize: 15, fontWeight: '700', color: DANGER },
  logoutSubtitle: { fontSize: 12.5, color: SUBTLE, marginTop: 2 },
});
