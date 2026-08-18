import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ChevronRight, CircleCheck } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { useOfflineQueue } from '../context/OfflineQueueContext';
import { useAcademicGlassTheme, AcademicGlassTheme } from '../screens/teachers/academicGlassTheme';
import { RADIUS } from '../theme/glass';
import { scanCachedDatasets } from '../utils/syncStatus';

/**
 * Compact dashboard entry point for SyncStatusScreen - "what's downloaded
 * for offline use, what's still waiting to upload" summarized in one tap
 * target instead of a full tile grid entry, since it's a status readout
 * more than a feature to configure. Same icon-square + title + status-pill
 * + subtitle shape as its sibling SubscriptionStatusCard, rather than a
 * bare color dot standing in for both the icon and the status.
 */
export default function SyncStatusCard() {
  const navigation = useNavigation();
  const theme = useAcademicGlassTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { token } = useAuth();
  const { t } = useLocale();
  const { isOnline, actions } = useOfflineQueue();
  const [datasetCount, setDatasetCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      scanCachedDatasets(token).then((d) => setDatasetCount(d.length));
    }, [token])
  );

  const hasPending = actions.length > 0;

  const tint = isOnline ? theme.success : theme.danger;
  // A paler wash (not the same theme.successSoft/dangerSoft the status pill
  // below already uses) so the card's own background and the pill inside it
  // stay visually distinct instead of the pill disappearing into a
  // same-color card.
  const cardTint = tint + '14';

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: cardTint, borderColor: tint + '33' }]}
      activeOpacity={0.85}
      onPress={() => (navigation as any).navigate('SyncStatus')}
    >
      <View style={[styles.iconWrap, { backgroundColor: tint }]}>
        <CircleCheck size={18} color="#FFFFFF" strokeWidth={1.8} />
      </View>
      <View style={styles.textWrap}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {t('sync_status_card.title', 'Offline & Sync')}
          </Text>
          <View style={[styles.pill, { backgroundColor: isOnline ? theme.successSoft : theme.dangerSoft }]}>
            <Text style={[styles.pillText, { color: isOnline ? theme.success : theme.danger }]}>
              {isOnline ? t('sync_status.online', 'Online') : t('sync_status.offline', 'Offline')}
            </Text>
          </View>
        </View>
        <Text style={styles.subtitle} numberOfLines={1}>
          {t('sync_status_card.summary', '{cached} cached · {pending} pending upload')
            .replace('{cached}', String(datasetCount))
            .replace('{pending}', String(actions.length))}
        </Text>
      </View>
      {hasPending ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{actions.length}</Text>
        </View>
      ) : (
        <ChevronRight size={18} color={theme.textMuted} strokeWidth={2} />
      )}
    </TouchableOpacity>
  );
}

const makeStyles = (theme: AcademicGlassTheme) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 12,
      marginHorizontal: 16,
      marginBottom: 12,
      ...theme.elevation1,
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    textWrap: { flex: 1 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { fontSize: 13, fontWeight: '700', color: theme.textPrimary, flexShrink: 1 },
    subtitle: { fontSize: 11, color: theme.textSecondary, marginTop: 1 },
    pill: { borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 2 },
    pillText: { fontSize: 10, fontWeight: '700' },
    badge: {
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: theme.dangerSoft,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    badgeText: { fontSize: 11, fontWeight: '700', color: theme.danger },
  });
