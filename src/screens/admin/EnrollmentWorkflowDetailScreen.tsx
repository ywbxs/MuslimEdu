import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  FlatList,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polyline } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { useAcademicGlassTheme, AcademicGlassTheme } from '../teachers/academicGlassTheme';
import { RADIUS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';
import {
  WorkflowRecord,
  WorkflowHistoryEntry,
  WorkflowStage,
  fetchEnrollmentWorkflowHistory,
  fetchEnrollmentStages,
  advanceEnrollmentWorkflow,
  withdrawEnrollmentWorkflow,
} from '../../services/enrollmentWorkflowService';

/**
 * Admin: one student's enrollment-workflow record - current stage, full
 * (unstripped) history with notes and who changed it, and the two actions
 * the backend supports: advance to any stage (deliberately not "next stage
 * only" - see controller comment, real admissions send people back a stage
 * often) and withdraw.
 *
 * This is the admin counterpart to the student-facing read screen
 * (student_enrollment_workflow_status) - that one hides `notes` and
 * `changed_by`; this one shows both, since it's the admin's own audit view.
 */

function IconChevronLeft({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Polyline points="15 5 8 12 15 19" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const WORKFLOW_STATUS_FALLBACKS: Record<string, string> = {
  in_progress: 'in progress',
  completed: 'completed',
  withdrawn: 'withdrawn',
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

export default function EnrollmentWorkflowDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const theme = useAcademicGlassTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { token } = useAuth();
  const { t } = useLocale();
  const workflowStatusLabel = (s: string) => t(`enrollment_workflow_detail.status_${s}`, WORKFLOW_STATUS_FALLBACKS[s] ?? s.replace('_', ' '));

  const recordId: number = route.params?.recordId;

  const [record, setRecord] = useState<WorkflowRecord | null>(null);
  const [history, setHistory] = useState<WorkflowHistoryEntry[]>([]);
  const [stages, setStages] = useState<WorkflowStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [advanceModalVisible, setAdvanceModalVisible] = useState(false);

  const load = useCallback(async () => {
    if (!token || !recordId) return;
    try {
      setError(null);
      const [historyData, stagesData] = await Promise.all([
        fetchEnrollmentWorkflowHistory(token, recordId),
        fetchEnrollmentStages(token, 'active'),
      ]);
      setRecord(historyData.record);
      setHistory(historyData.history);
      setStages(stagesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('enrollment_workflow_detail.load_error', 'Failed to load this record.'));
    } finally {
      setLoading(false);
    }
  }, [token, recordId, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onAdvance = async (stage: WorkflowStage) => {
    if (!token || !record) return;
    setBusy(true);
    try {
      await advanceEnrollmentWorkflow(token, record.id, stage.id);
      setAdvanceModalVisible(false);
      load();
    } catch (err) {
      Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('enrollment_workflow_detail.advance_error', 'Could not update the stage.'));
    } finally {
      setBusy(false);
    }
  };

  const onWithdraw = () => {
    if (!record) return;
    Alert.alert(
      t('enrollment_workflow_detail.withdraw_title', 'Withdraw Student'),
      t(
        'enrollment_workflow_detail.withdraw_message',
        'Withdraw {name} from the enrollment workflow? A new workflow must be started to re-enter them.',
      ).replace('{name}', record.student?.name ?? t('enrollment_workflow_detail.this_student', 'this student')),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('enrollment_workflow_detail.withdraw', 'Withdraw'),
          style: 'destructive',
          onPress: async () => {
            if (!token || !record) return;
            setBusy(true);
            try {
              await withdrawEnrollmentWorkflow(token, record.id);
              load();
            } catch (err) {
              Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('enrollment_workflow_detail.withdraw_error', 'Could not withdraw the student.'));
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
            <IconChevronLeft color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, styles.headerTitleFlex]}>{t('enrollment_workflow_detail.title', 'Enrollment Record')}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator color={theme.accent} />
        </View>
      </View>
    );
  }

  if (error || !record) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
            <IconChevronLeft color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, styles.headerTitleFlex]}>{t('enrollment_workflow_detail.title', 'Enrollment Record')}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error ?? t('enrollment_workflow_detail.not_found', 'Record not found.')}</Text>
          <TouchableOpacity onPress={load}>
            <Text style={styles.retryText}>{t('common.retry', 'Retry')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isInProgress = record.status === 'in_progress';
  const statusColor = record.status === 'completed' ? theme.success : record.status === 'withdrawn' ? theme.danger : theme.accent;
  const statusBg = record.status === 'completed' ? theme.successSoft : record.status === 'withdrawn' ? theme.dangerSoft : theme.accentSoft;

  return (
    <View style={styles.container}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
          <IconChevronLeft color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, styles.headerTitleFlex]}>Enrollment Record</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.summaryCard}>
          <Text style={styles.studentName}>
            {record.student?.name ?? t('enrollment_workflow_detail.student_fallback', 'Student #{id}').replace('{id}', String(record.user_id))}
          </Text>
          <Text style={[styles.statusBadge, { color: statusColor, backgroundColor: statusBg }]}>
            {workflowStatusLabel(record.status)}
          </Text>
          <Text style={styles.currentStageLabel}>{t('enrollment_workflow_detail.current_stage', 'CURRENT STAGE')}</Text>
          <Text style={styles.currentStageValue}>{record.currentStage?.name ?? '—'}</Text>
          {record.notes ? (
            <>
              <Text style={styles.currentStageLabel}>{t('enrollment_workflow_detail.notes', 'NOTES')}</Text>
              <Text style={styles.notesText}>{record.notes}</Text>
            </>
          ) : null}
        </View>

        {isInProgress ? (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.advanceButton]}
              onPress={() => setAdvanceModalVisible(true)}
              disabled={busy}
            >
              <Text style={styles.advanceButtonText}>{t('enrollment_workflow_detail.move_to_stage', 'Move to Stage...')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.withdrawButton]}
              onPress={onWithdraw}
              disabled={busy}
            >
              <Text style={styles.withdrawButtonText}>{t('enrollment_workflow_detail.withdraw', 'Withdraw')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>{t('enrollment_workflow_detail.history', 'History')}</Text>
        {history.length === 0 ? (
          <Text style={styles.emptyHistoryText}>{t('enrollment_workflow_detail.no_history', 'No stage changes recorded yet.')}</Text>
        ) : (
          history
            .slice()
            .reverse()
            .map((h, i) => (
              <View key={i} style={styles.historyRow}>
                <View style={styles.historyDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyText}>
                    {h.fromStage?.name ?? t('enrollment_workflow_detail.started', 'Started')} <Text style={styles.historyArrow}>→</Text>{' '}
                    {h.toStage?.name ?? '—'}
                  </Text>
                  <Text style={styles.historyMeta}>
                    {formatDate(h.created_at)}
                    {h.changedByUser?.name ? ` · ${t('enrollment_workflow_detail.by', 'by')} ${h.changedByUser.name}` : ''}
                  </Text>
                  {h.notes ? <Text style={styles.historyNotes}>{h.notes}</Text> : null}
                </View>
              </View>
            ))
        )}
      </ScrollView>

      <Modal
        visible={advanceModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAdvanceModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('enrollment_workflow_detail.move_to_stage_title', 'Move to Stage')}</Text>
            <FlatList
              data={stages}
              keyExtractor={(s) => s.id.toString()}
              style={{ maxHeight: 320 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  disabled={busy || item.id === record.current_stage_id}
                  onPress={() => onAdvance(item)}
                >
                  <Text
                    style={[
                      styles.modalItemText,
                      item.id === record.current_stage_id && { color: theme.textMuted },
                    ]}
                  >
                    {item.name}
                    {item.id === record.current_stage_id ? ` ${t('enrollment_workflow_detail.current_suffix', '(current)')}` : ''}
                  </Text>
                  {busy ? <ActivityIndicator size="small" color={theme.accent} /> : null}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setAdvanceModalVisible(false)}>
              <Text style={styles.modalCloseText}>{t('common.close', 'Close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
    errorText: { color: theme.danger, fontSize: 14, textAlign: 'center', marginBottom: 12 },
    retryText: { color: theme.accent, fontWeight: '700', fontSize: 14 },

    content: { padding: 20 },
    summaryCard: {
      backgroundColor: theme.surface,
      borderRadius: RADIUS.lg,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.border,
      ...theme.elevation2,
    },
    studentName: { fontSize: 19, fontWeight: '800', color: theme.textPrimary, marginBottom: 8 },
    statusBadge: {
      alignSelf: 'flex-start',
      fontSize: 11,
      fontWeight: '600',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 12,
      overflow: 'hidden',
      textTransform: 'capitalize',
      marginBottom: 16,
    },
    currentStageLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.textSecondary,
      letterSpacing: 0.6,
      marginBottom: 4,
      marginTop: 8,
    },
    currentStageValue: { fontSize: 17, fontWeight: '700', color: theme.accent },
    notesText: { fontSize: 13.5, color: theme.textPrimary, lineHeight: 19 },

    actionsRow: { flexDirection: 'row', marginTop: 16, gap: 10 },
    actionButton: {
      flex: 1,
      height: 46,
      borderRadius: RADIUS.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    advanceButton: { backgroundColor: theme.accent },
    advanceButtonText: { color: theme.onAccent, fontWeight: '700', fontSize: 14 },
    withdrawButton: { borderWidth: 1, borderColor: theme.dangerSoft },
    withdrawButtonText: { color: theme.danger, fontWeight: '700', fontSize: 14 },

    sectionLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginTop: 28,
      marginBottom: 12,
    },
    emptyHistoryText: { fontSize: 13.5, color: theme.textSecondary },
    historyRow: { flexDirection: 'row', marginBottom: 18 },
    historyDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.accent,
      marginTop: 6,
      marginRight: 12,
    },
    historyText: { fontSize: 14, fontWeight: '600', color: theme.textPrimary },
    historyArrow: { color: theme.textMuted },
    historyMeta: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
    historyNotes: { fontSize: 12.5, color: theme.textSecondary, marginTop: 4, fontStyle: 'italic' },

    modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
    modalContent: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: RADIUS.lg,
      borderTopRightRadius: RADIUS.lg,
      padding: 20,
      maxHeight: '80%',
    },
    modalTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary, marginBottom: 14 },
    modalItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    modalItemText: { fontSize: 15, color: theme.textPrimary },
    modalCloseButton: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
    modalCloseText: { fontSize: 14.5, fontWeight: '600', color: theme.textSecondary },
  });
