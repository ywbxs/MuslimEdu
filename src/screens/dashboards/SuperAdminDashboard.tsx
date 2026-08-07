import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Svg, { Rect, Path, Line, Circle } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import DashboardShell, { EMERALD, EMERALD_SOFT, INK, SUBTLE } from './DashboardShell';
import { fetchDashboardOverview, DashboardOverview } from '../../services/superAdminService';

// --- Inline icons (matches the app's existing inline-SVG style) ---
function SchoolIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M3 9.5L12 4l9 5.5-9 5.5-9-5.5z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M7 12v5c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function KeyIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle cx={8} cy={15} r={4} stroke={color} strokeWidth={2} />
      <Path d="M11 12l8-8M16 5l3 3M13 8l2 2" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function PulseIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M3 12h4l2-7 4 14 2-7h6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function FlagIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M5 21V4" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M5 4h13l-3 4 3 4H5" stroke={color} strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  );
}
function ClockHistoryIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={13} r={8} stroke={color} strokeWidth={2} />
      <Path d="M12 9v4l3 2" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 4v4h4" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function TrashCanIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0v13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V7" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
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
function ImageStackIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={7} width={15} height={13} rx={2} stroke={color} strokeWidth={2} />
      <Path d="M7 3h13a1 1 0 0 1 1 1v13" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={9} cy={12} r={1.4} fill={color} />
      <Path d="M5 18l3.5-4 3 3 2-2.5L18 18" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
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
