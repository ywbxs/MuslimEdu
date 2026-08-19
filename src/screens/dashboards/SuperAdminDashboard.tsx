import React, { useCallback, useState } from 'react';
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
function ArrowRightIcon({ color, size = 16 }: { color: string; size?: number }) {
  return <ArrowRight size={size} color={color} strokeWidth={2} />;
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

interface PlatformItem {
  key: string;
  title: string;
  desc: string;
  icon: (color: string) => React.ReactElement;
  onPress: () => void;
  group: 'platform' | 'moderation';
}

/**
 * Superadmin (role_id 1) dashboard - platform-wide tools, not scoped to any
 * one school. Same content pattern as AdminDashboard now: a summary stat
 * row, then a hero + secondary bento for the two actions that most need a
 * superadmin's attention day-to-day (subscription + registration reviews),
 * then everything else in Settings-style grouped lists instead of a flat
 * wall of 11 equal-size cards.
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
      // Summary row is a nice-to-have - the tile list below still works
      // even if this call fails, so there's no error banner here.
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const trashCount = overview ? overview.trash.schools + overview.trash.admins : 0;

  const hero: PlatformItem = {
    key: 'schools',
    title: t('superadmin_dashboard.schools_title', 'Schools'),
    desc: t('superadmin_dashboard.schools_desc', 'Add, edit, disable schools and manage their admins'),
    icon: (c) => <SchoolIcon color={c} />,
    onPress: () => (navigation as any).navigate('SuperAdminSchoolList'),
    group: 'platform',
  };

  const secondary: PlatformItem[] = [
    {
      key: 'subscriptionRequests',
      title: t('superadmin_dashboard.subscription_requests_title', 'Subscription Requests'),
      desc: t('superadmin_dashboard.subscription_requests_desc', 'Review and approve schools that self-served a plan'),
      icon: (c) => <InboxIcon color={c} />,
      onPress: () => (navigation as any).navigate('SuperAdminSubscriptionRequests'),
      group: 'platform',
    },
    {
      key: 'pendingRegistrations',
      title: t('superadmin_dashboard.pending_registrations_title', 'Pending Registrations'),
      desc: t('superadmin_dashboard.pending_registrations_desc', 'Review and approve self-service school signups'),
      icon: (c) => <ClipboardCheckIcon color={c} />,
      onPress: () => (navigation as any).navigate('SuperAdminPendingRegistrations'),
      group: 'platform',
    },
  ];

  const groupedItems: PlatformItem[] = [
    {
      key: 'subscriptionPackages',
      title: t('superadmin_dashboard.subscription_packages_title', 'Subscription Plans'),
      desc: t('superadmin_dashboard.subscription_packages_desc', 'Manage plans, pricing, and per-school fee status'),
      icon: (c) => <CreditCardIcon color={c} />,
      onPress: () => (navigation as any).navigate('SuperAdminSubscriptionPackages'),
      group: 'platform',
    },
    {
      key: 'apiLocker',
      title: t('superadmin_dashboard.api_locker_title', 'API Locker'),
      desc: t('superadmin_dashboard.api_locker_desc', 'Issue and revoke 3rd-party API keys'),
      icon: (c) => <KeyIcon color={c} />,
      onPress: () => (navigation as any).navigate('SuperAdminApiLocker'),
      group: 'platform',
    },
    {
      key: 'backendStatus',
      title: t('superadmin_dashboard.backend_status_title', 'Backend Status'),
      desc: t('superadmin_dashboard.backend_status_desc', 'Database, cache, queue and disk health'),
      icon: (c) => <PulseIcon color={c} />,
      onPress: () => (navigation as any).navigate('SuperAdminBackendStatus'),
      group: 'platform',
    },
    {
      key: 'firebaseConfig',
      title: t('superadmin_dashboard.firebase_config_title', 'Firebase Configuration'),
      desc: t('superadmin_dashboard.firebase_config_desc', 'Set up real-time push notification credentials'),
      icon: (c) => <BellCogIcon color={c} />,
      onPress: () => (navigation as any).navigate('SuperAdminFirebaseConfig'),
      group: 'platform',
    },
    {
      key: 'postModeration',
      title: t('superadmin_dashboard.post_moderation_title', 'Post Moderation'),
      desc: t('superadmin_dashboard.post_moderation_desc', 'Review and remove posts/comments, any school'),
      icon: (c) => <FlagIcon color={c} />,
      onPress: () => (navigation as any).navigate('SuperAdminPostModeration'),
      group: 'moderation',
    },
    {
      key: 'activityLog',
      title: t('superadmin_dashboard.activity_log_title', 'Activity Log'),
      desc: t('superadmin_dashboard.activity_log_desc', 'What every school and admin has changed'),
      icon: (c) => <ClockHistoryIcon color={c} />,
      onPress: () => (navigation as any).navigate('SuperAdminActivityLog'),
      group: 'moderation',
    },
    {
      key: 'trash',
      title:
        trashCount > 0
          ? `${t('superadmin_dashboard.trash_title', 'Trash')} (${trashCount})`
          : t('superadmin_dashboard.trash_title', 'Trash'),
      desc: t('superadmin_dashboard.trash_desc', 'Deleted schools/admins - restore or purge within 30 days'),
      icon: (c) => <TrashCanIcon color={c} />,
      onPress: () => (navigation as any).navigate('SuperAdminTrash'),
      group: 'moderation',
    },
    {
      key: 'announcements',
      title: t('superadmin_dashboard.announcements_title', 'Feed Widget Announcements'),
      desc: t('superadmin_dashboard.announcements_desc', 'Upload image cards shown to every role in the Home feed'),
      icon: (c) => <ImageStackIcon color={c} />,
      onPress: () => (navigation as any).navigate('SuperAdminAnnouncementUpload'),
      group: 'moderation',
    },
  ];

  const platformGroup = groupedItems.filter((i) => i.group === 'platform');
  const moderationGroup = groupedItems.filter((i) => i.group === 'moderation');

  const renderGroup = (label: string, groupItems: PlatformItem[]) => (
    <View key={label} style={styles.groupSection}>
      <Text style={styles.groupLabel}>{label}</Text>
      <View style={styles.groupCard}>
        {groupItems.map((item, idx) => (
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

      <TouchableOpacity activeOpacity={0.92} style={styles.heroCard} onPress={hero.onPress}>
        <View style={styles.heroIcon}>{hero.icon('#FFFFFF')}</View>
        <Text style={styles.heroTitle}>{hero.title}</Text>
        <Text style={styles.heroDesc}>{hero.desc}</Text>
        <View style={styles.heroArrow}>
          <ArrowRightIcon color="#FFFFFF" size={17} />
        </View>
      </TouchableOpacity>

      <View style={styles.secondaryRow}>
        {secondary.map((item) => (
          <TouchableOpacity key={item.key} activeOpacity={0.88} style={styles.secondaryCard} onPress={item.onPress}>
            <View style={styles.secondaryIcon}>{item.icon(EMERALD)}</View>
            <Text style={styles.secondaryTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.secondaryDesc} numberOfLines={2}>{item.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {renderGroup(t('superadmin_dashboard.group_platform', 'Platform Tools'), platformGroup)}
      {renderGroup(t('superadmin_dashboard.group_moderation', 'Moderation & Trash'), moderationGroup)}
    </DashboardShell>
  );
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statBox: { flex: 1, backgroundColor: EMERALD_SOFT, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800', color: EMERALD },
  statLabel: { fontSize: 10.5, color: INK, marginTop: 2, textAlign: 'center' },

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
