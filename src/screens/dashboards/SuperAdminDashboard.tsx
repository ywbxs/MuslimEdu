import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Activity, ArrowRight, BellRing, ClipboardCheck, CreditCard, Flag, Images, Inbox, KeyRound, RotateCcwClock, School, Trash2 } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import DashboardShell, { EMERALD, EMERALD_SOFT, INK, SUBTLE } from './DashboardShell';
import { fetchDashboardOverview, DashboardOverview } from '../../services/superAdminService';

// --- Inline icons (matches the app's existing inline-SVG style) ---
function SchoolIcon({ color }: { color: string }) {
  return <School size={22} color={color} strokeWidth={2} />;
}
function KeyIcon({ color }: { color: string }) {
  return <KeyRound size={22} color={color} strokeWidth={2} />;
}
function PulseIcon({ color }: { color: string }) {
  return <Activity size={22} color={color} strokeWidth={2} />;
}
function FlagIcon({ color }: { color: string }) {
  return <Flag size={22} color={color} strokeWidth={2} />;
}
function ClockHistoryIcon({ color }: { color: string }) {
  return <RotateCcwClock size={22} color={color} strokeWidth={2} />;
}
function TrashCanIcon({ color }: { color: string }) {
  return <Trash2 size={22} color={color} strokeWidth={2} />;
}
function ArrowRightIcon({ color }: { color: string }) {
  return <ArrowRight size={16} color={color} strokeWidth={2} />;
}
function ImageStackIcon({ color }: { color: string }) {
  return <Images size={22} color={color} strokeWidth={2} />;
}
function ClipboardCheckIcon({ color }: { color: string }) {
  return <ClipboardCheck size={22} color={color} strokeWidth={2} />;
}

function BellCogIcon({ color }: { color: string }) {
  return <BellRing size={22} color={color} strokeWidth={2} />;
}
function CreditCardIcon({ color }: { color: string }) {
  return <CreditCard size={22} color={color} strokeWidth={2} />;
}
function InboxIcon({ color }: { color: string }) {
  return <Inbox size={22} color={color} strokeWidth={2} />;
}

