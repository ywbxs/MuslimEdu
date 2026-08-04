import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path, Line } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import CurrencyBalanceButton from '../../components/CurrencyBalanceButton';

const EMERALD = '#0F9D58';
const EMERALD_SOFT = '#EAF7EF';
const INK = '#1C1C1E';
const SUBTLE = '#8E8E93';

// --- Glass theme switch --------------------------------------------------
// Frosted/translucent "glass" panels (semi-transparent white over a dark
// hero) used to be the look for cards like the Profile panel on the Student
// dashboard. Flip GLASS_ENABLED back to true to restore that look; every
// screen that imports these from here (instead of hardcoding its own rgba
// values) follows this one switch. When off, panels fall back to a solid
// opaque dark-green card instead of the frosted effect.
export const GLASS_ENABLED = false;
export const GLASS_BG = GLASS_ENABLED ? 'rgba(255,255,255,0.07)' : '#0E2A1E';
export const GLASS_BORDER = GLASS_ENABLED ? 'rgba(255,255,255,0.14)' : '#1B3B2C';
export const GLASS_DIVIDER = GLASS_ENABLED ? 'rgba(255,255,255,0.12)' : '#1B3B2C';
export const GLASS_ICON_BG = GLASS_ENABLED ? 'rgba(255,255,255,0.08)' : '#173225';

function PencilIcon({ color = '#FFFFFF', size = 12 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 20h4L18 10l-4-4L4 16v4z" stroke={color} strokeWidth={2.4} strokeLinejoin="round" />
      <Line x1={13} y1={7} x2={17} y2={11} stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

interface DashboardShellProps {
  title: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * Shared wrapper for every role's dashboard: greeting + name, profile photo
 * (synced from the backend's user record, falling back to initials if
 * missing OR if the image URL fails to actually load), a role badge, and
 * whatever content that role's screen provides below it.
 *
 * Logout now lives in the Menu tab, not here - tapping the avatar jumps
 * there instead.
 */
export default function DashboardShell({ title, children, footer }: DashboardShellProps) {
  const { user } = useAuth();
  const navigation = useNavigation();
  const { t } = useLocale();
  const [photoFailed, setPhotoFailed] = useState(false);

  const initial = user?.name?.trim()?.[0]?.toUpperCase() ?? '?';
  const showPhoto = !!user?.photo && !photoFailed;

  return (
    <View style={styles.flex}>
      <View style={styles.balanceRow}>
        <CurrencyBalanceButton />
      </View>
      <View style={styles.header}>
        <View>
          <Text style={styles.greetingSmall}>{t('dashboard_shell.greeting', 'Assalamu Alaykum,')}</Text>
          <Text style={styles.greetingName}>{user?.name}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{title}</Text>
          </View>
        </View>

        <TouchableOpacity onPress={() => (navigation as any).navigate('Menu')} hitSlop={10}>
          {showPhoto ? (
            <Image
              source={{ uri: user!.photo! }}
              style={styles.avatar}
              onError={() => setPhotoFailed(true)}
            />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarFallbackText}>{initial}</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.avatarEditBadge}
            onPress={() => (navigation as any).navigate('EditProfile')}
            hitSlop={8}
          >
            <PencilIcon color={EMERALD} size={11} />
          </TouchableOpacity>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {children}
        {footer}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#FFFFFF' },
  balanceRow: { paddingHorizontal: 20, paddingTop: 56, alignItems: 'flex-end' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 20,
  },
  greetingSmall: { fontSize: 14, color: SUBTLE },
  greetingName: { fontSize: 22, fontWeight: '700', color: INK, marginTop: 2 },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: EMERALD_SOFT,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
  },
  roleBadgeText: { fontSize: 11, fontWeight: '700', color: EMERALD, textTransform: 'uppercase', letterSpacing: 0.5 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#F2F2F7' },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: EMERALD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  avatarEditBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { paddingHorizontal: 20, paddingBottom: 110, flexGrow: 1 },
});

export { EMERALD, EMERALD_SOFT, INK, SUBTLE };
