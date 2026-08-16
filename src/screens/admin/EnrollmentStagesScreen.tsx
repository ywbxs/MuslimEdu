import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronUp, ChevronDown, Flag, Milestone } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { useAcademicGlassTheme, AcademicGlassTheme } from '../teachers/academicGlassTheme';
import { RADIUS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';
import { BentoGrid } from '../../components/glass/BentoGridCard';
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
 * Bento grid: each stage is a spatial tile (icon, order badge, reorder
 * arrows, approver/terminal tags) in a wrapping 2-column grid, same visual
 * language as BentoGridCard/BentoOptionGrid used elsewhere in this module -
 * replaces the earlier flat single-column row list.
 *
 * Reordering: no drag-and-drop library is present in this project, so
 * reordering is up/down arrows per tile. Each tap sends the FULL resulting
 * id order to admin_enrollment_stages_reorder in one call.
 */

function IconChevronLeft({ color }: { color: string }) {
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}
function IconChevronUp({ color, disabled }: { color: string; disabled?: boolean }) {
  return <ChevronUp size={16} color={color} strokeWidth={2.2} opacity={disabled ? 0.3 : 1} />;
}
function IconChevronDown({ color, disabled }: { color: string; disabled?: boolean }) {
  return <ChevronDown size={16} color={color} strokeWidth={2.2} opacity={disabled ? 0.3 : 1} />;
}
function IconFlag({ color }: { color: string }) {
  return <Flag size={22} color={color} strokeWidth={2} />;
}
function IconMilestone({ color }: { color: string }) {
  return <Milestone size={22} color={color} strokeWidth={2} />;
}

function approverLabel(role: WorkflowStage['approver_role'], t: (key: string, fallback: string) => string): string | null {
  if (role === 'accountant') return t('enrollment_stages.approver_cashier', 'Cashier');
  if (role === 'registrar') return t('enrollment_stages.approver_registrar', 'Registrar');
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

    setStages(reordered);
    setReorderingId(reordered[targetIndex].id);
    try {
      const saved = await reorderEnrollmentStages(token, reordered.map((s) => s.id));
      setStages(saved);
    } catch (err) {
      setStages(stages);
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
              Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('enrollment_stages.delete_error', 'Failed to delete stage.'));
            }
          },
        },
      ]
    );
  };

  const renderStage = (item: WorkflowStage, index: number) => {
    const isActive = item.status === 'active';
    const busy = reorderingId === item.id;
    const approver = approverLabel(item.approver_role, t);
    return (
      <TouchableOpacity
        key={item.id}
        style={styles.tile}
        activeOpacity={0.85}
        onPress={() => (navigation as any).navigate('EnrollmentStageForm', { stageId: item.id })}
      >
        <View style={styles.tileTop}>
          <View style={[styles.iconWrap, item.is_terminal && { backgroundColor: theme.accent }]}>
            {item.is_terminal ? <IconFlag color={theme.onAccent} /> : <IconMilestone color={theme.accent} />}
          </View>
          <View style={styles.reorderCol}>
            <TouchableOpacity hitSlop={8} disabled={index === 0 || busy} onPress={() => move(index, -1)}>
              <IconChevronUp color={theme.textSecondary} disabled={index === 0 || busy} />
            </TouchableOpacity>
            <Text style={styles.orderNum}>{index + 1}</Text>
            <TouchableOpacity hitSlop={8} disabled={index === stages.length - 1 || busy} onPress={() => move(index, 1)}>
              <IconChevronDown color={theme.textSecondary} disabled={index === stages.length - 1 || busy} />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.name} numberOfLines={2}>
          {item.name}
        </Text>

        <View style={styles.tagRow}>
          {item.code ? (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{item.code}</Text>
            </View>
          ) : null}
          {approver ? (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{approver}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.tileFooter}>
          <Text
            style={[
              styles.statusBadgeText,
              { color: isActive ? theme.accent : theme.textSecondary, backgroundColor: isActive ? theme.accentSoft : theme.surfaceVariant },
            ]}
          >
            {item.status}
          </Text>
          <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={6}>
            <Text style={styles.deleteText}>{t('enrollment_stages.delete', 'Delete')}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSkeletonCard = (key: number) => (
    <View key={key} style={[styles.tile, { justifyContent: 'center' }]}>
      <Skeleton width={42} height={42} borderRadius={21} style={{ marginBottom: 12 }} baseColor={theme.skeletonBase} />
      <Skeleton width="70%" height={16} borderRadius={6} style={{ marginBottom: 8 }} baseColor={theme.skeletonBase} />
      <Skeleton width="45%" height={12} baseColor={theme.skeletonBase} />
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
        <BentoGrid>{[0, 1, 2, 3].map(renderSkeletonCard)}</BentoGrid>
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
        <Text style={[styles.headerTitle, styles.headerTitleFlex]}>{t('enrollment_stages.title', 'Enrollment Stages')}</Text>
        <TouchableOpacity style={styles.pillButton} onPress={() => (navigation as any).navigate('EnrollmentFeeTypes')}>
          <Text style={styles.pillButtonText}>{t('enrollment_stages.fees', 'Fees')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.pillButton} onPress={() => (navigation as any).navigate('EnrollmentWorkflowList')}>
          <Text style={styles.pillButtonText}>{t('enrollment_stages.students', 'Students')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addButton} onPress={() => (navigation as any).navigate('EnrollmentStageForm')}>
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
        {t('enrollment_stages.helper', 'Students move through these stages in order. Use the arrows on each tile to reorder.')}
      </Text>

      <ScrollView style={{ flex: 1 }}>
        {stages.length === 0 ? (
          <EmptyState
            icon="🧭"
            title={t('enrollment_stages.empty_title', 'No enrollment stages yet')}
            subtitle={t('enrollment_stages.empty_subtitle', 'Add your first stage (e.g. Admission) to start building the workflow.')}
            actionLabel={t('enrollment_stages.empty_action', 'Add Stage')}
            onAction={() => (navigation as any).navigate('EnrollmentStageForm')}
            colors={theme}
          />
        ) : (
          <BentoGrid>{stages.map(renderStage)}</BentoGrid>
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
    headerTitle: { fontSize: 22, fontWeight: '700', color: theme.textPrimary },
    headerTitleFlex: { flex: 1, marginLeft: 8 },
    backButton: { width: 32 },
    headerSpacer: { width: 32 },
    addButton: { backgroundColor: theme.accent, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
    addButtonText: { color: theme.onAccent, fontWeight: '600', fontSize: 14 },
    pillButton: { borderWidth: 1, borderColor: theme.borderStrong, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, marginRight: 8 },
    pillButtonText: { color: theme.textPrimary, fontWeight: '600', fontSize: 13 },

    helperText: { fontSize: 12.5, color: theme.textSecondary, paddingHorizontal: 16, paddingTop: 12, lineHeight: 18 },

    errorBanner: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: theme.dangerSoft,
      marginHorizontal: 16,
      marginTop: 12,
      padding: 12,
      borderRadius: RADIUS.md,
    },
    errorBannerText: { color: theme.danger, fontSize: 13, flex: 1, marginRight: 8 },
    retryText: { color: theme.danger, fontWeight: '700', fontSize: 13 },

    tile: {
      width: '47%',
      minHeight: 180,
      backgroundColor: theme.surface,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      ...theme.elevation2,
    },
    tileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
    iconWrap: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: theme.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    reorderCol: { alignItems: 'center' },
    orderNum: { fontSize: 11.5, fontWeight: '700', color: theme.textSecondary, marginVertical: 2 },
    name: { fontSize: 15, fontWeight: '700', color: theme.textPrimary, marginBottom: 8 },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
    tag: { backgroundColor: theme.surfaceVariant, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    tagText: { fontSize: 10.5, fontWeight: '600', color: theme.textSecondary },
    tileFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' },
    statusBadgeText: { fontSize: 10.5, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, overflow: 'hidden' },
    deleteText: { color: theme.danger, fontSize: 11.5, fontWeight: '600' },
  });
