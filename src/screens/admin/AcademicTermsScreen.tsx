import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, Alert, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polyline } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useAcademicGlassTheme, AcademicGlassTheme } from '../teachers/academicGlassTheme';
import { RADIUS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';
import { Skeleton } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import BottomNavBar from '../../components/BottomNavBar';
import {
  AcademicTerm,
  fetchAcademicTerms,
  setCurrentAcademicTerm,
  deleteAcademicTerm,
} from '../../services/academicSetupService';

/**
 * Admin: terms within one academic year (route param sessionId - always
 * arrives via AcademicYearsScreen's "Terms" button, never standalone, since
 * every term belongs to exactly one year on the backend).
 */

function IconChevronLeft({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Polyline points="15 5 8 12 15 19" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function formatRange(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  return `${start ?? '?'} - ${end ?? '?'}`;
}

export default function AcademicTermsScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const theme = useAcademicGlassTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { token } = useAuth();

  const sessionId: number = route.params?.sessionId;
  const sessionTitle: string = route.params?.sessionTitle ?? 'Academic Year';

  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token || !sessionId) return;
    try {
      setError(null);
      const data = await fetchAcademicTerms(token, sessionId);
      setTerms(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load terms.');
    } finally {
      setLoading(false);
    }
  }, [token, sessionId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleSetCurrent = async (term: AcademicTerm) => {
    if (!token || term.is_current) return;
    setBusyId(term.id);
    try {
      await setCurrentAcademicTerm(token, term.id);
      load();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not set current term.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = (term: AcademicTerm) => {
    Alert.alert(
      'Delete Term',
      `Delete "${term.name}"? This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!token) return;
            try {
              await deleteAcademicTerm(token, term.id);
              load();
            } catch (err) {
              // Backend blocks deletion while classes are still assigned to
              // this term - surface that message as-is, same convention as
              // enrollment stage delete-in-use.
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to delete term.');
            }
          },
        },
      ]
    );
  };

  const renderTerm = ({ item }: { item: AcademicTerm }) => {
    const busy = busyId === item.id;
    const range = formatRange(item.start_date, item.end_date);
    return (
      <View style={styles.card}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => (navigation as any).navigate('AcademicTermForm', { sessionId, termId: item.id })}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.name}>{item.name}</Text>
            {item.is_current ? (
              <View style={styles.currentBadge}>
                <Text style={styles.currentBadgeText}>Current</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.typeText}>{item.term_type}</Text>
          {range ? <Text style={styles.rangeText}>{range}</Text> : null}
        </TouchableOpacity>

        <View style={styles.cardFooter}>
          {!item.is_current ? (
            <TouchableOpacity style={styles.setCurrentButton} disabled={busy} onPress={() => handleSetCurrent(item)}>
              <Text style={styles.setCurrentButtonText}>{busy ? 'Setting...' : 'Set Current'}</Text>
            </TouchableOpacity>
          ) : (
            <View />
          )}
          <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item)}>
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderSkeletonCard = (key: number) => (
    <View key={key} style={styles.card}>
      <Skeleton width="50%" height={18} style={{ marginBottom: 10 }} baseColor={theme.skeletonBase} />
      <Skeleton width={90} height={13} baseColor={theme.skeletonBase} />
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
            <IconChevronLeft color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, styles.headerTitleFlex]} numberOfLines={1}>
            {sessionTitle} Terms
          </Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.listContainer}>{[0, 1].map(renderSkeletonCard)}</View>
        <BottomNavBar />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
          <IconChevronLeft color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, styles.headerTitleFlex]} numberOfLines={1}>
          {sessionTitle} Terms
        </Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => (navigation as any).navigate('AcademicTermForm', { sessionId })}
        >
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
          <TouchableOpacity onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <FlatList
        style={{ flex: 1 }}
        data={terms}
        renderItem={renderTerm}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <EmptyState
            icon="📚"
            title="No terms yet"
            subtitle="Add a semester, trimester, or quarter to this academic year."
            actionLabel="Add Term"
            onAction={() => (navigation as any).navigate('AcademicTermForm', { sessionId })}
            colors={theme}
          />
        }
      />
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
    addButton: {
      backgroundColor: theme.accent,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 6,
    },
    addButtonText: { color: theme.onAccent, fontWeight: '600', fontSize: 14 },

    errorBanner: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: theme.dangerSoft,
      marginHorizontal: 16,
      marginTop: 12,
      padding: 12,
      borderRadius: RADIUS.md ?? 10,
    },
    errorBannerText: { color: theme.danger, fontSize: 13, flex: 1, marginRight: 8 },
    retryText: { color: theme.danger, fontWeight: '700', fontSize: 13 },

    listContainer: { paddingHorizontal: 16, paddingVertical: 12 },
    card: {
      backgroundColor: theme.surface,
      borderRadius: RADIUS.lg,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
      ...theme.elevation2,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    name: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, flex: 1, marginRight: 8 },
    currentBadge: {
      backgroundColor: theme.accentSoft,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 6,
    },
    currentBadgeText: { fontSize: 11, fontWeight: '700', color: theme.accentSoftText },
    typeText: { fontSize: 12.5, color: theme.textSecondary, textTransform: 'capitalize', marginBottom: 2 },
    rangeText: { fontSize: 12, color: theme.textMuted, marginBottom: 10 },

    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
    setCurrentButton: {
      borderWidth: 1,
      borderColor: theme.accent,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
    },
    setCurrentButtonText: { color: theme.accent, fontWeight: '600', fontSize: 12.5 },
    deleteButton: {
      borderWidth: 1,
      borderColor: theme.dangerSoft,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
    },
    deleteButtonText: { color: theme.danger, fontSize: 12, fontWeight: '600' },
  });
