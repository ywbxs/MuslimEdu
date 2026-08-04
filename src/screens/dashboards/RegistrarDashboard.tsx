import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Rect, Path, Line, Circle } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { can } from '../../services/permissions';
import DashboardShell, { EMERALD, EMERALD_SOFT, INK, SUBTLE } from './DashboardShell';

// --- Inline icons (matches the app's existing inline-SVG style) ---
function ClipboardIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Rect x={6} y={4} width={12} height={17} rx={2} stroke={color} strokeWidth={2} />
      <Rect x={9} y={2} width={6} height={4} rx={1} stroke={color} strokeWidth={2} />
      <Line x1={9} y1={12} x2={15} y2={12} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={9} y1={16} x2={13} y2={16} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function BellIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M10 19a2 2 0 0 0 4 0" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function IdCardIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={5} width={18} height={14} rx={2} stroke={color} strokeWidth={2} />
      <Circle cx={8.5} cy={11} r={2} stroke={color} strokeWidth={2} />
      <Line x1={13} y1={10} x2={17} y2={10} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={13} y1={14} x2={17} y2={14} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function GearIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={2} />
      <Path
        d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}
function CalendarIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={5} width={16} height={16} rx={2} stroke={color} strokeWidth={2} />
      <Line x1={4} y1={9} x2={20} y2={9} stroke={color} strokeWidth={2} />
      <Line x1={8} y1={3} x2={8} y2={6} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={16} y1={3} x2={16} y2={6} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function ArrowRightIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Line x1={4} y1={12} x2={20} y2={12} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M14 6l6 6-6 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
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