function SuperAdminCard({
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

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

interface SuperAdminDashboardProps {
  footer?: React.ReactNode;
}

/**
 * Superadmin (role_id 1) dashboard - platform-wide tools, not scoped to any
 * one school. Built on the shared DashboardShell like CashierDashboard,
 * plus a summary stat row pulled from /superadmin_dashboard_overview.
 */
export default function SuperAdminDashboard({ footer }: SuperAdminDashboardProps = {}) {
  const navigation = useNavigation();
  const { token } = useAuth();
  const { t } = useLocale();
  const [overview, setOverview] = useState<DashboardOverview | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await fetchDashboardOverview(token);
      setOverview(data);
    } catch {
      // Summary row is a nice-to-have - the tile grid below still works
      // even if this call fails, so there's no error banner here.
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <DashboardShell title={t('superadmin_dashboard.role_label', 'Super Admin')} footer={footer}>
      {overview ? (
        <View style={styles.statsRow}>
          <StatBox label={t('superadmin_dashboard.schools', 'Schools')} value={overview.schools.total} />
          <StatBox
            label={t('superadmin_dashboard.users', 'Users')}
            value={Object.values(overview.users_by_role).reduce((a, b) => a + b, 0)}
          />
          <StatBox label={t('superadmin_dashboard.posts', 'Posts')} value={overview.posts.total} />
          <StatBox label={t('superadmin_dashboard.api_keys', 'Active Keys')} value={overview.api_keys_active} />
        </View>
      ) : null}

      <Text style={styles.sectionLabel}>{t('superadmin_dashboard.section_label', 'Platform')}</Text>
      <View style={styles.grid}>
        <SuperAdminCard
          icon={<SchoolIcon color={EMERALD} />}
          title={t('superadmin_dashboard.schools_title', 'Schools')}
          desc={t('superadmin_dashboard.schools_desc', 'Add, edit, disable schools and manage their admins')}
          onPress={() => (navigation as any).navigate('SuperAdminSchoolList')}
        />
        <SuperAdminCard
          icon={<CreditCardIcon color={EMERALD} />}
          title={t('superadmin_dashboard.subscription_packages_title', 'Subscription Plans')}
          desc={t('superadmin_dashboard.subscription_packages_desc', 'Manage plans, pricing, and per-school fee status')}
          onPress={() => (navigation as any).navigate('SuperAdminSubscriptionPackages')}
        />
        <SuperAdminCard
          icon={<InboxIcon color={EMERALD} />}
          title={t('superadmin_dashboard.subscription_requests_title', 'Subscription Requests')}
          desc={t('superadmin_dashboard.subscription_requests_desc', 'Review and approve schools that self-served a plan')}
          onPress={() => (navigation as any).navigate('SuperAdminSubscriptionRequests')}
        />
        <SuperAdminCard
          icon={<KeyIcon color={EMERALD} />}
          title={t('superadmin_dashboard.api_locker_title', 'API Locker')}
          desc={t('superadmin_dashboard.api_locker_desc', 'Issue and revoke 3rd-party API keys')}
          onPress={() => (navigation as any).navigate('SuperAdminApiLocker')}
        />
        <SuperAdminCard
          icon={<PulseIcon color={EMERALD} />}
          title={t('superadmin_dashboard.backend_status_title', 'Backend Status')}
          desc={t('superadmin_dashboard.backend_status_desc', 'Database, cache, queue and disk health')}
          onPress={() => (navigation as any).navigate('SuperAdminBackendStatus')}
        />
        <SuperAdminCard
          icon={<FlagIcon color={EMERALD} />}
          title={t('superadmin_dashboard.post_moderation_title', 'Post Moderation')}
          desc={t('superadmin_dashboard.post_moderation_desc', 'Review and remove posts/comments, any school')}
          onPress={() => (navigation as any).navigate('SuperAdminPostModeration')}
        />
        <SuperAdminCard
          icon={<ClockHistoryIcon color={EMERALD} />}
          title={t('superadmin_dashboard.activity_log_title', 'Activity Log')}
          desc={t('superadmin_dashboard.activity_log_desc', 'What every school and admin has changed')}
          onPress={() => (navigation as any).navigate('SuperAdminActivityLog')}
        />
        <SuperAdminCard
          icon={<TrashCanIcon color={EMERALD} />}
          title={
            overview && overview.trash.schools + overview.trash.admins > 0
              ? `${t('superadmin_dashboard.trash_title', 'Trash')} (${overview.trash.schools + overview.trash.admins})`
              : t('superadmin_dashboard.trash_title', 'Trash')
          }
          desc={t('superadmin_dashboard.trash_desc', 'Deleted schools/admins - restore or purge within 30 days')}
          onPress={() => (navigation as any).navigate('SuperAdminTrash')}
        />
        <SuperAdminCard
          icon={<ImageStackIcon color={EMERALD} />}
          title={t('superadmin_dashboard.announcements_title', 'Feed Widget Announcements')}
          desc={t('superadmin_dashboard.announcements_desc', 'Upload image cards shown to every role in the Home feed')}
          onPress={() => (navigation as any).navigate('SuperAdminAnnouncementUpload')}
        />
        <SuperAdminCard
          icon={<ClipboardCheckIcon color={EMERALD} />}
          title={t('superadmin_dashboard.pending_registrations_title', 'Pending Registrations')}
          desc={t('superadmin_dashboard.pending_registrations_desc', 'Review and approve self-service school signups')}
          onPress={() => (navigation as any).navigate('SuperAdminPendingRegistrations')}
        />
        <SuperAdminCard
          icon={<BellCogIcon color={EMERALD} />}
          title={t('superadmin_dashboard.firebase_config_title', 'Firebase Configuration')}
          desc={t('superadmin_dashboard.firebase_config_desc', 'Set up real-time push notification credentials')}
          onPress={() => (navigation as any).navigate('SuperAdminFirebaseConfig')}
        />
      </View>
    </DashboardShell>
  );
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statBox: {
    flex: 1,
    backgroundColor: EMERALD_SOFT,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statValue: { fontSize: 18, fontWeight: '800', color: EMERALD },
  statLabel: { fontSize: 10.5, color: INK, marginTop: 2, textAlign: 'center' },

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
