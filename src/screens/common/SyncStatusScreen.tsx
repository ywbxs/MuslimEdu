import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, CircleCheck, Download, Upload } from 'lucide-react-native';
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
 *
 * Each dataset/action kind gets its own tinted card - a wayfinding color per
 * category (Students blue, School Branding gold, Fees emerald, etc.) rather
 * than every "downloaded" row sharing one accent tint and every "pending"
 * row sharing one danger tint. The tint is a fixed lookup, not derived from
 * the accent, so it stays legible in both themes without recomputing.
 */

const ACTION_LABELS: Record<QueuedActionKind, string> = {
  orphan_report_submit: 'Orphan Report',
  teacher_orphan_report_submit: 'Teacher Orphan Report',
  attendance_submit: 'Attendance Submission',
  attendance_scan: 'QR Attendance Scan',
  examination_save: 'Examination',
  examination_results_save: 'Examination Grades',
  admin_document_issue: 'Document Issued',
  admin_document_reject: 'Document Rejected',
};

// A named palette (not "the accent at different opacities") so each card
// reads as its own category at a glance - same reasoning as the admin
// menu's per-row icon tints. Kept local to this screen; nothing here is the
// app's brand accent (that stays theme.accent/theme.success elsewhere).
const TINT = {
  blue: '#0A84FF',
  indigo: '#5E5CE6',
  teal: '#2FA9B8',
  orange: '#FF9F0A',
  pink: '#FF3B72',
  purple: '#BF5AF2',
  gray: '#8E8E93',
  gold: '#D4A64A',
  emerald: '#1FAE64',
} as const;
type Tint = keyof typeof TINT;

// Every prefix scanCachedDatasets can return (see utils/syncStatus.ts) -
// grouped by what kind of data it is, not by which role sees it.
const DATASET_TINTS: Record<string, Tint> = {
  '@students_cache_v1': 'blue',
  '@student_enrollment_status_cache_v1': 'teal',
  '@attendance_roster_cache_v1': 'indigo',
  '@school_branding_cache_v1': 'gold',
  '@my_schedule_cache_v1': 'indigo',
  '@student_academic_cache_v1': 'purple',
  '@student_progress_cache_v1': 'emerald',
  '@student_identity_cache_v1': 'purple',
  '@student_portal_cache_v1': 'blue',
  '@announcement_cache_v1': 'orange',
  '@chat_cache_v1': 'blue',
  '@post_cache_v1': 'pink',
  '@material_cache_v1': 'teal',
  '@examination_cache_v1': 'purple',
  '@assessment_cache_v1': 'purple',
  '@fee_cache_v1': 'gold',
  '@academic_calendar_cache_v1': 'indigo',
  '@memorization_cache_v1': 'emerald',
  '@behavior_cache_v1': 'orange',
  '@teacher_class_cache_v1': 'blue',
  '@teacher_gradebook_cache_v1': 'purple',
  '@teacher_student_progress_cache_v1': 'teal',
  '@teacher_orphan_cache_v1': 'pink',
  '@orphan_cache_v1': 'pink',
  '@lesson_plan_cache_v1': 'teal',
  '@student_document_upload_cache_v1': 'gray',
};

const PENDING_TINTS: Partial<Record<QueuedActionKind, Tint>> = {
  orphan_report_submit: 'pink',
  teacher_orphan_report_submit: 'pink',
  attendance_submit: 'indigo',
  attendance_scan: 'teal',
  examination_save: 'purple',
  examination_results_save: 'purple',
  admin_document_issue: 'blue',
  admin_document_reject: 'orange',
};

