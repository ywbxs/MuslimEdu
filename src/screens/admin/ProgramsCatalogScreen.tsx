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
import { Subject, fetchSubjectsCatalog, deleteSubject } from '../../services/adminAcademicCatalogService';

/**
 * Admin: spec §4.7 Subject catalog.
 *
 * Used to be a two-tab hub (Programs relabeled "Section/Class" + Subjects),
 * but Program isn't the real class/section entity - it's a separate,
 * lighter-weight track/grouping concept (still used by Curriculum's and
 * Org Structure's own pickers via ProgramForm, just not surfaced as its own
 * tab here anymore). Having it labeled "Section/Class" next to the real
 * Classes & Sections tile (CreateClassScreen, wired to grade levels,
 * shifts, capacity, rooms) was two different things claiming the same
 * name - dropped the tab so "Section/Class" only ever means the real one.
 * This screen is Subjects only now.
 */

function IconChevronLeft({ color }: { color: string }) {
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}

export default function ProgramsCatalogScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const theme = useAcademicGlassTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { token } = useAuth();
  const { t } = useLocale();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      setSubjects(await fetchSubjectsCatalog(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('programs_catalog.load_error', 'Failed to load the catalog.'));
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleDeleteSubject = (subject: Subject) => {
    Alert.alert(
      t('programs_catalog.delete_subject_title', 'Delete Subject'),
      t('programs_catalog.delete_message', 'Delete "{name}"? This can\'t be undone.').replace('{name}', subject.name),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('programs_catalog.delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            if (!token) return;
            try {
              await deleteSubject(token, subject.id);
              load();
            } catch (err) {
              // Backend blocks deletion while still assigned to a class -
              // surface that message as-is.
              Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('programs_catalog.delete_subject_error', 'Failed to delete subject.'));
            }
          },
        },
      ],
    );
  };

  const renderSubject = ({ item }: { item: Subject }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        {item.color ? <View style={[styles.colorDot, { backgroundColor: item.color }]} /> : null}
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        {item.code ? (
          <View style={styles.codeChip}>
            <Text style={styles.codeChipText}>{item.code}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.metaRow}>
        {item.units != null ? (
          <View style={styles.typeChip}>
            <Text style={styles.typeChipText}>{t('programs_catalog.units', '{n} units').replace('{n}', String(item.units))}</Text>
          </View>
        ) : null}
        {item.status === 'inactive' ? (
          <View style={styles.inactiveChip}>
            <Text style={styles.inactiveChipText}>{t('programs_catalog.inactive', 'Inactive')}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.scaleStatus}>
        {item.prerequisites && item.prerequisites.length > 0
          ? t('programs_catalog.requires', 'Requires: {list}').replace('{list}', item.prerequisites.map((p) => p.name).join(', '))
          : t('programs_catalog.no_prerequisites', 'No prerequisites')}
      </Text>
      {item.corequisites && item.corequisites.length > 0 ? (
        <Text style={styles.scaleStatus}>
          {t('programs_catalog.alongside', 'Alongside: {list}').replace('{list}', item.corequisites.map((c) => c.name).join(', '))}
        </Text>
      ) : null}
      <View style={styles.cardFooter}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => (navigation as any).navigate('SubjectForm', { subjectId: item.id })}
        >
          <Text style={styles.editButtonText}>{t('common.edit', 'Edit')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteButton} onPress={() => handleDeleteSubject(item)}>
          <Text style={styles.deleteButtonText}>{t('programs_catalog.delete', 'Delete')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSkeletonCard = (key: number) => (
    <View key={key} style={styles.card}>
      <Skeleton width="55%" height={18} style={{ marginBottom: 14 }} baseColor={theme.skeletonBase} />
      <Skeleton width={140} height={14} baseColor={theme.skeletonBase} />
    </View>
  );

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
        <IconChevronLeft color={theme.textPrimary} />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, styles.headerTitleFlex]}>{t('programs_catalog.title', 'Subjects')}</Text>
      {!loading ? (
        <TouchableOpacity style={styles.addButton} onPress={() => (navigation as any).navigate('SubjectForm')}>
          <Text style={styles.addButtonText}>{t('programs_catalog.add', '+ Add')}</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.headerSpacer} />
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.listContainer}>{[0, 1, 2].map(renderSkeletonCard)}</View>
        <BottomNavBar />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <GlassBackground variant="canvas" />
      {header}

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
          <TouchableOpacity onPress={load}>
            <Text style={styles.retryText}>{t('common.retry', 'Retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <FlatList
        data={subjects}
        renderItem={renderSubject}
        keyExtractor={(item) => `subject-${item.id}`}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <EmptyState
            icon="📖"
            title={t('programs_catalog.empty_subjects_title', 'No subjects yet')}
            subtitle={t('programs_catalog.empty_subjects_subtitle', 'Add a subject to the catalog so it can be used in curricula and assigned to classes.')}
            actionLabel={t('programs_catalog.empty_subjects_action', 'Add Subject')}
            onAction={() => (navigation as any).navigate('SubjectForm')}
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
      marginBottom: 8,
    },
    name: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, flex: 1, marginRight: 8 },
    colorDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
    codeChip: {
      backgroundColor: theme.accentSoft,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 6,
    },
    codeChipText: { fontSize: 11, fontWeight: '700', color: theme.accentSoftText },

    metaRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
    typeChip: {
      backgroundColor: theme.surfaceVariant,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 6,
    },
    typeChipText: { fontSize: 11.5, fontWeight: '600', color: theme.textSecondary },
    inactiveChip: {
      backgroundColor: theme.dangerSoft,
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 6,
    },
    inactiveChipText: { fontSize: 11.5, fontWeight: '600', color: theme.danger },

    scaleStatus: { fontSize: 12.5, color: theme.textSecondary, marginBottom: 12 },

    cardFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
    editButton: {
      borderWidth: 1,
      borderColor: theme.borderStrong,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
    },
    editButtonText: { color: theme.textPrimary, fontWeight: '600', fontSize: 12.5 },
    deleteButton: {
      borderWidth: 1,
      borderColor: theme.dangerSoft,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
    },
    deleteButtonText: { color: theme.danger, fontSize: 12, fontWeight: '600' },
  });
