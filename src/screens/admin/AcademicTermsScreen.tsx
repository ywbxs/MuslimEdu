import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, Alert, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
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
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
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
  const { t } = useLocale();

  const sessionId: number = route.params?.sessionId;
  const sessionTitle: string = route.params?.sessionTitle ?? t('academic_terms.academic_year', 'Academic Year');

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
      setError(err instanceof Error ? err.message : t('academic_terms.load_error', 'Failed to load terms.'));
    } finally {
      setLoading(false);
    }
  }, [token, sessionId, t]);

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
      Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('academic_terms.set_current_error', 'Could not set current term.'));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = (term: AcademicTerm) => {
    Alert.alert(
      t('academic_terms.delete_title', 'Delete Term'),
      `${t('academic_terms.delete_confirm', 'Delete')} "${term.name}"? ${t('academic_terms.delete_irreversible', "This can't be undone.")}`,
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('academic_terms.delete', 'Delete'),
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
              Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('academic_terms.delete_error', 'Failed to delete term.'));
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
                <Text style={styles.currentBadgeText}>{t('academic_terms.current', 'Current')}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.typeText}>{item.term_type}</Text>
          {range ? <Text style={styles.rangeText}>{range}</Text> : null}
        </TouchableOpacity>

        <View style={styles.cardFooter}>
          {!item.is_current ? (
            <TouchableOpacity style={styles.setCurrentButton} disabled={busy} onPress={() => handleSetCurrent(item)}>
              <Text style={styles.setCurrentButtonText}>{busy ? t('academic_terms.setting', 'Setting...') : t('academic_terms.set_current', 'Set Current')}</Text>
            </TouchableOpacity>
          ) : (
            <View />
          )}
          <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item)}>
            <Text style={styles.deleteButtonText}>{t('academic_terms.delete', 'Delete')}</Text>
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
            {sessionTitle} {t('academic_terms.terms_suffix', 'Terms')}
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
          <Text style={styles.addButtonText}>+ {t('common.add', 'Add')}</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
          <TouchableOpacity onPress={load}>
            <Text style={styles.retryText}>{t('common.retry', 'Retry')}</Text>
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
            title={t('academic_terms.empty_title', 'No terms yet')}
            subtitle={t('academic_terms.empty_subtitle', 'Add a semester, trimester, or quarter to this academic year.')}
            actionLabel={t('academic_terms.add_term', 'Add Term')}
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