function IconChevronLeft({ color }: { color: string }) {
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}
function IconDownload({ color }: { color: string }) {
  return <Download size={18} color={color} strokeWidth={2} />;
}
function IconUpload({ color }: { color: string }) {
  return <Upload size={18} color={color} strokeWidth={2} />;
}
function IconCheck({ color }: { color: string }) {
  return <CircleCheck size={20} color={color} strokeWidth={2} />;
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
            <View style={{ gap: 10 }}>
              {datasets.map((d) => {
                const tint = TINT[DATASET_TINTS[d.key] ?? 'emerald'];
                return (
                  <View key={d.key} style={[styles.itemCard, { backgroundColor: tint + '14', borderColor: tint + '33' }]}>
                    <View style={[styles.itemIconWrap, { backgroundColor: tint }]}>
                      <IconDownload color="#FFFFFF" />
                    </View>
                    <View style={styles.itemTextWrap}>
                      <Text style={styles.itemTitle} numberOfLines={1}>{d.label}</Text>
                      <Text style={styles.itemMeta}>
                        {d.count > 1
                          ? t('sync_status.snapshots', '{count} snapshots · {size}').replace('{count}', String(d.count)).replace('{size}', formatBytes(d.bytes))
                          : formatBytes(d.bytes)}
                      </Text>
                    </View>
                    <IconCheck color={tint} />
                  </View>
                );
              })}
            </View>
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
          <View style={{ gap: 10 }}>
            {pendingByKind.map(([kind, list]) => {
              const hasError = list.some((a) => a.lastError);
              const tint = hasError ? theme.danger : TINT[PENDING_TINTS[kind] ?? 'gray'];
              return (
                <View key={kind} style={[styles.itemCard, { backgroundColor: tint + '14', borderColor: tint + '33' }]}>
                  <View style={[styles.itemIconWrap, { backgroundColor: tint }]}>
                    <IconUpload color="#FFFFFF" />
                  </View>
                  <View style={styles.itemTextWrap}>
                    <Text style={styles.itemTitle} numberOfLines={1}>{ACTION_LABELS[kind] ?? kind}</Text>
                    <Text style={styles.itemMeta}>
                      {t('sync_status.pending_count', '{count} pending · oldest {when}')
                        .replace('{count}', String(list.length))
                        .replace('{when}', formatWhen(Math.min(...list.map((a) => a.createdAt)), t))}
                    </Text>
                    {hasError ? (
                      <Text style={styles.errorText} numberOfLines={2}>
                        {list.find((a) => a.lastError)?.lastError}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
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

    // Fully-rounded pill, not just a rounded rectangle - the app's own
    // "state" affordance elsewhere (status pills on SubscriptionStatusCard,
    // badges) is always a true pill; this banner is the same idea scaled up.
    connectionBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 16,
      marginTop: 12,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: RADIUS.pill,
    },
    connectionDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
    connectionText: { fontSize: 14, fontWeight: '700', flex: 1 },
    syncNowBtn: { backgroundColor: theme.accent, borderRadius: RADIUS.pill, paddingHorizontal: 14, paddingVertical: 7, minWidth: 80, alignItems: 'center' },
    syncNowText: { fontSize: 12, fontWeight: '700', color: theme.onAccent },

    content: { padding: 16, paddingBottom: 40 },
    // Uppercase, letter-spaced eyebrow - the same section-header convention
    // as every other grouped list in the app (e.g. the admin menu's PEOPLE /
    // ACADEMICS labels), instead of this screen's own plain bold caption.
    sectionLabel: {
      fontSize: 12.5,
      fontWeight: '700',
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 4,
    },
    sectionHelper: { fontSize: 12.5, color: theme.textSecondary, lineHeight: 18, marginBottom: 12 },

    emptyCard: {
      backgroundColor: theme.surface,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
    },
    emptyText: { fontSize: 12.5, color: theme.textSecondary, lineHeight: 18 },

    // Each row is its own tinted card (soft category-colored background +
    // matching hairline) instead of a shared white list - the color itself
    // is the wayfinding, not just the icon square inside it.
    itemCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      padding: 12,
    },
    itemIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    itemTextWrap: { flex: 1 },
    itemTitle: { fontSize: 14.5, fontWeight: '700', color: theme.textPrimary },
    itemMeta: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
    errorText: { fontSize: 11, color: theme.danger, marginTop: 3 },
    totalText: { fontSize: 12, color: theme.textMuted, textAlign: 'right', marginTop: 8 },
  });
