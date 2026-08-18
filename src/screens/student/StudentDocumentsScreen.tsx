import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import KeyboardAwareModal from '../../components/KeyboardAwareModal';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { EMERALD, EMERALD_SOFT, INK, SUBTLE } from '../dashboards/DashboardShell';
import {
  StudentDocument,
  cancelStudentDocument,
  fetchStudentDocuments,
  requestStudentDocument,
} from '../../services/studentPortalService';

/**
 * M5 student portal — document requests (COR, report card, transcript,
 * certificates). Backend: StudentPortalController::documentList/
 * documentRequest/documentCancel, verified live this session.
 */

const BORDER = '#E4E9E5';
const CANVAS = '#F5F7F6';
const DANGER = '#BA1A1A';
const WARN = '#B7791F';

function statusColor(status: StudentDocument['status']) {
  if (status === 'issued') return EMERALD;
  if (status === 'rejected') return DANGER;
  return WARN;
}

function statusLabel(status: StudentDocument['status'], t: (key: string, fallback?: string) => string) {
  if (status === 'issued') return t('student_documents.status_issued', 'Issued');
  if (status === 'rejected') return t('student_documents.status_rejected', 'Rejected');
  return t('student_documents.status_requested', 'Requested');
}

export default function StudentDocumentsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { t } = useLocale();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<StudentDocument[]>([]);
  const [documentTypes, setDocumentTypes] = useState<string[]>([]);

  const [formVisible, setFormVisible] = useState(false);
  const [fType, setFType] = useState<string | null>(null);
  const [fPurpose, setFPurpose] = useState('');
  const [fCopies, setFCopies] = useState('1');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchStudentDocuments(token);
      setDocuments(data.documents);
      setDocumentTypes(data.document_types);
    } catch (e: any) {
      setError(e?.message ?? t('student_documents.load_error', 'Could not load your documents.'));
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    load();
  }, [load]);

  const openForm = () => {
    setFType(documentTypes[0] ?? null);
    setFPurpose('');
    setFCopies('1');
    setFormVisible(true);
  };

  const onSubmit = async () => {
    if (!token || !fType) {
      Alert.alert(
        t('student_documents.pick_type_title', 'Pick a document type'),
        t('student_documents.pick_type_message', 'Choose which document you need first.'),
      );
      return;
    }
    const copies = Math.max(1, parseInt(fCopies, 10) || 1);
    setSubmitting(true);
    try {
      const result = await requestStudentDocument(token, fType, fPurpose.trim() || undefined, copies);
      setDocuments((prev) => [result.document, ...prev]);
      setFormVisible(false);
    } catch (e: any) {
      Alert.alert(
        t('student_documents.submit_error_title', 'Could not submit request'),
        e?.message ?? t('student_documents.try_again', 'Please try again.'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const confirmCancel = (doc: StudentDocument) => {
    Alert.alert(
      t('student_documents.cancel_confirm_title', 'Cancel this request?'),
      t('student_documents.cancel_confirm_message', 'Your request for "{label}" will be withdrawn.').replace(
        '{label}',
        doc.label,
      ),
      [
        { text: t('student_documents.keep_it', 'Keep it'), style: 'cancel' },
        {
          text: t('student_documents.cancel_request', 'Cancel request'),
          style: 'destructive',
          onPress: async () => {
            if (!token) return;
            try {
              await cancelStudentDocument(token, doc.id);
              setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
            } catch (e: any) {
              Alert.alert(
                t('student_documents.cancel_error_title', 'Could not cancel'),
                e?.message ?? t('student_documents.try_again', 'Please try again.'),
              );
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={EMERALD} size="large" />
        <Text style={styles.centerText}>{t('student_documents.loading', 'Loading your documents…')}</Text>
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
          <Text style={styles.headerTitle}>{t('student_documents.header_title', 'My Documents')}</Text>
          <Text style={styles.headerSub}>
            {t('student_documents.header_subtitle', 'Request report cards, transcripts, COR and certificates')}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {documents.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              {t('student_documents.empty', "You haven't requested any documents yet.")}
            </Text>
          </View>
        ) : (
          documents.map((doc) => (
            <View key={doc.id} style={styles.card}>
              <View style={styles.rowBetween}>
                <View style={styles.flexCol}>
                  <Text style={styles.rowTitle}>{doc.label}</Text>
                  <Text style={styles.rowSub}>
                    {doc.reference_no} · {doc.copies}{' '}
                    {doc.copies === 1
                      ? t('student_documents.copy', 'copy')
                      : t('student_documents.copies', 'copies')}
                  </Text>
                  {doc.purpose ? (
                    <Text style={styles.rowSub}>{t('student_documents.purpose_label', 'Purpose')}: {doc.purpose}</Text>
                  ) : null}
                  {doc.status === 'rejected' && doc.rejected_reason ? (
                    <Text style={[styles.rowSub, { color: DANGER }]}>
                      {t('student_documents.reason_label', 'Reason')}: {doc.rejected_reason}
                    </Text>
                  ) : null}
                </View>
                <View style={[styles.statusPill, { backgroundColor: `${statusColor(doc.status)}1A` }]}>
                  <Text style={[styles.statusPillText, { color: statusColor(doc.status) }]}>
                    {statusLabel(doc.status, t)}
                  </Text>
                </View>
              </View>
              {doc.status === 'requested' ? (
                <TouchableOpacity style={styles.dangerLinkBtn} onPress={() => confirmCancel(doc)}>
                  <Text style={styles.dangerLinkText}>{t('student_documents.cancel_request', 'Cancel request')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>

      <View style={[styles.saveBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity style={styles.addBtn} onPress={openForm}>
          <Text style={styles.addBtnText}>+ {t('student_documents.request_document', 'Request Document')}</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAwareModal visible={formVisible} animationType="slide" transparent onRequestClose={() => setFormVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('student_documents.modal_title', 'Request a Document')}</Text>

            <Text style={styles.label}>{t('student_documents.document_type_label', 'Document type')}</Text>
            <View style={styles.chipRow}>
              {documentTypes.map((docType) => (
                <TouchableOpacity
                  key={docType}
                  style={[styles.chip, fType === docType && styles.chipActive]}
                  onPress={() => setFType(docType)}
                >
                  <Text style={[styles.chipText, fType === docType && styles.chipTextActive]}>{docType}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>{t('student_documents.purpose_optional_label', 'Purpose (optional)')}</Text>
            <TextInput
              style={styles.input}
              value={fPurpose}
              onChangeText={setFPurpose}
              placeholder={t('student_documents.purpose_placeholder', 'e.g. scholarship application')}
              placeholderTextColor={SUBTLE}
            />

            <Text style={styles.label}>{t('student_documents.copies_label', 'Copies')}</Text>
            <TextInput
              style={styles.input}
              value={fCopies}
              onChangeText={setFCopies}
              keyboardType="number-pad"
              placeholder="1"
              placeholderTextColor={SUBTLE}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setFormVisible(false)} disabled={submitting}>
                <Text style={styles.modalCancelText}>{t('common.cancel', 'Cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={onSubmit} disabled={submitting}>
                {submitting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.modalSaveText}>{t('common.submit', 'Submit')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAwareModal>
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

  dangerLinkBtn: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: BORDER },
  dangerLinkText: { fontSize: 13, fontWeight: '700', color: DANGER },

  saveBar: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: BORDER },
  addBtn: { backgroundColor: EMERALD, borderRadius: 14, height: 50, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 32 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: INK, marginBottom: 6 },
  label: { fontSize: 13.5, fontWeight: '700', color: INK, marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: BORDER, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: INK, backgroundColor: '#FAFBFA' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: '#F1F3F2' },
  chipActive: { backgroundColor: EMERALD },
  chipText: { fontSize: 12.5, fontWeight: '700', color: SUBTLE },
  chipTextActive: { color: '#FFFFFF' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  modalCancel: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F3F2' },
  modalCancelText: { fontSize: 14.5, fontWeight: '700', color: SUBTLE },
  modalSave: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: EMERALD },
  modalSaveText: { fontSize: 14.5, fontWeight: '700', color: '#FFFFFF' },
});
