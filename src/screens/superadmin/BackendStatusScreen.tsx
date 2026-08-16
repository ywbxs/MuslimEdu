import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { fetchBackendHealth, BackendHealth } from '../../services/superAdminService';
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

function StatusDot({ ok }: { ok: boolean }) {
  return <View style={[styles.dot, { backgroundColor: ok ? EMERALD : DANGER }]} />;
}

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function formatBytes(bytes: number | null): string {
  if (bytes == null) return '-';
  const gb = bytes / 1024 / 1024 / 1024;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(0)} MB`;
}

/** Superadmin-only: live backend health check (not visitor/traffic analytics). */
export default function BackendStatusScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();
  const { t } = useLocale();

  const [health, setHealth] = useState<BackendHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const data = await fetchBackendHealth(token);
      setHealth(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('backend_status.load_error', 'Failed to load backend status.'));
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

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={10}>
          <ChevronLeftIcon color={EMERALD} />
          <Text style={styles.backText}>{t('common.back', 'Back')}</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>{t('backend_status.header_title', 'Backend Status')}</Text>
        </View>
        <View style={{ minWidth: 72 }} />
      </View>

      {isLoading ? (
        <View style={styles.content}>
          <Skeleton width="100%" height={100} style={{ marginBottom: 14 }} />
          <Skeleton width="100%" height={100} style={{ marginBottom: 14 }} />
          <Skeleton width="100%" height={100} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={load} style={styles.retryButton}>
            <Text style={styles.retryText}>{t('common.try_again', 'Try again')}</Text>
          </TouchableOpacity>
        </View>
      ) : health ? (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={EMERALD} />}
        >
          <Text style={styles.checkedAt}>
            {t('backend_status.checked_at', 'Checked')}: {new Date(health.checked_at).toLocaleString()}
          </Text>

          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <StatusDot ok={health.database.ok} />
              <Text style={styles.cardTitle}>{t('backend_status.database', 'Database')}</Text>
            </View>
            <InfoRow label={t('backend_status.driver', 'Driver')} value={health.database.driver} />
            {health.database.error ? <Text style={styles.errorDetail}>{health.database.error}</Text> : null}
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <StatusDot ok={health.cache.ok} />
              <Text style={styles.cardTitle}>{t('backend_status.cache', 'Cache')}</Text>
            </View>
            <InfoRow label={t('backend_status.driver', 'Driver')} value={health.cache.driver} />
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <StatusDot ok={health.queue.failed_jobs === 0} />
              <Text style={styles.cardTitle}>{t('backend_status.queue', 'Queue')}</Text>
            </View>
            <InfoRow label={t('backend_status.driver', 'Driver')} value={health.queue.driver} />
            <InfoRow label={t('backend_status.failed_jobs', 'Failed jobs')} value={health.queue.failed_jobs} />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('backend_status.disk', 'Disk Space')}</Text>
            <InfoRow label={t('backend_status.disk_free', 'Free')} value={formatBytes(health.disk.free_bytes)} />
            <InfoRow label={t('backend_status.disk_total', 'Total')} value={formatBytes(health.disk.total_bytes)} />
            {health.disk.free_percent != null ? (
              <InfoRow label={t('backend_status.disk_free_percent', 'Free %')} value={`${health.disk.free_percent}%`} />
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('backend_status.app', 'Application')}</Text>
            <InfoRow label={t('backend_status.php_version', 'PHP')} value={health.app.php_version} />
            <InfoRow label={t('backend_status.laravel_version', 'Laravel')} value={health.app.laravel_version} />
            <InfoRow label={t('backend_status.environment', 'Environment')} value={health.app.environment} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('backend_status.debug_mode', 'Debug mode')}</Text>
              <Text style={[styles.infoValue, health.app.debug_mode && { color: DANGER, fontWeight: '700' }]}>
                {health.app.debug_mode ? t('backend_status.debug_on', 'ON (turn off before release)') : t('backend_status.debug_off', 'Off')}
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('backend_status.totals', 'Totals')}</Text>
            <InfoRow label={t('backend_status.total_schools', 'Schools')} value={health.totals.schools} />
            <InfoRow label={t('backend_status.total_users', 'Users')} value={health.totals.users} />
            <InfoRow label={t('backend_status.total_posts', 'Posts')} value={health.totals.posts} />
          </View>
        </ScrollView>
      ) : null}
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

  content: { padding: 16, paddingBottom: 40 },
  checkedAt: { fontSize: 12, color: SUBTLE, marginBottom: 14, textAlign: 'center' },
  card: {
    backgroundColor: GLASS_SURFACE,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: HAIRLINE,
    padding: 16,
    marginBottom: 14,
    ...SHADOW.level2,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: INK, marginBottom: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  infoLabel: { fontSize: 13, color: SUBTLE },
  infoValue: { fontSize: 13, color: INK, fontWeight: '600' },
  errorDetail: { fontSize: 12, color: DANGER, marginTop: 8 },
});
