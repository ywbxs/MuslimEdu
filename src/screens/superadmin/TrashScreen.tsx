import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import {
  fetchTrashedSchools,
  restoreSchool,
  purgeSchool,
  fetchTrashedAdmins,
  restoreSchoolAdmin,
  purgeSchoolAdmin,
  TrashedSchool,
  TrashedAdmin,
} from '../../services/superAdminService';
import { Skeleton } from '../../components/Skeleton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHADOW, GLASS, COLORS, RADIUS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';

const EMERALD = COLORS.emerald;
const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const HAIRLINE = COLORS.border;
const GLASS_SURFACE = GLASS.fillOnLight;
const GLASS_BORDER = GLASS.borderOnLight;
const DANGER = COLORS.danger;

function ChevronLeftIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M15 19l-7-7 7-7" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function DaysBadge({ days }: { days: number }) {
  const { t } = useLocale();
  const urgent = days <= 7;
  return (
    <View style={[styles.daysBadge, urgent && styles.daysBadgeUrgent]}>
      <Text style={[styles.daysBadgeText, urgent && styles.daysBadgeTextUrgent]}>
        {t('trash.days_left', '{count}d left').replace('{count}', String(days))}
      </Text>
    </View>
  );
}

function TrashRow({
  title,
  subtitle,
  days,
  onRestore,
  onPurge,
}: {
  title: string;
  subtitle: string;
  days: number;
  onRestore: () => void;
  onPurge: () => void;
}) {
  const { t } = useLocale();
  return (
    <View style={styles.row}>
      <View style={styles.flex1}>
        <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.rowSubtitle} numberOfLines={1}>{subtitle}</Text>
        <View style={styles.rowFooter}>
          <DaysBadge days={days} />
          <View style={styles.rowActions}>
            <TouchableOpacity onPress={onRestore}>
              <Text style={styles.restoreLink}>{t('trash.restore', 'Restore')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onPurge}>
              <Text style={styles.purgeLink}>{t('trash.delete_permanently', 'Delete Permanently')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

/** Superadmin-only: schools and admins in the 30-day trash - restore or permanently delete. */
export default function TrashScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();
  const { t } = useLocale();

  const [schools, setSchools] = useState<TrashedSchool[]>([]);
  const [admins, setAdmins] = useState<TrashedAdmin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const [s, a] = await Promise.all([fetchTrashedSchools(token), fetchTrashedAdmins(token)]);
      setSchools(s);
      setAdmins(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('trash.load_error', 'Failed to load trash.'));
    }
  }, [token, t]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }, [load]);

  const handleRestoreSchool = (school: TrashedSchool) => {
    if (!token) return;
    restoreSchool(token, school.id)
      .then(load)
      .catch((err) => Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('common.try_again_full', 'Please try again.')));
  };

  const handlePurgeSchool = (school: TrashedSchool) => {
    Alert.alert(
      t('trash.purge_school_title', 'Permanently delete this school?'),
      t('trash.purge_school_message', 'This cannot be undone. Everything belonging to "{title}" - admins, teachers, students, posts, attendance, everything - is removed for good right now.').replace('{title}', school.title),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('trash.delete_permanently', 'Delete Permanently'),
          style: 'destructive',
          onPress: async () => {
            if (!token) return;
            try {
              await purgeSchool(token, school.id);
              load();
            } catch (err) {
              Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('common.try_again_full', 'Please try again.'));
            }
          },
        },
      ],
    );
  };

  const handleRestoreAdmin = (admin: TrashedAdmin) => {
    if (!token) return;
    restoreSchoolAdmin(token, admin.id)
      .then(load)
      .catch((err) => Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('common.try_again_full', 'Please try again.')));
  };

  const handlePurgeAdmin = (admin: TrashedAdmin) => {
    Alert.alert(
      t('trash.purge_admin_title', 'Permanently delete this admin?'),
      t('trash.purge_admin_message', 'This cannot be undone. {name} and their activity log are removed for good right now.').replace('{name}', admin.name),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('trash.delete_permanently', 'Delete Permanently'),
          style: 'destructive',
          onPress: async () => {
            if (!token) return;
            try {
              await purgeSchoolAdmin(token, admin.id);
              load();
            } catch (err) {
              Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('common.try_again_full', 'Please try again.'));
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={10}>
          <ChevronLeftIcon color={EMERALD} />
          <Text style={styles.backText}>{t('common.back', 'Back')}</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>{t('trash.header_title', 'Trash')}</Text>
        </View>
        <View style={{ minWidth: 72 }} />
      </View>

      {isLoading ? (
        <View style={styles.content}>
          <Skeleton width="100%" height={80} style={{ marginBottom: 14 }} />
          <Skeleton width="100%" height={80} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={load} style={styles.retryButton}>
            <Text style={styles.retryText}>{t('common.try_again', 'Try again')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={EMERALD} />}
        >
          <Text style={styles.sectionLabel}>{t('trash.schools_section', 'Schools')}</Text>
          {schools.length === 0 ? (
            <Text style={styles.emptyText}>{t('trash.schools_empty', 'No trashed schools.')}</Text>
          ) : (
            schools.map((s) => (
              <TrashRow
                key={s.id}
                title={s.title}
                subtitle={s.email}
                days={s.days_remaining}
                onRestore={() => handleRestoreSchool(s)}
                onPurge={() => handlePurgeSchool(s)}
              />
            ))
          )}

          <Text style={[styles.sectionLabel, { marginTop: 22 }]}>{t('trash.admins_section', 'Admins')}</Text>
          {admins.length === 0 ? (
            <Text style={styles.emptyText}>{t('trash.admins_empty', 'No trashed admins.')}</Text>
          ) : (
            admins.map((a) => (
              <TrashRow
                key={a.id}
                title={a.name}
                subtitle={a.email}
                days={a.days_remaining}
                onRestore={() => handleRestoreAdmin(a)}
                onPurge={() => handlePurgeAdmin(a)}
              />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: 'transparent' },
  flex1: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: GLASS_SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: GLASS_BORDER,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', minWidth: 72 },
  backText: { color: EMERALD, fontSize: 16, fontWeight: '600', marginLeft: 2 },
  headerTitleWrap: { alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: INK },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  errorText: { color: DANGER, textAlign: 'center', marginBottom: 12 },
  retryButton: { backgroundColor: '#EEF0F2', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  retryText: { color: INK, fontWeight: '600' },

  content: { padding: 16, paddingBottom: 40 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: SUBTLE, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  emptyText: { fontSize: 13, color: SUBTLE, paddingVertical: 8 },

  row: {
    flexDirection: 'row',
    backgroundColor: GLASS_SURFACE,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: HAIRLINE,
    padding: 14,
    marginBottom: 10,
    ...SHADOW.level2,
  },
  rowTitle: { fontSize: 14.5, fontWeight: '700', color: INK },
  rowSubtitle: { fontSize: 12, color: SUBTLE, marginTop: 2 },
  rowFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  rowActions: { flexDirection: 'row', gap: 16 },
  restoreLink: { fontSize: 12.5, color: EMERALD, fontWeight: '700' },
  purgeLink: { fontSize: 12.5, color: DANGER, fontWeight: '700' },

  daysBadge: { backgroundColor: '#EEF0F2', borderRadius: RADIUS.pill, paddingHorizontal: 9, paddingVertical: 3 },
  daysBadgeUrgent: { backgroundColor: 'rgba(239,68,68,0.1)' },
  daysBadgeText: { fontSize: 10.5, color: SUBTLE, fontWeight: '700' },
  daysBadgeTextUrgent: { color: DANGER },
});
