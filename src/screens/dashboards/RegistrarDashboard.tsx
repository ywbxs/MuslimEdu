import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowRight, Bell, Calendar, ClipboardList, IdCard, Settings } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { can } from '../../services/permissions';
import DashboardShell, { EMERALD, EMERALD_SOFT, INK, SUBTLE } from './DashboardShell';

// --- Inline icons (matches the app's existing inline-SVG style) ---
function ClipboardIcon({ color }: { color: string }) {
  return <ClipboardList size={22} color={color} strokeWidth={2} />;
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
function CalendarIcon({ color }: { color: string }) {
  return <Calendar size={22} color={color} strokeWidth={2} />;
}
function ArrowRightIcon({ color, size = 16 }: { color: string; size?: number }) {
  return <ArrowRight size={size} color={color} strokeWidth={2} />;
}

interface RegistrarDashboardProps {
  footer?: React.ReactNode;
}

interface RegistrarItem {
  key: string;
  title: string;
  desc: string;
  icon: (color: string) => React.ReactElement;
  onPress: () => void;
}

/**
 * Registrar (role_id 12) dashboard - scoped to the enrollment pipeline plus
 * the teacher timetable. Same content pattern as AdminDashboard now: a
 * hero + secondary bento for the two daily actions, everything else in a
 * single Settings-style grouped list.
 *
 * Reuses the existing admin EnrollmentWorkflowList/Detail screens rather
 * than forking them - those screens already hide the admin-only "+ Start"
 * and "Withdraw" actions when the signed-in user lacks the
 * 'manage_enrollment' capability, which Registrar doesn't have. Same for
 * AdminClassScheduleScreen (the "Class Schedule" tile below) - once a
 * student clears enrollment, Registrar builds that section's timetable
 * (day/time/room/teacher), matching AcademicScheduleController's
 * store/update/status/delete guards being admin-or-registrar now.
 */
export default function RegistrarDashboard({ footer }: RegistrarDashboardProps = {}) {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { t } = useLocale();

  const items: RegistrarItem[] = [
    {
      key: 'pipeline',
      title: t('registrar_dashboard.pipeline_title', 'Enrollment Pipeline'),
      desc: t('registrar_dashboard.pipeline_desc', 'View students and advance them to the next stage'),
      icon: (c) => <ClipboardIcon color={c} />,
      onPress: () => (navigation as any).navigate('EnrollmentWorkflowList'),
    },
    ...(can(user, 'manage_teacher_schedule')
      ? [
          {
            key: 'schedule',
            title: t('registrar_dashboard.schedule_title', 'Class Schedule'),
            desc: t('registrar_dashboard.schedule_desc', "Build each teacher's weekly timetable"),
            icon: (c: string) => <CalendarIcon color={c} />,
            onPress: () => (navigation as any).navigate('AdminSchedule'),
          },
        ]
      : []),
    {
      key: 'notifications',
      title: t('registrar_dashboard.notifications_title', 'Notifications'),
      desc: t('registrar_dashboard.notifications_desc', 'Stay updated with important alerts'),
      icon: (c) => <BellIcon color={c} />,
      onPress: () => (navigation as any).navigate('Notifications'),
    },
    {
      key: 'security',
      title: t('registrar_dashboard.security_title', 'Security'),
      desc: t('registrar_dashboard.security_desc', 'Two-factor authentication and device sessions'),
      icon: (c) => <IdCardIcon color={c} />,
      onPress: () => (navigation as any).navigate('SecuritySettings'),
    },
    {
      key: 'settings',
      title: t('registrar_dashboard.settings_title', 'Settings'),
      desc: t('registrar_dashboard.settings_desc', 'Language, theme, privacy and password'),
      icon: (c) => <GearIcon color={c} />,
      onPress: () => (navigation as any).navigate('AccountSettings'),
    },
  ];

  const [hero, ...rest] = items;
  const secondary = rest.slice(0, 2);
  const grouped = rest.slice(2);

  return (
    <DashboardShell title={t('registrar_dashboard.role_label', 'Registrar')} footer={footer}>
      <Text style={styles.sectionLabel}>{t('registrar_dashboard.section_label', 'Enrollment')}</Text>

      <TouchableOpacity activeOpacity={0.92} style={styles.heroCard} onPress={hero.onPress}>
        <View style={styles.heroIcon}>{hero.icon('#FFFFFF')}</View>
        <Text style={styles.heroTitle}>{hero.title}</Text>
        <Text style={styles.heroDesc}>{hero.desc}</Text>
        <View style={styles.heroArrow}>
          <ArrowRightIcon color="#FFFFFF" size={17} />
        </View>
      </TouchableOpacity>

      {secondary.length > 0 ? (
        <View style={styles.secondaryRow}>
          {secondary.map((item) => (
            <TouchableOpacity key={item.key} activeOpacity={0.88} style={styles.secondaryCard} onPress={item.onPress}>
              <View style={styles.secondaryIcon}>{item.icon(EMERALD)}</View>
              <Text style={styles.secondaryTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.secondaryDesc} numberOfLines={2}>{item.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {grouped.length > 0 ? (
        <View style={styles.groupSection}>
          <Text style={styles.groupLabel}>{t('registrar_dashboard.group_account', 'Account')}</Text>
          <View style={styles.groupCard}>
            {grouped.map((item, idx) => (
              <TouchableOpacity
                key={item.key}
                activeOpacity={0.7}
                style={[styles.row, idx > 0 && styles.rowDivider]}
                onPress={item.onPress}
              >
                <View style={styles.rowIconWrap}>{item.icon(EMERALD)}</View>
                <View style={styles.rowTextWrap}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.rowDesc} numberOfLines={1}>{item.desc}</Text>
                </View>
                <ArrowRightIcon color={SUBTLE} size={15} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}
    </DashboardShell>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { fontSize: 13, fontWeight: '700', color: SUBTLE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 },

  heroCard: { backgroundColor: '#0F7A3D', borderRadius: 26, padding: 22, marginBottom: 12 },
  heroIcon: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 18,
  },
  heroTitle: { fontSize: 21, fontWeight: '800', color: '#FFFFFF', marginBottom: 6 },
  heroDesc: { fontSize: 13.5, color: 'rgba(255,255,255,0.88)', lineHeight: 19, paddingRight: 50 },
  heroArrow: {
    position: 'absolute', right: 20, bottom: 20, width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },

  secondaryRow: { flexDirection: 'row', gap: 12, marginBottom: 28 },
  secondaryCard: { flex: 1, backgroundColor: EMERALD_SOFT, borderRadius: 20, padding: 15 },
  secondaryIcon: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(31,174,100,0.14)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  secondaryTitle: { fontSize: 14.5, fontWeight: '700', color: INK, marginBottom: 3 },
  secondaryDesc: { fontSize: 11.5, color: SUBTLE, lineHeight: 15 },

  groupSection: { marginBottom: 22 },
  groupLabel: {
    fontSize: 12, color: SUBTLE, marginBottom: 8, marginLeft: 4,
    textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '700',
  },
  groupCard: { backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(17,24,39,0.06)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  rowDivider: { borderTopWidth: 1, borderTopColor: 'rgba(17,24,39,0.06)' },
  rowIconWrap: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: EMERALD_SOFT,
    alignItems: 'center', justifyContent: 'center',
  },
  rowTextWrap: { flex: 1 },
  rowTitle: { fontSize: 14.5, fontWeight: '600', color: INK },
  rowDesc: { fontSize: 12, color: SUBTLE, marginTop: 1 },
});
