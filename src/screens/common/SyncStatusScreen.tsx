import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polyline, Path, Circle } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { useOfflineQueue } from '../../context/OfflineQueueContext';
import { useAcademicGlassTheme, AcademicGlassTheme } from '../teachers/academicGlassTheme';
import { RADIUS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';
import BottomNavBar from '../../components/BottomNavBar';
import { scanCachedDatasets, formatBytes, CachedDataset } from '../../utils/syncStatus';
import { QueuedAction, QueuedActionKind } from '../../services/offlineQueue';

/**
 * "What's downloaded (cached offline) vs what's still waiting to upload" -
 * reads real AsyncStorage cache keys (scanCachedDatasets) for the download
 * side and the existing offline outbox (useOfflineQueue) for the upload
 * side, rather than tracking a separate parallel log. Reachable from both
 * AdminDashboard and TeacherDashboard, since both roles' data flows feed
 * into the same underlying caches/queue.
 */

const ACTION_LABELS: Record<QueuedActionKind, string> = {
  orphan_report_submit: 'Orphan Report',
  teacher_orphan_report_submit: 'Teacher Orphan Report',
  attendance_submit: 'Attendance Submission',
  attendance_scan: 'QR Attendance Scan',
};

function IconChevronLeft({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Polyline points="15 5 8 12 15 19" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconDownload({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3v12M7 10l5 5 5-5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 19h16" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function IconUpload({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M12 21V9M7 14l5-5 5 5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 5h16" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function IconCheck({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} />
      <Path d="M8.5 12l2.5 2.5L15.5 9" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function formatWhen(ms: number, t: (k: string, f: string) => string): string {
  const diffMin = Math.round((Date.now() - ms) / 60000);
  if (diffMin < 1) return t('sync_status.just_now', 'just now');
  if (diffMin < 60) return t('sync_status.minutes_ago', '{n}m ago').replace('{n}', String(diffMin));
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return t('sync_status.hours_ago', '{n}h ago').replace('{n}', String(diffHr));
  return new Date(ms).toLocaleDateString();
}

export default function SyncStatusScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const theme = useAcademicGlassTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { token } = useAuth();
  const { t } = useLocale();
  const { isOnline, isFlushing, actions, flushNow } = useOfflineQueue();

  const [datasets, setDatasets] = useState<CachedDataset[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setDatasets(await scanCachedDatasets(token));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const pendingByKind = useMemo(() => {
    const groups = new Map<QueuedActionKind, QueuedAction[]>();
    actions.forEach((a) => {
      const list = groups.get(a.kind) ?? [];
      list.push(a);
      groups.set(a.kind, list);
    });
    return Array.from(groups.entries());
  }, [actions]);

  const totalBytes = datasets.reduce((sum, d) => sum + d.bytes, 0);

  return (
    <View style={styles.container}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
          <IconChevronLeft color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, styles.headerTitleFlex]}>{t('sync_status.title', 'Offline & Sync')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={[styles.connectionBanner, { backgroundColor: isOnline ? theme.successSoft : theme.dangerSoft }]}>
        <View style={[styles.connectionDot, { backgroundColor: isOnline ? theme.success : theme.danger }]} />
        <Text style={[styles.connectionText, { color: isOnline ? theme.success : theme.danger }]}>
          {isOnline ? t('sync_status.online', 'Online') : t('sync_status.offline', 'Offline')}
        </Text>
        {actions.length > 0 ? (
          <TouchableOpacity style={styles.syncNowBtn} onPress={() => flushNow()} disabled={isFlushing || !isOnline}>
            {isFlushing ? <ActivityIndicator size="small" color={theme.onAccent} /> : <Text style={styles.syncNowText}>{t('sync_status.sync_now', 'Sync Now')}</Text>}
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionLabel}>{t('sync_status.downloaded', 'Downloaded (available offline)')}</Text>
        <Text style={styles.sectionHelper}>
          {t('sync_status.downloaded_helper', 'Data saved on this device so key screens still work without a connection.')}
        </Text>

        {loading ? (
          <ActivityIndicator color={theme.accent} style={{ marginVertical: 16 }} />
        ) : datasets.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{t('sync_status.nothing_cached', 'Nothing cached yet - open a few screens while online to build up an offline cache.')}</Text>
          </View>
        ) : (
          <>
            {datasets.map((d) => (
              <View key={d.key} style={styles.itemCard}>
                <View style={styles.itemIconWrap}>
                  <IconDownload color={theme.accent} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.itemTitle}>{d.label}</Text>
                  <Text style={styles.itemMeta}>
                    {d.count > 1
                      ? t('sync_status.snapshots', '{count} snapshots · {size}').replace('{count}', String(d.count)).replace('{size}', formatBytes(d.bytes))
                      : formatBytes(d.bytes)}
                  </Text>
                </View>
                <IconCheck color={theme.success} />
              </View>
            ))}
            <Text style={styles.totalText}>
              {t('sync_status.total_cached', 'Total cached: {size}').replace('{size}', formatBytes(totalBytes))}
            </Text>
          </>
        )}

        <Text style={[styles.sectionLabel, { marginTop: 28 }]}>{t('sync_status.pending_upload', 'Waiting to Upload')}</Text>
        <Text style={styles.sectionHelper}>
          {t('sync_status.pending_helper', "Actions taken offline - they'll sync automatically the moment you're back online.")}
        </Text>

        {pendingByKind.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{t('sync_status.all_synced', 'Everything is synced - nothing waiting to upload.')}</Text>
          </View>
        ) : (
          pendingByKind.map(([kind, list]) => (
            <View key={kind} style={styles.itemCard}>
              <View style={[styles.itemIconWrap, { backgroundColor: theme.dangerSoft }]}>
                <IconUpload color={theme.danger} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.itemTitle}>{ACTION_LABELS[kind] ?? kind}</Text>
                <Text style={styles.itemMeta}>
                  {t('sync_status.pending_count', '{count} pending · oldest {when}')
                    .replace('{count}', String(list.length))
                    .replace('{when}', formatWhen(Math.min(...list.map((a) => a.createdAt)), t))}
                </Text>
                {list.some((a) => a.lastError) ? (
                  <Text style={styles.errorText} numberOfLines={2}>
                    {list.find((a) => a.lastError)?.lastError}
                  </Text>
                ) : null}
              </View>
            </View>
          ))
        )}
      </ScrollView>
      <BottomNavBar />
    </View>
  );
}

const makeStyles = (theme: AcademicGlassTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerTitle: { fontSize: 20, fontWeight: '700', color: theme.textPrimary },
    headerTitleFlex: { flex: 1, marginLeft: 8 },
    backButton: { width: 32 },
    headerSpacer: { width: 32 },

    connectionBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 16,
      marginTop: 12,
      padding: 12,
      borderRadius: RADIUS.md,
    },
    connectionDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
    connectionText: { fontSize: 13, fontWeight: '700', flex: 1 },
    syncNowBtn: { backgroundColor: theme.accent, borderRadius: RADIUS.pill, paddingHorizontal: 14, paddingVertical: 7, minWidth: 80, alignItems: 'center' },
    syncNowText: { fontSize: 12, fontWeight: '700', color: theme.onAccent },

    content: { padding: 16, paddingBottom: 40 },
    sectionLabel: { fontSize: 13, fontWeight: '700', color: theme.textPrimary, marginBottom: 4 },
    sectionHelper: { fontSize: 12, color: theme.textSecondary, lineHeight: 17, marginBottom: 12 },

    emptyCard: {
      backgroundColor: theme.surface,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
    },
    emptyText: { fontSize: 12.5, color: theme.textSecondary, lineHeight: 18 },

    itemCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      marginBottom: 10,
      ...theme.elevation2,
    },
    itemIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    itemTitle: { fontSize: 14, fontWeight: '700', color: theme.textPrimary, marginBottom: 2 },
    itemMeta: { fontSize: 11.5, color: theme.textSecondary },
    errorText: { fontSize: 11, color: theme.danger, marginTop: 3 },
    totalText: { fontSize: 11.5, color: theme.textMuted, textAlign: 'right', marginTop: 2 },
  });
