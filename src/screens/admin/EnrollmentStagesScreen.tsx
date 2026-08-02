import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  StyleSheet,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polyline, Path, Circle } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { useAcademicGlassTheme, AcademicGlassTheme } from '../teachers/academicGlassTheme';
import { RADIUS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';
import { Skeleton } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import BottomNavBar from '../../components/BottomNavBar';
import {
  WorkflowStage,
  fetchEnrollmentStages,
  deleteEnrollmentStage,
  reorderEnrollmentStages,
} from '../../services/enrollmentWorkflowService';

/**
 * Admin: spec §4.16 Enrollment Workflow Management - the stage builder.
 * Configures the per-school ordered pipeline (e.g. Admission -> Cashier ->
 * ... -> Officially Enrolled) that EnrollmentStageFormScreen creates/edits
 * one stage of, and that the student-facing EnrollmentStatusScreen reads
 * (via student_enrollment_workflow_status) to render its stepper.
 *
 * Reordering: no drag-and-drop library is present in this project, so
 * reordering is up/down arrows per row. Each tap sends the FULL resulting
 * id order to admin_enrollment_stages_reorder in one call, matching how
 * the backend expects it (see controller comment - built for exactly this:
 * "simpler than N individual _update calls from a drag-and-drop screen").
 *
 * Mirrors DepartmentListScreen.tsx's structure/styling (header, search-less
 * list, skeleton cards, EmptyState, BottomNavBar) so it reads as the same
 * Academic Management module.
 */

function IconChevronLeft({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Polyline points="15 5 8 12 15 19" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconChevronUp({ color, disabled }: { color: string; disabled?: boolean }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" opacity={disabled ? 0.3 : 1}>
      <Polyline points="6 15 12 9 18 15" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconChevronDown({ color, disabled }: { color: string; disabled?: boolean }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" opacity={disabled ? 0.3 : 1}>
      <Polyline points="6 9 12 15 18 9" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconFlag({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path d="M5 21V4M5 4h12l-3 4 3 4H5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function approverLabel(role: WorkflowStage['approver_role'], t: (key: string, fallback: string) => string): string | null {
  if (role === 'accountant') return t('enrollment_stages.approver_cashier', 'Approver: Cashier');
  if (role === 'registrar') return t('enrollment_stages.approver_registrar', 'Approver: Registrar');
  return null;
}

export default function EnrollmentStagesScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const theme = useAcademicGlassTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { token } = useAuth();
  const { t } = useLocale();

  const [stages, setStages] = useState<WorkflowStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reorderingId, setReorderingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      const data = await fetchEnrollmentStages(token);
      setStages(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('enrollment_stages.load_error', 'Failed to load stages.'));
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const move = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= stages.length || !token) return;

    const reordered = [...stages];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];

    // Optimistic swap so the tap feels instant; reconciled with the
    // server's response (or reverted) right after.
    setStages(reordered);
    setReorderingId(reordered[targetIndex].id);
    try {
      const saved = await reorderEnrollmentStages(token, reordered.map((s) => s.id));
      setStages(saved);
    } catch (err) {
      setStages(stages); // revert on failure
      Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('enrollment_stages.reorder_error', 'Could not reorder stages.'));
    } finally {
      setReorderingId(null);
    }
  };

  const handleDelete = (stage: WorkflowStage) => {
    Alert.alert(
      t('enrollment_stages.delete_title', 'Delete Stage'),
      t('enrollment_stages.delete_message', 'Delete "{name}"? This can\'t be undone.').replace('{name}', stage.name),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('enrollment_stages.delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            if (!token) return;
            try {
              await deleteEnrollmentStage(token, stage.id);
              load();
            } catch (err) {
              // The backend deliberately blocks deletion when the stage is
              // in use (students currently on it, or in history) and asks
              // for deactivation instead - surface that message as-is.
              Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('enrollment_stages.delete_error', 'Failed to delete stage.'));
            }
          },
        },
      ]
    );
  };

  const renderStage = ({ item, index }: { item: WorkflowStage; index: number }) => {
    const isActive = item.status === 'active';
    const busy = reorderingId === item.id;
    const approver = approverLabel(item.approver_role, t);
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => (navigation as any).navigate('EnrollmentStageForm', { stageId: item.id })}
      >
        <View style={styles.orderCol}>
          <TouchableOpacity
            hitSlop={8}
            disabled={index === 0 || busy}
            onPress={() => move(index, -1)}
          >
            <IconChevronUp color={theme.textSecondary} disabled={index === 0 || busy} />
          </TouchableOpacity>
          <Text style={styles.orderNum}>{index + 1}</Text>
          <TouchableOpacity
            hitSlop={8}
            disabled={index === stages.length - 1 || busy}
            onPress={() => move(index, 1)}
          >
            <IconChevronDown color={theme.textSecondary} disabled={index === stages.length - 1 || busy} />
          </TouchableOpacity>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.cardHeader}>
            {item.code ? (
              <View style={styles.codeBadge}>
                <Text style={styles.codeText}>{item.code}</Text>
              </View>
            ) : (
              <View />
            )}
            <Text
              style={[
                styles.statusBadgeText,
                {
                  color: isActive ? theme.accent : theme.textSecondary,
                  backgroundColor: isActive ? theme.accentSoft : theme.surfaceVariant,
                },
              ]}
            >
              {item.status}
            </Text>
          </View>

          <Text style={styles.name}>{item.name}</Text>

          {approver ? (
            <View style={styles.approverBadge}>
              <Text style={styles.approverBadgeText}>{approver}</Text>
            </View>
          ) : null}

          {item.is_terminal ? (
            <View style={styles.terminalRow}>
              <IconFlag color={theme.accent} />
              <Text style={styles.terminalText}>{t('enrollment_stages.final_stage', 'Final stage - completes the workflow')}</Text>
            </View>
          ) : null}

          <View style={styles.cardFooter}>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDelete(item)}
            >
              <Text style={styles.deleteButtonText}>{t('enrollment_stages.delete', 'Delete')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSkeletonCard = (key: number) => (
    <View key={key} style={styles.card}>
      <View style={styles.orderCol}>
        <Skeleton width={18} height={18} borderRadius={4} baseColor={theme.skeletonBase} />
        <Skeleton width={16} height={16} borderRadius={8} style={{ marginVertical: 8 }} baseColor={theme.skeletonBase} />
        <Skeleton width={18} height={18} borderRadius={4} baseColor={theme.skeletonBase} />
      </View>
      <View style={styles.cardBody}>
        <Skeleton width={60} height={18} borderRadius={6} style={{ marginBottom: 10 }} baseColor={theme.skeletonBase} />
        <Skeleton width="55%" height={18} baseColor={theme.skeletonBase} />
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
            <IconChevronLeft color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, styles.headerTitleFlex]}>{t('enrollment_stages.title', 'Enrollment Stages')}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.listContainer}>{[0, 1, 2, 3].map(renderSkeletonCard)}</View>
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
        <Text style={[styles.headerTitle, styles.headerTitleFlex]}>Enrollment Stages</Text>
        <TouchableOpacity
          style={styles.studentsButton}
          onPress={() => (navigation as any).navigate('EnrollmentFeeTypes')}
        >
          <Text style={styles.studentsButtonText}>{t('enrollment_stages.fees', 'Fees')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.studentsButton}
          onPress={() => (navigation as any).navigate('EnrollmentWorkflowList')}
        >
          <Text style={styles.studentsButtonText}>{t('enrollment_stages.students', 'Students')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => (navigation as any).navigate('EnrollmentStageForm')}
        >
          <Text style={styles.addButtonText}>{t('enrollment_stages.add', '+ Add')}</Text>
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
        {t('enrollment_stages.helper', 'Students move through these stages in order, top to bottom. Use the arrows to reorder.')}
      </Text>

      <FlatList
        style={{ flex: 1 }}
        data={stages}
        renderItem={renderStage}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <EmptyState
            icon="🧭"
            title={t('enrollment_stages.empty_title', 'No enrollment stages yet')}
            subtitle={t('enrollment_stages.empty_subtitle', 'Add your first stage (e.g. Admission) to start building the workflow.')}
            actionLabel={t('enrollment_stages.empty_action', 'Add Stage')}
            onAction={() => (navigation as any).navigate('EnrollmentStageForm')}
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
    studentsButton: {
      borderWidth: 1,
      borderColor: theme.borderStrong,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 6,
      marginRight: 8,
    },
    studentsButtonText: { color: theme.textPrimary, fontWeight: '600', fontSize: 13 },

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
      flexDirection: 'row',
      backgroundColor: theme.surface,
      borderRadius: RADIUS.lg,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
      ...theme.elevation2,
    },
    orderCol: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 34,
      marginRight: 10,
    },
    orderNum: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.textSecondary,
      marginVertical: 4,
    },
    cardBody: { flex: 1 },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    codeBadge: {
      backgroundColor: theme.accentSoft,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
    },
    codeText: { fontSize: 12, fontWeight: '700', color: theme.accentSoftText },
    statusBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
      overflow: 'hidden',
    },
    name: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, marginBottom: 4 },
    approverBadge: {
      alignSelf: 'flex-start',
      backgroundColor: theme.surfaceVariant,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      marginBottom: 8,
    },
    approverBadgeText: { fontSize: 11, fontWeight: '600', color: theme.textSecondary },
    terminalRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    terminalText: { fontSize: 11.5, color: theme.textSecondary, marginLeft: 6 },
    cardFooter: { flexDirection: 'row', justifyContent: 'flex-end' },
    deleteButton: {
      borderWidth: 1,
      borderColor: theme.dangerSoft,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
    },
    deleteButtonText: { color: theme.danger, fontSize: 12, fontWeight: '600' },
  });
