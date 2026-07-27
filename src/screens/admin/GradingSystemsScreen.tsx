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
  GradingSystem,
  fetchGradingSystems,
  deleteGradingSystem,
} from '../../services/adminAcademicCatalogService';

/**
 * Admin: spec §4.9 Grading System Builder. Mirrors AcademicYearsScreen /
 * EnrollmentStagesScreen's structure/styling so it reads as the same
 * Academic Management module.
 *
 * The backend (AcademicCatalogController) and its routes already existed
 * before this screen - this is purely the RN consumer for it, per §9 step 4
 * "Admin curriculum, subjects, programs, grading, assessments, policies,
 * attendance."
 */

function IconChevronLeft({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Polyline points="15 5 8 12 15 19" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const TYPE_LABELS: Record<string, string> = {
  percentage: 'Percentage',
  letter: 'Letter Grade',
  gpa: 'GPA',
  competency: 'Competency',
  pass_fail: 'Pass / Fail',
  memorization: 'Memorization',
  behavior: 'Behavior',
  attendance: 'Attendance',
  oral: 'Oral',
  written: 'Written',
  practical: 'Practical',
  islamic_studies: 'Islamic Studies',
  arabic: 'Arabic',
  custom: 'Custom',
};

export default function GradingSystemsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const theme = useAcademicGlassTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { token } = useAuth();

  const [systems, setSystems] = useState<GradingSystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      const data = await fetchGradingSystems(token);
      setSystems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load grading systems.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleDelete = (system: GradingSystem) => {
    Alert.alert(
      'Delete Grading System',
      `Delete "${system.name}"? This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!token) return;
            try {
              await deleteGradingSystem(token, system.id);
              load();
            } catch (err) {
              // Backend blocks deletion while grade scales still exist under
              // it - surface that message as-is, same convention as
              // AcademicYearsScreen's delete-in-use handling.
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to delete grading system.');
            }
          },
        },
      ]
    );
  };

  const renderSystem = ({ item }: { item: GradingSystem }) => {
    const scale = item.current_scale;
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.card}
        onPress={() =>
          (navigation as any).navigate('GradeScaleBuilder', {
            gradingSystemId: item.id,
            gradingSystemName: item.name,
          })
        }
      >
        <View style={styles.cardHeader}>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          {item.is_default ? (
            <View style={styles.defaultBadge}>
              <Text style={styles.defaultBadgeText}>Default</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.metaRow}>
          <View style={styles.typeChip}>
            <Text style={styles.typeChipText}>{TYPE_LABELS[item.type] ?? item.type}</Text>
          </View>
          {item.status === 'inactive' ? (
            <View style={styles.inactiveChip}>
              <Text style={styles.inactiveChipText}>Inactive</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.scaleStatus}>
          {scale
            ? `Scale "${scale.name}" v${scale.version} · ${scale.bands?.length ?? 0} bands`
            : 'No grade scale defined yet'}
        </Text>

        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() =>
              (navigation as any).navigate('GradingSystemForm', { gradingSystemId: item.id })
            }
          >
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item)}>
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
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
          <Text style={[styles.headerTitle, styles.headerTitleFlex]}>Grading Systems</Text>
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
        <Text style={[styles.headerTitle, styles.headerTitleFlex]}>Grading Systems</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => (navigation as any).navigate('GradingSystemForm')}
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

      <Text style={styles.helperText}>
        Define how grades are computed and labeled. Tap a system to build or version its grade scale.
      </Text>

      <FlatList
        data={systems}
        renderItem={renderSystem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <EmptyState
            icon="🎓"
            title="No grading systems yet"
            subtitle="Add a grading system (e.g. Percentage, GPA) to start building grade scales."
            actionLabel="Add Grading System"
            onAction={() => (navigation as any).navigate('GradingSystemForm')}
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
      marginBottom: 8,
    },
    name: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, flex: 1, marginRight: 8 },
    defaultBadge: {
      backgroundColor: theme.accentSoft,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 6,
    },
    defaultBadgeText: { fontSize: 11, fontWeight: '700', color: theme.accentSoftText },

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
