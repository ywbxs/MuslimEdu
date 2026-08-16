import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
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
 * more than a feature to configure.
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

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => (navigation as any).navigate('SyncStatus')}>
      <View style={[styles.dot, { backgroundColor: isOnline ? theme.success : theme.danger }]} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={styles.title}>{t('sync_status_card.title', 'Offline & Sync')}</Text>
        <Text style={styles.subtitle}>
          {t('sync_status_card.summary', '{cached} cached · {pending} pending upload')
            .replace('{cached}', String(datasetCount))
            .replace('{pending}', String(actions.length))}
        </Text>
      </View>
      {actions.length > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{actions.length}</Text>
        </View>
      ) : null}
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
    dot: { width: 9, height: 9, borderRadius: 4.5 },
    title: { fontSize: 13, fontWeight: '700', color: theme.textPrimary },
    subtitle: { fontSize: 11, color: theme.textSecondary, marginTop: 1 },
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
