import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Rect, Path, Line, Circle } from 'react-native-svg';
import { useLocale } from '../../context/LocaleContext';
import DashboardShell, { EMERALD, EMERALD_SOFT, INK, SUBTLE } from './DashboardShell';

// --- Inline icons (matches the app's existing inline-SVG style) ---
function DocumentIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M6 3h8l4 4v14H6z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M14 3v4h4" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Line x1={9} y1={13} x2={15} y2={13} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={9} y1={16} x2={13} y2={16} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function CashIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={6} width={18} height={12} rx={2} stroke={color} strokeWidth={2} />
      <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={2} />
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
function ArrowRightIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Line x1={4} y1={12} x2={20} y2={12} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M14 6l6 6-6 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CashierCard({
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

interface CashierDashboardProps {
  footer?: React.ReactNode;
}

/**
 * Cashier (accountant, role_id 4) dashboard - scoped to fees only, nothing
 * else. Built on the shared DashboardShell (greeting/avatar/role badge +
 * footer slot) instead of copying TeacherDashboard's custom animated hero -
 * this role has no monthly-report concept or stats to justify that extra
 * complexity, and DashboardShell already renders `footer` correctly.
 */
export default function CashierDashboard({ footer }: CashierDashboardProps = {}) {
  const navigation = useNavigation();
  const { t } = useLocale();

  return (
    <DashboardShell title={t('cashier_dashboard.role_label', 'Cashier')} footer={footer}>
      <Text style={styles.sectionLabel}>{t('cashier_dashboard.section_label', 'Fees')}</Text>
      <View style={styles.grid}>
        <CashierCard
          icon={<DocumentIcon color={EMERALD} />}
          title={t('cashier_dashboard.fee_reports_title', 'Fee Reports')}
          desc={t('cashier_dashboard.fee_reports_desc', 'Search invoices and collection status')}
          onPress={() => (navigation as any).navigate('AdminFeeReports')}
        />
        <CashierCard
          icon={<CashIcon color={EMERALD} />}
          title={t('cashier_dashboard.record_payment_title', 'Record Payment')}
          desc={t('cashier_dashboard.record_payment_desc', 'Collect a payment against an invoice')}
          onPress={() => (navigation as any).navigate('AdminFeeReports', { initialStatusFilter: 'unpaid' })}
        />
        <CashierCard
          icon={<ClipboardIcon color={EMERALD} />}
          title={t('cashier_dashboard.enrollment_title', 'Enrollment Approvals')}
          desc={t('cashier_dashboard.enrollment_desc', "View and advance students at a stage assigned to you")}
          onPress={() => (navigation as any).navigate('EnrollmentWorkflowList')}
        />
        <CashierCard
          icon={<BellIcon color={EMERALD} />}
          title={t('cashier_dashboard.notifications_title', 'Notifications')}
          desc={t('cashier_dashboard.notifications_desc', 'Stay updated with important alerts')}
          onPress={() => (navigation as any).navigate('Notifications')}
        />
        <CashierCard
          icon={<IdCardIcon color={EMERALD} />}
          title={t('cashier_dashboard.security_title', 'Security')}
          desc={t('cashier_dashboard.security_desc', 'Two-factor authentication and device sessions')}
          onPress={() => (navigation as any).navigate('SecuritySettings')}
        />
        <CashierCard
          icon={<GearIcon color={EMERALD} />}
          title={t('cashier_dashboard.settings_title', 'Settings')}
          desc={t('cashier_dashboard.settings_desc', 'Language, theme, privacy and password')}
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
