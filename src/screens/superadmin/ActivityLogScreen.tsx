import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { fetchActivityLog, ActivityLogEntry } from '../../services/superAdminService';
import { Skeleton } from '../../components/Skeleton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHADOW, GLASS, COLORS, RADIUS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';

const EMERALD = COLORS.emerald;
const EMERALD_SOFT = COLORS.emeraldSoft;
const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const HAIRLINE = COLORS.border;
const GLASS_SURFACE = GLASS.fillOnLight;
const GLASS_BORDER = GLASS.borderOnLight;
const DANGER = COLORS.danger;

function ChevronLeftIcon({ color }: { color: string }) {
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}

function actionColor(action: ActivityLogEntry['action']): string {
  if (action === 'created') return EMERALD;
  if (action === 'deleted') return DANGER;
  return '#B7791F';
}

function actionBg(action: ActivityLogEntry['action']): string {
  if (action === 'created') return EMERALD_SOFT;
  if (action === 'deleted') return 'rgba(239,68,68,0.1)';
  return 'rgba(183,121,31,0.12)';
}

function LogRow({ item }: { item: ActivityLogEntry }) {
  const { t } = useLocale();
  const changedFields = item.new_values ? Object.keys(item.new_values) : [];
  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <View style={[styles.actionPill, { backgroundColor: actionBg(item.action) }]}>
          <Text style={[styles.actionPillText, { color: actionColor(item.action) }]}>{item.action}</Text>
        </View>
        <Text style={styles.timeText}>{new Date(item.created_at).toLocaleString()}</Text>
      </View>
      <Text style={styles.entityText}>
        {item.auditable_type} #{item.auditable_id}
        {item.school_id ? ` · ${t('activity_log.school_hash', 'School #{id}').replace('{id}', String(item.school_id))}` : ''}
      </Text>
      <Text style={styles.actorText}>
        {item.user ? `${item.user.name} (${item.user.email})` : t('activity_log.system_actor', 'System')}
      </Text>
      {changedFields.length > 0 ? (
        <Text style={styles.fieldsText} numberOfLines={2}>
          {t('activity_log.changed_fields', 'Changed')}: {changedFields.join(', ')}
        </Text>
      ) : null}
    </View>
  );
}

/** Superadmin-only: mutation history across every school and admin. */
export default function ActivityLogScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();
  const { t } = useLocale();

  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<'created' | 'updated' | 'deleted' | undefined>(undefined);

  const load = useCallback(async (action?: 'created' | 'updated' | 'deleted') => {
    if (!token) return;
    setError(null);
    try {
      const data = await fetchActivityLog(token, { action });
      setLogs(data.logs);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('activity_log.load_error', 'Failed to load activity log.'));
    }
  }, [token, t]);

  useEffect(() => {
    setIsLoading(true);
    load(actionFilter).finally(() => setIsLoading(false));
  }, [load, actionFilter]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await load(actionFilter);
    setIsRefreshing(false);
  }, [load, actionFilter]);

  const filters: Array<{ label: string; value: 'created' | 'updated' | 'deleted' | undefined }> = [
    { label: t('activity_log.filter_all', 'All'), value: undefined },
    { label: t('activity_log.filter_created', 'Created'), value: 'created' },
    { label: t('activity_log.filter_updated', 'Updated'), value: 'updated' },
    { label: t('activity_log.filter_deleted', 'Deleted'), value: 'deleted' },
  ];

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={10}>
          <ChevronLeftIcon color={EMERALD} />
          <Text style={styles.backText}>{t('common.back', 'Back')}</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>{t('activity_log.header_title', 'Activity Log')}</Text>
        </View>
        <View style={{ minWidth: 72 }} />
      </View>

      <View style={styles.filterRow}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f.label}
            style={[styles.filterChip, actionFilter === f.value && styles.filterChipActive]}
            onPress={() => setActionFilter(f.value)}
          >
            <Text style={[styles.filterChipText, actionFilter === f.value && styles.filterChipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.listContent}>
          <Skeleton width="100%" height={90} style={{ marginBottom: 12 }} />
          <Skeleton width="100%" height={90} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => load(actionFilter)} style={styles.retryButton}>
            <Text style={styles.retryText}>{t('common.try_again', 'Try again')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={EMERALD} />}
          renderItem={({ item }) => <LogRow item={item} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>{t('activity_log.empty_title', 'No activity yet')}</Text>
              <Text style={styles.emptyBody}>{t('activity_log.empty_body', 'Changes to schools, admins and other tracked records will show up here.')}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: 'transparent' },
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

  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  filterChip: { borderRadius: RADIUS.pill, borderWidth: 1, borderColor: HAIRLINE, paddingHorizontal: 12, paddingVertical: 6 },
  filterChipActive: { backgroundColor: EMERALD, borderColor: EMERALD },
  filterChipText: { fontSize: 12.5, color: INK, fontWeight: '600' },
  filterChipTextActive: { color: '#FFFFFF' },

  listContent: { padding: 16, paddingBottom: 40 },
  row: {
    backgroundColor: GLASS_SURFACE,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: HAIRLINE,
    padding: 14,
    marginBottom: 10,
    ...SHADOW.level2,
  },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  actionPill: { borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 3 },
  actionPillText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  timeText: { fontSize: 11, color: SUBTLE },
  entityText: { fontSize: 13.5, fontWeight: '700', color: INK },
  actorText: { fontSize: 12, color: SUBTLE, marginTop: 2 },
  fieldsText: { fontSize: 11.5, color: SUBTLE, marginTop: 6, fontStyle: 'italic' },

  emptyWrap: { alignItems: 'center', paddingTop: 50, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 15.5, fontWeight: '700', color: INK, marginTop: 14 },
  emptyBody: { fontSize: 13, color: SUBTLE, textAlign: 'center', marginTop: 6, lineHeight: 19 },
});
