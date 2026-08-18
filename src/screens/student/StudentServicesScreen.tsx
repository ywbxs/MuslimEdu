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
  ServiceCatalogEntry,
  ServiceRequest,
  cancelServiceRequest,
  fetchServiceCatalog,
  storeServiceRequest,
} from '../../services/studentPortalService';

/**
 * M5 student portal — service requests (guidance/counselling and other
 * ticketed school services). Backend: StudentPortalController::
 * serviceCatalog/serviceRequestStore/serviceRequestCancel, verified live
 * this session. The `counselling` catalog key covers guidance/counselling
 * appointment requests — no separate clinic module exists.
 */

const BORDER = '#E4E9E5';
const CANVAS = '#F5F7F6';
const DANGER = '#BA1A1A';
const WARN = '#B7791F';
const INFO = '#2563AC';

function statusColor(status: ServiceRequest['status']) {
  if (status === 'resolved') return EMERALD;
  if (status === 'cancelled') return SUBTLE;
  if (status === 'in_progress') return INFO;
  return WARN;
}

function statusLabel(status: ServiceRequest['status'], t: (key: string, fallback?: string) => string) {
  if (status === 'in_progress') return t('student_services.status_in_progress', 'In progress');
  return t(`student_services.status_${status}`, status.charAt(0).toUpperCase() + status.slice(1));
}

