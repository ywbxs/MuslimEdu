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
  Image,
  TextInput,
  StyleSheet,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { launchImageLibrary } from 'react-native-image-picker';
import { ChevronLeft } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { can } from '../../services/permissions';
import { useAcademicGlassTheme, AcademicGlassTheme } from '../teachers/academicGlassTheme';
import { RADIUS } from '../../theme/glass';
import { absoluteUrl } from '../../config/api';
import GlassBackground from '../../components/glass/GlassBackground';
import {
  WorkflowRecord,
  WorkflowHistoryEntry,
  WorkflowStage,
  WorkflowPayment,
  PaymentStatus,
  PaymentMode,
  fetchEnrollmentWorkflowHistory,
  fetchEnrollmentStages,
  advanceEnrollmentWorkflow,
  withdrawEnrollmentWorkflow,
  placeEnrollmentWorkflowInSection,
  fetchWorkflowPayments,
  updateWorkflowPayment,
} from '../../services/enrollmentWorkflowService';
import { fetchClasses, fetchSections, ClassOption, SectionOption } from '../../services/adminService';

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
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}

const WORKFLOW_STATUS_FALLBACKS: Record<string, string> = {
  in_progress: 'in progress',
  completed: 'completed',
  withdrawn: 'withdrawn',
};

