import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { useOfflineQueue } from '../../context/OfflineQueueContext';
import { EMERALD, EMERALD_SOFT, INK, SUBTLE } from '../dashboards/DashboardShell';
import {
  AdminDocumentRequest,
  fetchAdminDocumentRequests,
  issueAdminDocument,
  rejectAdminDocument,
} from '../../services/studentPortalService';
import { enqueueAdminDocumentIssue, enqueueAdminDocumentReject } from '../../services/offlineQueue';

/**
 * M5 student portal — admin fulfillment of student document requests.
 * Backend: StudentPortalController::adminDocumentList/adminDocumentIssue/
 * adminDocumentReject, verified live this session (issue + reject both
 * tested end-to-end against seeded requests).
 *
 * Offline: the list already falls back to the last-cached response via
 * cacheThenNetwork (see fetchAdminDocumentRequests). Issuing/rejecting a
 * request now also works offline - both are queued through the same
 * offline outbox exams/attendance use (offlineQueue.ts) and replayed
 * automatically once back online, so an admin working through a batch of
 * requests isn't blocked by a flaky connection.
 */

const BORDER = '#E4E9E5';
const CANVAS = '#F5F7F6';
const DANGER = '#BA1A1A';
const WARN = '#B7791F';

type Filter = 'requested' | 'issued' | 'rejected' | 'all';

function statusColor(status: AdminDocumentRequest['status']) {
  if (status === 'issued') return EMERALD;
  if (status === 'rejected') return DANGER;
  return WARN;
}

