import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, Alert, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
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
  Program,
  Subject,
  fetchPrograms,
  deleteProgram,
  fetchSubjectsCatalog,
  deleteSubject,
} from '../../services/adminAcademicCatalogService';

/**
 * Admin: spec §4.3/§4.6 Programs + §4.7 Subject catalog.
 *
 * Same "backend already existed, no RN consumer yet" situation as
 * GradingSystemsScreen (see Status 11 build-next). One hub screen with a
 * segmented tab, same way AcademicHubScreen switches tabs client-side
 * rather than being two separate always-mounted screens - Programs and
 * Subjects are both short catalog lists for a school, not paginated
 * tables, so a single fetch-on-tab-focus screen is enough.
 *
 * Subjects shown here are catalog subjects (class_id null) only - the
 * existing "assign a subject to a class" flow is untouched and separate.
 */

type Tab = 'programs' | 'subjects';

function IconChevronLeft({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Polyline points="15 5 8 12 15 19" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function ProgramsCatalogScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const theme = useAcademicGlassTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { token } = useAuth();

  const [tab, setTab] = useState<Tab>('programs');
  const [programs, setPrograms] = useState<Program[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      const [p, s] = await Promise.all([fetchPrograms(token), fetchSubjectsCatalog(token)]);
      setPrograms(p);
      setSubjects(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the catalog.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleDeleteProgram = (program: Program) => {
    Alert.alert('Delete Program', `Delete "${program.name}"? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!token) return;
          try {
            await deleteProgram(token, program.id);
            load();
          } catch (err) {
            // Backend blocks deletion while subjects are still assigned to
            // it - surface that message as-is.
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to delete program.');
          }
        },
      },
    ]);
  };

  const handleDeleteSubject = (subject: Subject) => {
    Alert.alert('Delete Subject', `Delete "${subject.name}"? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!token) return;
          try {
            await deleteSubject(token, subject.id);
            load();
          } catch (err) {
            // Backend blocks deletion while still assigned to a class -
            // surface that message as-is.
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to delete subject.');
          }
        },
      },
    ]);
  };

  const renderProgram = ({ item }: { item: Program }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        {item.code ? (
          <View style={styles.codeChip}>
            <Text style={styles.codeChipText}>{item.code}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.metaRow}>
        {item.duration_terms ? (
          <View style={styles.typeChip}>
            <Text style={styles.typeChipText}>{item.duration_terms} terms</Text>
          </View>
        ) : null}
        {item.status === 'inactive' ? (
          <View style={styles.inactiveChip}>
            <Text style={styles.inactiveChipText}>Inactive</Text>
          </View>
        ) : null}
      </View>
      {item.description ? (
        <Text style={styles.scaleStatus} numberOfLines={2}>{item.description}</Text>
      ) : null}
      <View style={styles.cardFooter}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => (navigation as any).navigate('ProgramForm', { programId: item.id })}
        >
          <Text style={styles.editButtonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteButton} onPress={() => handleDeleteProgram(item)}>
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

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
            <Text style={styles.typeChipText}>{item.units} units</Text>
          </View>
        ) : null}
        {item.status === 'inactive' ? (
          <View style={styles.inactiveChip}>
            <Text style={styles.inactiveChipText}>Inactive</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.scaleStatus}>
        {item.prerequisites && item.prerequisites.length > 0
          ? `Requires: ${item.prerequisites.map((p) => p.name).join(', ')}`
          : 'No prerequisites'}
      </Text>
      {item.corequisites && item.corequisites.length > 0 ? (
        <Text style={styles.scaleStatus}>
          {`Alongside: ${item.corequisites.map((c) => c.name).join(', ')}`}
        </Text>
      ) : null}
      <View style={styles.cardFooter}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => (navigation as any).navigate('SubjectForm', { subjectId: item.id })}
        >
          <Text style={styles.editButtonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteButton} onPress={() => handleDeleteSubject(item)}>
          <Text style={styles.deleteButtonText}>Delete</Text>
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
      <Text style={[styles.headerTitle, styles.headerTitleFlex]}>Programs & Subjects</Text>
      {!loading ? (
        <TouchableOpacity
          style={styles.addButton}
          onPress={() =>
            (navigation as any).navigate(tab === 'programs' ? 'ProgramForm' : 'SubjectForm')
          }
        >
          <Text style={styles.addButtonText}>+ Add</Text>
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

  const data = tab === 'programs' ? programs : subjects;

  return (
    <View style={styles.container}>
      <GlassBackground variant="canvas" />
      {header}

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'programs' && styles.tabButtonActive]}
          onPress={() => setTab('programs')}
        >
          <Text style={[styles.tabButtonText, tab === 'programs' && styles.tabButtonTextActive]}>
            Programs ({programs.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'subjects' && styles.tabButtonActive]}
          onPress={() => setTab('subjects')}
        >
          <Text style={[styles.tabButtonText, tab === 'subjects' && styles.tabButtonTextActive]}>
            Subjects ({subjects.length})
          </Text>
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

      {tab === 'programs' ? (
        <FlatList
          data={programs}
          renderItem={renderProgram}
          keyExtractor={(item) => `program-${item.id}`}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <EmptyState
              icon="🏫"
              title="No programs yet"
              subtitle="Add a program (e.g. Hifz, Alimiyyah) to start organizing subjects under it."
              actionLabel="Add Program"
              onAction={() => (navigation as any).navigate('ProgramForm')}
              colors={theme}
            />
          }
        />
      ) : (
        <FlatList
          data={subjects}
          renderItem={renderSubject}
          keyExtractor={(item) => `subject-${item.id}`}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <EmptyState
              icon="📖"
              title="No subjects yet"
              subtitle="Add a subject to the catalog so it can be used in curricula and assigned to classes."
              actionLabel="Add Subject"
              onAction={() => (navigation as any).navigate('SubjectForm')}
              colors={theme}
            />
          }
        />
      )}
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

    tabRow: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingTop: 12,
      gap: 8,
    },
    tabButton: {
      flex: 1,
      paddingVertical: 9,
      borderRadius: RADIUS.sm,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      alignItems: 'center',
    },
    tabButtonActive: { backgroundColor: theme.accentSoft, borderColor: theme.accent },
    tabButtonText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
    tabButtonTextActive: { color: theme.accentSoftText },

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