export default function StudentServicesScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { t } = useLocale();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [services, setServices] = useState<ServiceCatalogEntry[]>([]);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);

  const [formVisible, setFormVisible] = useState(false);
  const [fKey, setFKey] = useState<string | null>(null);
  const [fSubject, setFSubject] = useState('');
  const [fDetails, setFDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchServiceCatalog(token);
      setServices(data.services);
      setRequests(data.requests);
    } catch (e: any) {
      setError(e?.message ?? t('student_services.load_error', 'Could not load services.'));
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    load();
  }, [load]);

  const openForm = (presetKey?: string) => {
    setFKey(presetKey ?? services[0]?.key ?? null);
    setFSubject('');
    setFDetails('');
    setFormVisible(true);
  };

  const selectedEntry = services.find((s) => s.key === fKey);

  const onSubmit = async () => {
    if (!token || !fKey) {
      Alert.alert(
        t('student_services.pick_service_title', 'Pick a service'),
        t('student_services.pick_service_message', 'Choose which service you need first.'),
      );
      return;
    }
    if (!fSubject.trim()) {
      Alert.alert(
        t('student_services.subject_required_title', 'Subject required'),
        t('student_services.subject_required_message', 'Give this request a short subject.'),
      );
      return;
    }
    if (selectedEntry?.needs_details && !fDetails.trim()) {
      Alert.alert(
        t('student_services.more_detail_title', 'More detail needed'),
        t('student_services.more_detail_message', 'This service needs a bit more detail before it can be submitted.'),
      );
      return;
    }
    setSubmitting(true);
    try {
      const result = await storeServiceRequest(token, fKey, fSubject.trim(), fDetails.trim() || undefined);
      setRequests((prev) => [result.request, ...prev]);
      setFormVisible(false);
    } catch (e: any) {
      Alert.alert(
        t('student_services.submit_error_title', 'Could not submit request'),
        e?.message ?? t('common.try_again', 'Please try again.'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const confirmCancel = (req: ServiceRequest) => {
    Alert.alert(
      t('student_services.cancel_confirm_title', 'Cancel this request?'),
      t('student_services.cancel_confirm_message', '"{subject}" will be withdrawn.').replace('{subject}', req.subject),
      [
        { text: t('student_services.keep_it', 'Keep it'), style: 'cancel' },
        {
          text: t('student_services.cancel_request', 'Cancel request'),
          style: 'destructive',
          onPress: async () => {
            if (!token) return;
            try {
              await cancelServiceRequest(token, req.id);
              setRequests((prev) => prev.map((r) => (r.id === req.id ? { ...r, status: 'cancelled' } : r)));
            } catch (e: any) {
              Alert.alert(
                t('student_services.cancel_error_title', 'Could not cancel'),
                e?.message ?? t('common.try_again', 'Please try again.'),
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
        <Text style={styles.centerText}>{t('student_services.loading', 'Loading services…')}</Text>
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
          <Text style={styles.headerTitle}>{t('student_services.header_title', 'Services')}</Text>
          <Text style={styles.headerSub}>
            {t('student_services.header_subtitle', 'Guidance, counselling and other school services')}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>{t('student_services.available_services', 'Available services')}</Text>
        {services.map((s) => (
          <TouchableOpacity key={s.key} style={styles.card} onPress={() => openForm(s.key)}>
            <View style={styles.rowBetween}>
              <View style={styles.flexCol}>
                <Text style={styles.rowTitle}>{s.label}</Text>
                <Text style={styles.rowSub}>
                  {t('student_services.typical_response', 'Typical response')}: {s.sla_days}{' '}
                  {s.sla_days === 1 ? t('student_services.day', 'day') : t('student_services.days', 'days')}
                </Text>
              </View>
              <Text style={styles.requestLink}>{t('student_services.request', 'Request')}</Text>
            </View>
          </TouchableOpacity>
        ))}

        <Text style={styles.sectionTitle}>{t('student_services.my_requests', 'My requests')}</Text>
        {requests.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              {t('student_services.empty', "You haven't submitted any service requests yet.")}
            </Text>
          </View>
        ) : (
          requests.map((req) => (
            <View key={req.id} style={styles.card}>
              <View style={styles.rowBetween}>
                <View style={styles.flexCol}>
                  <Text style={styles.rowTitle}>{req.subject}</Text>
                  <Text style={styles.rowSub}>
                    {req.service_label} · {req.reference_no}
                  </Text>
                  {req.details ? <Text style={styles.rowSub}>{req.details}</Text> : null}
                  {req.status === 'resolved' && req.resolution_note ? (
                    <Text style={[styles.rowSub, { color: EMERALD }]}>
                      {t('student_services.response_label', 'Response')}: {req.resolution_note}
                    </Text>
                  ) : null}
                </View>
                <View style={[styles.statusPill, { backgroundColor: `${statusColor(req.status)}1A` }]}>
                  <Text style={[styles.statusPillText, { color: statusColor(req.status) }]}>
                    {statusLabel(req.status, t)}
                  </Text>
                </View>
              </View>
              {req.status === 'open' ? (
                <TouchableOpacity style={styles.dangerLinkBtn} onPress={() => confirmCancel(req)}>
                  <Text style={styles.dangerLinkText}>{t('student_services.cancel_request', 'Cancel request')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>

      <View style={[styles.saveBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity style={styles.addBtn} onPress={() => openForm()}>
          <Text style={styles.addBtnText}>+ {t('student_services.new_request', 'New Request')}</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAwareModal visible={formVisible} animationType="slide" transparent onRequestClose={() => setFormVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('student_services.modal_title', 'New Service Request')}</Text>

            <Text style={styles.label}>{t('student_services.service_label', 'Service')}</Text>
            <View style={styles.chipRow}>
              {services.map((s) => (
                <TouchableOpacity
                  key={s.key}
                  style={[styles.chip, fKey === s.key && styles.chipActive]}
                  onPress={() => setFKey(s.key)}
                >
                  <Text style={[styles.chipText, fKey === s.key && styles.chipTextActive]}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>{t('student_services.subject_label', 'Subject')}</Text>
            <TextInput
              style={styles.input}
              value={fSubject}
              onChangeText={setFSubject}
              placeholder={t('student_services.subject_placeholder', 'Short summary')}
              placeholderTextColor={SUBTLE}
            />

            <Text style={styles.label}>
              {t('student_services.details_label', 'Details')}
              {selectedEntry?.needs_details ? '' : ` ${t('student_services.optional_suffix', '(optional)')}`}
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={fDetails}
              onChangeText={setFDetails}
              placeholder={t('student_services.details_placeholder', 'Anything that would help')}
              placeholderTextColor={SUBTLE}
              multiline
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
  sectionTitle: { fontSize: 13, fontWeight: '800', color: SUBTLE, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, marginTop: 4 },

  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: BORDER },
  emptyText: { fontSize: 13.5, color: SUBTLE, lineHeight: 20, textAlign: 'center' },

  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: BORDER, marginBottom: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  flexCol: { flex: 1, paddingRight: 14 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: INK },
  rowSub: { fontSize: 12.5, color: SUBTLE, marginTop: 3, lineHeight: 18 },
  requestLink: { fontSize: 13, fontWeight: '700', color: EMERALD },

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
  textArea: { height: 90, textAlignVertical: 'top' },
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
