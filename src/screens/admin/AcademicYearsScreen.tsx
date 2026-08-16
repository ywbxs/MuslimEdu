import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, Alert, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
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
  AcademicYear,
  fetchAcademicYears,
  setCurrentAcademicYear,
  deleteAcademicYear,
} from '../../services/academicSetupService';

/**
 * Admin: spec §4.2 Academic Year and Terms - the ongoing management screen
 * AcademicSetupWizardScreen's own hint text promises ("You can add more
 * academic years and terms later from Academic Setup") but that never
 * existed until now. The wizard only ever creates the school's first year;
 * this is where every year after that gets created/edited/deleted, and
 * where "Terms" opens AcademicTermsScreen scoped to one year.
 *
 * Mirrors EnrollmentStagesScreen.tsx's structure/styling (header, skeleton
 * cards, EmptyState, BottomNavBar, error banner with retry) so it reads as
 * the same Academic Management module - same reason: no new component
 * conventions needed for a screen this shaped.
 */

function IconChevronLeft({ color }: { color: string }) {
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}

export default function AcademicYearsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const theme = useAcademicGlassTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { token } = useAuth();
  const { t } = useLocale();

  const [years, setYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      const data = await fetchAcademicYears(token);
      setYears(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('academic_years.load_error', 'Failed to load academic years.'));
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleSetCurrent = async (year: AcademicYear) => {
    if (!token || year.status === 1) return;
    setBusyId(year.id);
    try {
      await setCurrentAcademicYear(token, year.id);
      load();
    } catch (err) {
      Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('academic_years.set_current_error', 'Could not set current academic year.'));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = (year: AcademicYear) => {
    Alert.alert(
      t('academic_years.delete_title', 'Delete Academic Year'),
      `${t('academic_years.delete_confirm', 'Delete')} "${year.session_title}"? ${t('academic_years.delete_irreversible', "This can't be undone.")}`,
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('academic_years.delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            if (!token) return;
            try {
              await deleteAcademicYear(token, year.id);
              load();
            } catch (err) {
              // Backend blocks deletion while terms still exist under this
              // year (or on the current year outright) - surface that
              // message as-is rather than a generic error, same convention
              // as EnrollmentStagesScreen's delete-in-use message.
              Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('academic_years.delete_error', 'Failed to delete academic year.'));
            }
          },
        },
      ]
    );
  };

  const renderYear = ({ item }: { item: AcademicYear }) => {
    const isCurrent = item.status === 1;
    const busy = busyId === item.id;
    return (
      <View style={styles.card}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => (navigation as any).navigate('AcademicYearForm', { sessionId: item.id })}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.name}>{item.session_title}</Text>
            {isCurrent ? (
              <View style={styles.currentBadge}>
                <Text style={styles.currentBadgeText}>{t('academic_years.current', 'Current')}</Text>
              </View>
            ) : null}
          </View>
        </TouchableOpacity>

        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={styles.termsButton}
            onPress={() =>
              (navigation as any).navigate('AcademicTerms', {
                sessionId: item.id,
                sessionTitle: item.session_title,
              })
            }
          >
            <Text style={styles.termsButtonText}>{t('academic_years.terms', 'Terms')}</Text>
          </TouchableOpacity>

          <View style={styles.cardFooterRight}>
            {!isCurrent ? (
              <TouchableOpacity
                style={styles.setCurrentButton}
                disabled={busy}
                onPress={() => handleSetCurrent(item)}
              >
                <Text style={styles.setCurrentButtonText}>{busy ? t('academic_years.setting', 'Setting...') : t('academic_years.set_current', 'Set Current')}</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item)}>
              <Text style={styles.deleteButtonText}>{t('academic_years.delete', 'Delete')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderSkeletonCard = (key: number) => (
    <View key={key} style={styles.card}>
      <Skeleton width="55%" height={18} style={{ marginBottom: 14 }} baseColor={theme.skeletonBase} />
      <Skeleton width={140} height={14} baseColor={theme.skeletonBase} />
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
            <IconChevronLeft color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, styles.headerTitleFlex]}>{t('academic_years.title', 'Academic Years')}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.listContainer}>{[0, 1, 2].map(renderSkeletonCard)}</View>
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
        <Text style={[styles.headerTitle, styles.headerTitleFlex]}>Academic Years</Text>
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => (navigation as any).navigate('InstitutionProfile')}
        >
          <Text style={styles.profileButtonText}>{t('academic_years.profile', 'Profile')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => (navigation as any).navigate('AcademicYearForm')}
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

      <Text style={styles.helperText}>
        {t('academic_years.helper', 'Manage every academic year for this school. "Terms" opens each year\'s semesters/quarters.')}
      </Text>

      <FlatList
        style={{ flex: 1 }}
        data={years}
        renderItem={renderYear}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <EmptyState
            icon="🗓️"
            title={t('academic_years.empty_title', 'No academic years yet')}
            subtitle={t('academic_years.empty_subtitle', 'Add an academic year (e.g. 2026-2027) to get started.')}
            actionLabel={t('academic_years.add_year', 'Add Academic Year')}
            onAction={() => (navigation as any).navigate('AcademicYearForm')}
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
    headerTitle: { fontSize: 22, fontWeight: '700', color: theme.textPrimary },
    headerTitleFlex: { flex: 1, marginLeft: 8 },
    backButton: { width: 32 },
    headerSpacer: { width: 32 },
    profileButton: {
      borderWidth: 1,
      borderColor: theme.borderStrong,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 6,
      marginRight: 8,
    },
    profileButtonText: { color: theme.textPrimary, fontWeight: '600', fontSize: 14 },
    addButton: {
      backgroundColor: theme.accent,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 6,
    },
    addButtonText: { color: theme.onAccent, fontWeight: '600', fontSize: 14 },

    helperText: {
      fontSize: 12.5,
      color: theme.textSecondary,
      paddingHorizontal: 16,
      paddingTop: 12,
      lineHeight: 18,
    },

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
      marginBottom: 12,
    },
    name: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, flex: 1, marginRight: 8 },
    currentBadge: {
      backgroundColor: theme.accentSoft,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 6,
    },
    currentBadgeText: { fontSize: 11, fontWeight: '700', color: theme.accentSoftText },

    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardFooterRight: { flexDirection: 'row', gap: 8 },
    termsButton: {
      borderWidth: 1,
      borderColor: theme.borderStrong,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
    },
    termsButtonText: { color: theme.textPrimary, fontWeight: '600', fontSize: 12.5 },
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
