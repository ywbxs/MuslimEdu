import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowRight, Banknote, Bell, ClipboardList, FileText, IdCard, Settings } from 'lucide-react-native';
import { useLocale } from '../../context/LocaleContext';
import DashboardShell, { EMERALD, EMERALD_SOFT, INK, SUBTLE } from './DashboardShell';

// --- Inline icons (matches the app's existing inline-SVG style) ---
function DocumentIcon({ color }: { color: string }) {
  return <FileText size={22} color={color} strokeWidth={2} />;
}
function CashIcon({ color }: { color: string }) {
  return <Banknote size={22} color={color} strokeWidth={2} />;
}
function BellIcon({ color }: { color: string }) {
  return <Bell size={22} color={color} strokeWidth={2} />;
}
function ClipboardIcon({ color }: { color: string }) {
  return <ClipboardList size={22} color={color} strokeWidth={2} />;
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