function formatMoney(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (Number.isNaN(num)) return null;
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

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
  const { token, user } = useAuth();
  const { t } = useLocale();
  // Withdrawing a student is an admin-only decision (see
  // admin_enrollment_workflow_withdraw's requireAdmin-only guard) - a
  // Registrar shares this screen but can only advance, not withdraw.
  const canWithdraw = can(user, 'manage_enrollment');
  const workflowStatusLabel = (s: string) => t(`enrollment_workflow_detail.status_${s}`, WORKFLOW_STATUS_FALLBACKS[s] ?? s.replace('_', ' '));

  // A cashier's job on this workflow is collecting payment and handing the
  // student off to the registrar - the backend now rejects any other
  // target stage for them (admin_enrollment_workflow_advance's cashier
  // gate), so only offer the registrar-owned stage(s) in the picker
  // instead of letting them pick something the server will just reject.
  const isCashier = user?.role === 'accountant';

  const recordId: number = route.params?.recordId;

  const [record, setRecord] = useState<WorkflowRecord | null>(null);
  const [history, setHistory] = useState<WorkflowHistoryEntry[]>([]);
  const [stages, setStages] = useState<WorkflowStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [advanceModalVisible, setAdvanceModalVisible] = useState(false);

  // "Place in Section" - the step that actually creates the roster
  // Enrollment row once a workflow record is completed (see
  // placeEnrollmentWorkflowInSection). Two-step picker: class, then section.
  const [placeModalVisible, setPlaceModalVisible] = useState(false);
  const [placeStep, setPlaceStep] = useState<'class' | 'section'>('class');
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassOption | null>(null);
  const [placing, setPlacing] = useState(false);

  // Fee checklist ("recibo") - what this student owes and has paid, shown
  // and edited right on this screen so the approver sees it before tapping
  // "Move to Stage" into the terminal stage (which the backend also gates
  // on - see admin_enrollment_workflow_advance's recibo-gate comment).
  const [payments, setPayments] = useState<WorkflowPayment[]>([]);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [activePayment, setActivePayment] = useState<WorkflowPayment | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('unpaid');
  const [paymentMode, setPaymentMode] = useState<PaymentMode | null>(null);
  const [amount, setAmount] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [receiptPhoto, setReceiptPhoto] = useState<{ uri: string; fileName?: string; type?: string } | null>(null);
  const [savingPayment, setSavingPayment] = useState(false);

  const load = useCallback(async () => {
    if (!token || !recordId) return;
    try {
      setError(null);
      const [historyData, stagesData, paymentsData] = await Promise.all([
        fetchEnrollmentWorkflowHistory(token, recordId),
        fetchEnrollmentStages(token, 'active'),
        fetchWorkflowPayments(token, recordId),
      ]);
      setRecord(historyData.record);
      setHistory(historyData.history);
      setStages(stagesData);
      setPayments(paymentsData);
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

  const visibleStages = useMemo(
    () => (isCashier ? stages.filter((s) => s.approver_role === 'registrar') : stages),
    [stages, isCashier]
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

  const openPlaceModal = async () => {
    setPlaceStep('class');
    setSelectedClass(null);
    setSections([]);
    setPlaceModalVisible(true);
    if (classes.length === 0 && token) {
      try {
        setClasses(await fetchClasses(token));
      } catch (err) {
        Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('enrollment_workflow_detail.classes_error', 'Could not load classes.'));
      }
    }
  };

  const onPickClass = async (cls: ClassOption) => {
    if (!token) return;
    setSelectedClass(cls);
    setPlaceStep('section');
    setSectionsLoading(true);
    try {
      setSections(await fetchSections(token, String(cls.id)));
    } catch (err) {
      Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('enrollment_workflow_detail.sections_error', 'Could not load sections.'));
    } finally {
      setSectionsLoading(false);
    }
  };

  const onPickSection = async (section: SectionOption) => {
    if (!token || !record || !selectedClass) return;
    setPlacing(true);
    try {
      await placeEnrollmentWorkflowInSection(token, record.id, selectedClass.id, section.id);
      setPlaceModalVisible(false);
      // The success alert used to be the only thing that happened here -
      // `record` (and its class_name/section_name) never got refreshed, so
      // the screen kept showing "Not placed"/"Needs section" until the
      // admin navigated away and back. Reload the record so the newly
      // placed class/section shows up immediately.
      await load();
      Alert.alert(
        t('enrollment_workflow_detail.placed_title', 'Student Placed'),
        t('enrollment_workflow_detail.placed_message', '{name} has been added to {class} - {section}.')
          .replace('{name}', record.student?.name ?? t('enrollment_workflow_detail.this_student', 'this student'))
          .replace('{class}', selectedClass.name)
          .replace('{section}', section.name)
      );
    } catch (err) {
      Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('enrollment_workflow_detail.place_error', 'Could not place the student in that section.'));
    } finally {
      setPlacing(false);
    }
  };

  const openPaymentModal = (payment: WorkflowPayment) => {
    setActivePayment(payment);
    setPaymentStatus(payment.status);
    setPaymentMode(payment.payment_mode);
    // Prefill with whatever was actually recorded before; if nothing was
    // recorded yet, prefill with the admin's suggested amount for this fee
    // type so the cashier sees what to collect instead of a blank field.
    setAmount(payment.amount != null ? String(payment.amount) : payment.feeType?.amount != null ? String(payment.feeType.amount) : '');
    setReceiptNumber(payment.receipt_number ?? '');
    setReceiptPhoto(null);
    setPaymentModalVisible(true);
  };

  const pickReceiptPhoto = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1, quality: 0.8 });
    if (result.didCancel || result.errorCode || !result.assets?.[0]?.uri) return;
    const asset = result.assets[0];
    setReceiptPhoto({ uri: asset.uri as string, fileName: asset.fileName ?? undefined, type: asset.type ?? undefined });
  };

  const onSavePayment = async () => {
    if (!token || !record || !activePayment) return;
    const parsedAmount = amount.trim() ? Number(amount.trim()) : null;
    setSavingPayment(true);
    try {
      await updateWorkflowPayment(token, record.id, activePayment.fee_type_id, {
        status: paymentStatus,
        amount: Number.isNaN(parsedAmount) ? null : parsedAmount,
        payment_mode: paymentMode,
        receipt_number: receiptNumber.trim() || null,
        receiptPhoto,
      });
      setPaymentModalVisible(false);
      setPayments(await fetchWorkflowPayments(token, record.id));
    } catch (err) {
      Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('enrollment_workflow_detail.payment_save_error', 'Could not save this payment.'));
    } finally {
      setSavingPayment(false);
    }
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
          <Text style={styles.currentStageValue}>{record.current_stage?.name ?? '—'}</Text>
          {record.notes ? (
            <>
              <Text style={styles.currentStageLabel}>{t('enrollment_workflow_detail.notes', 'NOTES')}</Text>
              <Text style={styles.notesText}>{record.notes}</Text>
            </>
          ) : null}
        </View>

        {payments.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>{t('enrollment_workflow_detail.fees', 'Fees')}</Text>
            {(() => {
              // What's still owed: unpaid/waived-pending fees, using the
              // recorded amount if one was set, otherwise the admin's
              // suggested amount for that fee type - so the cashier sees a
              // running total to collect before they even open a fee row.
              const outstanding = payments.filter((p) => p.status === 'unpaid');
              const totalDue = outstanding.reduce((sum, p) => {
                const val = p.amount ?? p.feeType?.amount;
                const num = val != null ? parseFloat(String(val)) : 0;
                return sum + (Number.isNaN(num) ? 0 : num);
              }, 0);
              if (outstanding.length === 0) return null;
              return (
                <View style={styles.totalDueBanner}>
                  <Text style={styles.totalDueLabel}>
                    {t('enrollment_workflow_detail.total_due', 'Total due ({count} unpaid)').replace('{count}', String(outstanding.length))}
                  </Text>
                  <Text style={styles.totalDueValue}>{formatMoney(totalDue) ?? '0.00'}</Text>
                </View>
              );
            })()}
            {payments.map((payment) => {
              const feeName = payment.feeType?.name ?? t('enrollment_workflow_detail.fee_fallback', 'Fee');
              const statusColors =
                payment.status === 'paid'
                  ? { color: theme.success, bg: theme.successSoft }
                  : payment.status === 'waived'
                  ? { color: theme.accent, bg: theme.accentSoft }
                  : { color: theme.danger, bg: theme.dangerSoft };
              const displayAmount = formatMoney(payment.amount ?? payment.feeType?.amount);
              return (
                <TouchableOpacity key={payment.id} style={styles.feeRow} onPress={() => openPaymentModal(payment)}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.feeRowHeader}>
                      <Text style={styles.feeName}>{feeName}</Text>
                      {payment.feeType?.is_required ? (
                        <Text style={styles.feeRequiredTag}>{t('enrollment_workflow_detail.fee_required', 'Required')}</Text>
                      ) : null}
                    </View>
                    {displayAmount ? (
                      <Text style={styles.feeAmount}>
                        {displayAmount}
                        {payment.amount == null && payment.feeType?.amount != null
                          ? ` ${t('enrollment_workflow_detail.fee_suggested', '(suggested)')}`
                          : ''}
                      </Text>
                    ) : null}
                    {payment.payment_mode || payment.receipt_number ? (
                      <Text style={styles.feeMeta}>
                        {[
                          payment.payment_mode ? t(`enrollment_workflow_detail.mode_${payment.payment_mode}`, payment.payment_mode.replace('_', ' ')) : null,
                          payment.receipt_number ? `#${payment.receipt_number}` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    ) : null}
                    {payment.recordedBy?.name ? (
                      <Text style={styles.feeMeta}>
                        {t('enrollment_workflow_detail.recorded_by_prefix', 'Recorded by')} {payment.recordedBy.name}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[styles.feeStatusBadge, { color: statusColors.color, backgroundColor: statusColors.bg }]}>
                    {t(`enrollment_workflow_detail.payment_status_${payment.status}`, payment.status)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </>
        ) : null}

        {isInProgress ? (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.advanceButton]}
              onPress={() => setAdvanceModalVisible(true)}
              disabled={busy}
            >
              <Text style={styles.advanceButtonText}>{t('enrollment_workflow_detail.move_to_stage', 'Move to Stage...')}</Text>
            </TouchableOpacity>
            {canWithdraw ? (
              <TouchableOpacity
                style={[styles.actionButton, styles.withdrawButton]}
                onPress={onWithdraw}
                disabled={busy}
              >
                <Text style={styles.withdrawButtonText}>{t('enrollment_workflow_detail.withdraw', 'Withdraw')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {record.status === 'completed' ? (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.advanceButton]}
              onPress={openPlaceModal}
              disabled={busy || placing}
            >
              <Text style={styles.advanceButtonText}>{t('enrollment_workflow_detail.place_in_section', 'Place in Section...')}</Text>
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
                    {h.from_stage?.name ?? t('enrollment_workflow_detail.started', 'Started')} <Text style={styles.historyArrow}>→</Text>{' '}
                    {h.to_stage?.name ?? '—'}
                  </Text>
                  <Text style={styles.historyMeta}>
                    {formatDate(h.created_at)}
                    {h.changed_by_user?.name ? ` · ${t('enrollment_workflow_detail.by', 'by')} ${h.changed_by_user.name}` : ''}
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
            {isCashier ? (
              <Text style={styles.cashierHint}>
                {t('enrollment_workflow_detail.cashier_hint', 'As cashier, you can only hand this student off to the registrar once their required fees are settled.')}
              </Text>
            ) : null}
            <FlatList
              data={visibleStages}
              keyExtractor={(s) => s.id.toString()}
              style={{ maxHeight: 320 }}
              ListEmptyComponent={
                isCashier ? (
                  <Text style={styles.modalEmptyText}>
                    {t('enrollment_workflow_detail.no_registrar_stage', 'No registrar stage is configured for this school yet.')}
                  </Text>
                ) : null
              }
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

      <Modal
        visible={placeModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPlaceModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {placeStep === 'class'
                ? t('enrollment_workflow_detail.pick_class_title', 'Select Class')
                : t('enrollment_workflow_detail.pick_section_title', 'Select Section')}
            </Text>
            {placeStep === 'section' ? (
              <TouchableOpacity onPress={() => setPlaceStep('class')} style={{ marginBottom: 8 }}>
                <Text style={styles.retryText}>{t('enrollment_workflow_detail.change_class', '‹ Change class')}</Text>
              </TouchableOpacity>
            ) : null}
            {placeStep === 'section' && sectionsLoading ? (
              <ActivityIndicator color={theme.accent} style={{ marginVertical: 20 }} />
            ) : (
              <FlatList
                data={placeStep === 'class' ? classes : sections}
                keyExtractor={(item) => item.id.toString()}
                style={{ maxHeight: 320 }}
                ListEmptyComponent={
                  <Text style={styles.emptyHistoryText}>
                    {placeStep === 'class'
                      ? t('enrollment_workflow_detail.no_classes', 'No classes found.')
                      : t('enrollment_workflow_detail.no_sections', 'No sections found for this class.')}
                  </Text>
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.modalItem}
                    disabled={placing}
                    onPress={() => (placeStep === 'class' ? onPickClass(item as ClassOption) : onPickSection(item as SectionOption))}
                  >
                    <Text style={styles.modalItemText}>{item.name}</Text>
                    {placing ? <ActivityIndicator size="small" color={theme.accent} /> : null}
                  </TouchableOpacity>
                )}
              />
            )}
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setPlaceModalVisible(false)}>
              <Text style={styles.modalCloseText}>{t('common.close', 'Close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={paymentModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPaymentModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <ScrollView style={styles.modalContent} contentContainerStyle={{ paddingBottom: 8 }}>
            <Text style={styles.modalTitle}>{activePayment?.feeType?.name ?? t('enrollment_workflow_detail.fee_fallback', 'Fee')}</Text>

            <Text style={styles.label}>{t('enrollment_workflow_detail.payment_status_label', 'Status')}</Text>
            <View style={styles.chipRow}>
              {(['unpaid', 'paid', 'waived'] as PaymentStatus[]).map((s) => {
                const selected = paymentStatus === s;
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, selected && { backgroundColor: theme.accent, borderColor: theme.accent }]}
                    onPress={() => setPaymentStatus(s)}
                  >
                    <Text style={[styles.chipText, selected && { color: theme.onAccent }]}>
                      {t(`enrollment_workflow_detail.payment_status_${s}`, s)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>{t('enrollment_workflow_detail.amount_label', 'Amount')}</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              placeholder={
                activePayment?.feeType?.amount != null
                  ? String(activePayment.feeType.amount)
                  : t('enrollment_workflow_detail.amount_placeholder', 'e.g. 5000')
              }
              placeholderTextColor={theme.textMuted}
              keyboardType="decimal-pad"
            />
            {activePayment?.feeType?.amount != null ? (
              <Text style={styles.amountHint}>
                {t('enrollment_workflow_detail.amount_suggested_hint', "School's suggested amount: {amount}").replace(
                  '{amount}',
                  formatMoney(activePayment.feeType.amount) ?? String(activePayment.feeType.amount)
                )}
              </Text>
            ) : null}

            <Text style={styles.label}>{t('enrollment_workflow_detail.payment_mode_label', 'Payment Mode')}</Text>
            <View style={styles.chipRow}>
              {(['cash', 'bank_transfer', 'gcash', 'check', 'other'] as PaymentMode[]).map((m) => {
                const selected = paymentMode === m;
                return (
                  <TouchableOpacity
                    key={m}
                    style={[styles.chip, selected && { backgroundColor: theme.accent, borderColor: theme.accent }]}
                    onPress={() => setPaymentMode(selected ? null : m)}
                  >
                    <Text style={[styles.chipText, selected && { color: theme.onAccent }]}>
                      {t(`enrollment_workflow_detail.mode_${m}`, m.replace('_', ' '))}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>{t('enrollment_workflow_detail.receipt_number_label', 'Receipt / OR Number')}</Text>
            <TextInput
              style={styles.input}
              value={receiptNumber}
              onChangeText={setReceiptNumber}
              placeholder={t('enrollment_workflow_detail.receipt_number_placeholder', 'e.g. OR-00123')}
              placeholderTextColor={theme.textMuted}
            />

            <Text style={styles.label}>{t('enrollment_workflow_detail.receipt_photo_label', 'Receipt Photo (optional)')}</Text>
            <TouchableOpacity style={styles.photoPicker} onPress={pickReceiptPhoto}>
              {receiptPhoto ? (
                <Image source={{ uri: receiptPhoto.uri }} style={styles.photoPreview} />
              ) : activePayment?.receipt_photo ? (
                <Image source={{ uri: absoluteUrl(activePayment.receipt_photo) ?? undefined }} style={styles.photoPreview} />
              ) : (
                <Text style={styles.photoPickerText}>{t('enrollment_workflow_detail.receipt_photo_pick', 'Tap to attach a photo')}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveButton, savingPayment && styles.saveButtonDisabled]}
              disabled={savingPayment}
              onPress={onSavePayment}
            >
              {savingPayment ? (
                <ActivityIndicator color={theme.onAccent} />
              ) : (
                <Text style={styles.saveButtonText}>{t('enrollment_workflow_detail.payment_save', 'Save Payment')}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setPaymentModalVisible(false)}>
              <Text style={styles.modalCloseText}>{t('common.close', 'Close')}</Text>
            </TouchableOpacity>
          </ScrollView>
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
    cashierHint: { fontSize: 12.5, color: theme.textSecondary, lineHeight: 18, marginBottom: 12 },
    modalEmptyText: { fontSize: 13.5, color: theme.textMuted, textAlign: 'center', paddingVertical: 20 },
    modalCloseButton: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
    modalCloseText: { fontSize: 14.5, fontWeight: '600', color: theme.textSecondary },

    totalDueBanner: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: theme.dangerSoft,
      borderRadius: RADIUS.md ?? 10,
      padding: 14,
      marginBottom: 10,
    },
    totalDueLabel: { fontSize: 12.5, fontWeight: '700', color: theme.danger },
    totalDueValue: { fontSize: 18, fontWeight: '800', color: theme.danger },

    feeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: RADIUS.md ?? 10,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      marginBottom: 10,
    },
    feeRowHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    feeName: { fontSize: 14.5, fontWeight: '700', color: theme.textPrimary },
    feeAmount: { fontSize: 15, fontWeight: '700', color: theme.accent, marginTop: 4 },
    amountHint: { fontSize: 11.5, color: theme.textSecondary, marginTop: 6 },
    feeRequiredTag: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.textSecondary,
      backgroundColor: theme.surfaceVariant,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      textTransform: 'uppercase',
    },
    feeMeta: { fontSize: 12, color: theme.textSecondary, marginTop: 4, textTransform: 'capitalize' },
    feeStatusBadge: {
      fontSize: 11,
      fontWeight: '700',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 12,
      overflow: 'hidden',
      textTransform: 'capitalize',
    },

    label: { fontSize: 12.5, fontWeight: '600', color: theme.textSecondary, marginBottom: 6, marginTop: 16 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: RADIUS.pill ?? 20,
      borderWidth: 1,
      borderColor: theme.borderStrong,
    },
    chipText: { fontSize: 13, fontWeight: '600', color: theme.textPrimary, textTransform: 'capitalize' },
    input: {
      height: 48,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: RADIUS.sm,
      paddingHorizontal: 16,
      fontSize: 15,
      backgroundColor: theme.surface,
      color: theme.textPrimary,
    },
    photoPicker: {
      minHeight: 120,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: theme.borderStrong,
      borderRadius: RADIUS.md ?? 10,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    photoPickerText: { fontSize: 13, color: theme.textSecondary },
    photoPreview: { width: '100%', height: 160, resizeMode: 'cover' },
    saveButton: {
      backgroundColor: theme.accent,
      borderRadius: RADIUS.sm,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 20,
    },
    saveButtonDisabled: { opacity: 0.6 },
    saveButtonText: { color: theme.onAccent, fontWeight: '700', fontSize: 14.5 },
  });
