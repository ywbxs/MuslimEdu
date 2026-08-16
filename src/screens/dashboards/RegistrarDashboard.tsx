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
function ArrowRightIcon({ color }: { color: string }) {
  return <ArrowRight size={16} color={color} strokeWidth={2} />;
}

function RegistrarCard({
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

interface RegistrarDashboardProps {
  footer?: React.ReactNode;
}

/**
 * Registrar (role_id 12) dashboard - scoped to the enrollment pipeline plus
 * the teacher timetable. Built on the shared DashboardShell, same pattern
 * as CashierDashboard: no monthly-report concept or stats to justify a
 * custom hero.
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

  return (
    <DashboardShell title={t('registrar_dashboard.role_label', 'Registrar')} footer={footer}>
      <Text style={styles.sectionLabel}>{t('registrar_dashboard.section_label', 'Enrollment')}</Text>
      <View style={styles.grid}>
        <RegistrarCard
          icon={<ClipboardIcon color={EMERALD} />}
          title={t('registrar_dashboard.pipeline_title', 'Enrollment Pipeline')}
          desc={t('registrar_dashboard.pipeline_desc', 'View students and advance them to the next stage')}
          onPress={() => (navigation as any).navigate('EnrollmentWorkflowList')}
        />
        {can(user, 'manage_teacher_schedule') ? (
          <RegistrarCard
            icon={<CalendarIcon color={EMERALD} />}
            title={t('registrar_dashboard.schedule_title', 'Class Schedule')}
            desc={t('registrar_dashboard.schedule_desc', "Build each teacher's weekly timetable")}
            onPress={() => (navigation as any).navigate('AdminSchedule')}
          />
        ) : null}
        <RegistrarCard
          icon={<BellIcon color={EMERALD} />}
          title={t('registrar_dashboard.notifications_title', 'Notifications')}
          desc={t('registrar_dashboard.notifications_desc', 'Stay updated with important alerts')}
          onPress={() => (navigation as any).navigate('Notifications')}
        />
        <RegistrarCard
          icon={<IdCardIcon color={EMERALD} />}
          title={t('registrar_dashboard.security_title', 'Security')}
          desc={t('registrar_dashboard.security_desc', 'Two-factor authentication and device sessions')}
          onPress={() => (navigation as any).navigate('SecuritySettings')}
        />
        <RegistrarCard
          icon={<GearIcon color={EMERALD} />}
          title={t('registrar_dashboard.settings_title', 'Settings')}
          desc={t('registrar_dashboard.settings_desc', 'Language, theme, privacy and password')}
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
