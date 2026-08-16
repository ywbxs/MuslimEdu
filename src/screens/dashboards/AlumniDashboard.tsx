import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowRight, Bell, GraduationCap, IdCard, Settings } from 'lucide-react-native';
import { useLocale } from '../../context/LocaleContext';
import DashboardShell, { EMERALD, EMERALD_SOFT, INK, SUBTLE } from './DashboardShell';

// --- Inline icons (matches the app's existing inline-SVG style) ---
function CapIcon({ color }: { color: string }) {
  return <GraduationCap size={22} color={color} strokeWidth={2} />;
}
function BellIcon({ color }: { color: string }) {
  return <Bell size={22} color={color} strokeWidth={2} />;
}
function IdCardIcon({ color }: { color: string }) {
  return <IdCard size={22} color={color} strokeWidth={2} />;
}
function GearIcon({ color }: { color: string }) {
  return <Settings size={22} color={color} strokeWidth={2} />;
}
function ArrowRightIcon({ color }: { color: string }) {
  return <ArrowRight size={16} color={color} strokeWidth={2} />;
}

function AlumniCard({
  icon,
  title,
  desc,
  onPress,
}: {
  icon: React.ReactElement;
  title: string;
  desc: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onPress}>
      <View style={styles.cardIcon}>{icon}</View>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardDesc}>{desc}</Text>
      <View style={styles.cardArrow}>
        <ArrowRightIcon color={EMERALD} />
      </View>
    </TouchableOpacity>
  );
}

interface AlumniDashboardProps {
  footer?: React.ReactNode;
}

/**
 * Alumni dashboard - a real staff-shaped account scoped to the school
 * they graduated from (approved via AlumniApplicationsScreen, admin-side),
 * same minimal DashboardShell pattern as CashierDashboard/RegistrarDashboard
 * rather than the PlaceholderDashboard fallback every other unbuilt role
 * gets. No dedicated alumni-only feature exists yet (directory, events,
 * etc.) - this is the same baseline every staff role starts with
 * (profile, notifications, security, settings), ready to grow the same
 * way Cashier/Registrar did once real alumni-specific screens are asked for.
 */
export default function AlumniDashboard({ footer }: AlumniDashboardProps = {}) {
  const navigation = useNavigation();
  const { t } = useLocale();

  return (
    <DashboardShell title={t('alumni_dashboard.role_label', 'Alumni')} footer={footer}>
      <Text style={styles.sectionLabel}>{t('alumni_dashboard.section_label', 'Account')}</Text>
      <View style={styles.grid}>
        <AlumniCard
          icon={<CapIcon color={EMERALD} />}
          title={t('alumni_dashboard.profile_title', 'My Profile')}
          desc={t('alumni_dashboard.profile_desc', 'Update your name, email, address and photo')}
          onPress={() => (navigation as any).navigate('EditProfile')}
        />
        <AlumniCard
          icon={<BellIcon color={EMERALD} />}
          title={t('alumni_dashboard.notifications_title', 'Notifications')}
          desc={t('alumni_dashboard.notifications_desc', 'Stay updated with important alerts')}
          onPress={() => (navigation as any).navigate('Notifications')}
        />
        <AlumniCard
          icon={<IdCardIcon color={EMERALD} />}
          title={t('alumni_dashboard.security_title', 'Security')}
          desc={t('alumni_dashboard.security_desc', 'Two-factor authentication and device sessions')}
          onPress={() => (navigation as any).navigate('SecuritySettings')}
        />
        <AlumniCard
          icon={<GearIcon color={EMERALD} />}
          title={t('alumni_dashboard.settings_title', 'Settings')}
          desc={t('alumni_dashboard.settings_desc', 'Language, theme, privacy and password')}
          onPress={() => (navigation as any).navigate('AccountSettings')}
        />
      </View>
    </DashboardShell>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { fontSize: 13, fontWeight: '700', color: SUBTLE, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  card: {
    width: '47%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EDEEF0',
    shadowColor: '#0B1F13',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardTitle: { fontSize: 14.5, fontWeight: '700', color: INK },
  cardDesc: { fontSize: 12, color: SUBTLE, marginTop: 4, lineHeight: 16 },
  cardArrow: { marginTop: 12 },
});