export default function StudentDocumentRequestsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { t } = useLocale();
  const { isOnline } = useOfflineQueue();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<AdminDocumentRequest[]>([]);
  const [filter, setFilter] = useState<Filter>('requested');
  const [busyId, setBusyId] = useState<number | null>(null);

  const [rejectVisible, setRejectVisible] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<AdminDocumentRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminDocumentRequests(token);
      setRequests(data);
    } catch (e: any) {
      setError(e?.message ?? t('admin_document_requests.load_error', 'Could not load document requests.'));
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(
    () => (filter === 'all' ? requests : requests.filter((r) => r.status === filter)),
    [requests, filter],
  );

  const confirmIssue = (req: AdminDocumentRequest) => {
    Alert.alert(
      t('admin_document_requests.issue_confirm_title', 'Issue this document?'),
      t('admin_document_requests.issue_confirm_message', 'Mark "{label}" as issued for {student}.')
        .replace('{label}', req.label)
        .replace('{student}', req.student?.name ?? t('admin_document_requests.unknown_student', 'this student')),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('admin_document_requests.issue', 'Issue'),
          onPress: async () => {
            if (!token) return;
            setBusyId(req.id);
            try {
              if (!isOnline) {
                // Queue it - offlineQueue auto-flushes through this same
                // issueAdminDocument() the moment connectivity returns.
                // The status is known regardless of the network, so update
                // it locally now rather than waiting for the sync.
                enqueueAdminDocumentIssue(token, req.id);
              } else {
                await issueAdminDocument(token, req.id);
              }
              setRequests((prev) => prev.map((r) => (r.id === req.id ? { ...r, status: 'issued' } : r)));
            } catch (e: any) {
              Alert.alert(
                t('admin_document_requests.issue_error_title', 'Could not issue'),
                e?.message ?? t('common.try_again', 'Please try again.'),
              );
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  const openReject = (req: AdminDocumentRequest) => {
    setRejectTarget(req);
    setRejectReason('');
    setRejectVisible(true);
  };

  const onReject = async () => {
    if (!token || !rejectTarget || !rejectReason.trim()) {
      Alert.alert(
        t('admin_document_requests.reason_required_title', 'Reason required'),
        t('admin_document_requests.reason_required_message', 'Tell the student why this request is being rejected.'),
      );
      return;
    }
    setRejecting(true);
    try {
      if (!isOnline) {
        enqueueAdminDocumentReject(token, rejectTarget.id, rejectReason.trim());
      } else {
        await rejectAdminDocument(token, rejectTarget.id, rejectReason.trim());
      }
      setRequests((prev) =>
        prev.map((r) =>
          r.id === rejectTarget.id ? { ...r, status: 'rejected', rejected_reason: rejectReason.trim() } : r,
        ),
      );
      setRejectVisible(false);
    } catch (e: any) {
      Alert.alert(
        t('admin_document_requests.reject_error_title', 'Could not reject'),
        e?.message ?? t('common.try_again', 'Please try again.'),
      );
    } finally {
      setRejecting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={EMERALD} size="large" />
        <Text style={styles.centerText}>
          {t('admin_document_requests.loading', 'Loading document requests…')}
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>{t('common.load_failed_title', "Couldn't load this")}</Text>
        <Text style={styles.centerText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={load}>
          <Text style={styles.retryText}>{t('common.retry', 'Retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backChevron}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>{t('admin_document_requests.header_title', 'Document Requests')}</Text>
          <Text style={styles.headerSub}>
            {t('admin_document_requests.header_subtitle', 'Issue or reject student document requests')}
          </Text>
        </View>
      </View>

      {!isOnline ? (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            {t(
              'admin_document_requests.offline_banner',
              "You're offline - showing your last saved requests. Issuing or rejecting a request will sync automatically once you're back online.",
            )}
          </Text>
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterRowContent}>
        {(['requested', 'issued', 'rejected', 'all'] as Filter[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
              {f === 'all'
                ? t('common.filter_all', 'All')
                : t(`admin_document_requests.filter_${f}`, f.charAt(0).toUpperCase() + f.slice(1))}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {visible.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{t('admin_document_requests.empty', 'No requests in this view.')}</Text>
          </View>
        ) : (
          visible.map((req) => (
            <View key={req.id} style={styles.card}>
              <View style={styles.rowBetween}>
                <View style={styles.flexCol}>
                  <Text style={styles.rowTitle}>{req.label}</Text>
                  <Text style={styles.rowSub}>
                    {req.student?.name ?? t('admin_document_requests.unknown_student', 'Unknown student')}
                    {req.student?.code ? ` · ${req.student.code}` : ''}
                  </Text>
                  <Text style={styles.rowSub}>
                    {req.reference_no} · {req.copies}{' '}
                    {req.copies === 1
                      ? t('admin_document_requests.copy', 'copy')
                      : t('admin_document_requests.copies', 'copies')}
                  </Text>
                  {req.purpose ? (
                    <Text style={styles.rowSub}>
                      {t('admin_document_requests.purpose_label', 'Purpose')}: {req.purpose}
                    </Text>
                  ) : null}
                  {req.status === 'rejected' && req.rejected_reason ? (
                    <Text style={[styles.rowSub, { color: DANGER }]}>
                      {t('admin_document_requests.reason_label', 'Reason')}: {req.rejected_reason}
                    </Text>
                  ) : null}
                </View>
                <View style={[styles.statusPill, { backgroundColor: `${statusColor(req.status)}1A` }]}>
                  <Text style={[styles.statusPillText, { color: statusColor(req.status) }]}>
                    {t(`admin_document_requests.status_${req.status}`, req.status.charAt(0).toUpperCase() + req.status.slice(1))}
                  </Text>
                </View>
              </View>
              {req.status === 'requested' ? (
                <View style={styles.actionsRow}>
                  <TouchableOpacity onPress={() => confirmIssue(req)} disabled={busyId === req.id}>
                    <Text style={styles.actionLink}>
                      {busyId === req.id
                        ? t('admin_document_requests.working', 'Working…')
                        : t('admin_document_requests.issue', 'Issue')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => openReject(req)} disabled={busyId === req.id}>
                    <Text style={[styles.actionLink, styles.deleteLink]}>
                      {t('admin_document_requests.reject', 'Reject')}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={rejectVisible} animationType="slide" transparent onRequestClose={() => setRejectVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {t('admin_document_requests.reject_modal_title', 'Reject Document Request')}
            </Text>
            <Text style={styles.label}>
              {t('admin_document_requests.reject_reason_label', 'Reason (shown to the student)')}
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder={t(
                'admin_document_requests.reject_reason_placeholder',
                'e.g. outstanding balance, missing clearance',
              )}
              placeholderTextColor={SUBTLE}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setRejectVisible(false)} disabled={rejecting}>
                <Text style={styles.modalCancelText}>{t('common.cancel', 'Cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalDanger} onPress={onReject} disabled={rejecting}>
                {rejecting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.modalDangerText}>{t('admin_document_requests.reject', 'Reject')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: CANVAS },
  center: { flex: 1, backgroundColor: CANVAS, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  centerText: { marginTop: 12, fontSize: 14, color: SUBTLE, textAlign: 'center', lineHeight: 20 },
  errorTitle: { fontSize: 18, fontWeight: '700', color: INK },
  retryBtn: { marginTop: 20, backgroundColor: EMERALD, paddingHorizontal: 26, paddingVertical: 12, borderRadius: 999 },
  retryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: EMERALD_SOFT, marginRight: 12 },
  backChevron: { fontSize: 26, lineHeight: 28, color: EMERALD, marginTop: -3 },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: INK },
  headerSub: { fontSize: 12.5, color: SUBTLE, marginTop: 2 },

  offlineBanner: { backgroundColor: '#FEF3C7', paddingHorizontal: 16, paddingVertical: 10 },
  offlineBannerText: { color: WARN, fontSize: 12, lineHeight: 16, fontWeight: '600' },

  filterRow: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: BORDER },
  filterRowContent: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: '#F1F3F2', marginRight: 8 },
  filterChipActive: { backgroundColor: EMERALD },
  filterChipText: { fontSize: 12.5, fontWeight: '700', color: SUBTLE },
  filterChipTextActive: { color: '#FFFFFF' },

  scroll: { flex: 1 },
  scrollContent: { padding: 16 },

  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: BORDER },
  emptyText: { fontSize: 13.5, color: SUBTLE, lineHeight: 20, textAlign: 'center' },

  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: BORDER, marginBottom: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  flexCol: { flex: 1, paddingRight: 14 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: INK },
  rowSub: { fontSize: 12.5, color: SUBTLE, marginTop: 3, lineHeight: 18 },

  statusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  statusPillText: { fontSize: 11.5, fontWeight: '800' },

  actionsRow: { flexDirection: 'row', gap: 20, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: BORDER },
  actionLink: { fontSize: 13, fontWeight: '700', color: EMERALD },
  deleteLink: { color: DANGER },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 32 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: INK, marginBottom: 6 },
  label: { fontSize: 13.5, fontWeight: '700', color: INK, marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: BORDER, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: INK, backgroundColor: '#FAFBFA' },
  textArea: { height: 90, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  modalCancel: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F3F2' },
  modalCancelText: { fontSize: 14.5, fontWeight: '700', color: SUBTLE },
  modalDanger: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: DANGER },
  modalDangerText: { fontSize: 14.5, fontWeight: '700', color: '#FFFFFF' },
});
