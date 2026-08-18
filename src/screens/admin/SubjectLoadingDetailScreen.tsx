/**
 * SubjectLoadingDetailScreen
 *
 * Full view of one subject load: subjects, overrides, audit trail, and the
 * approve / return / cancel actions.
 *
 * Navigate with: navigation.navigate('SubjectLoadingDetail', { loadingId })
 */
import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import KeyboardAwareModal from '../../components/KeyboardAwareModal';
import subjectLoadingService, {
  SubjectLoading,
} from '../../services/subjectLoadingService';
import {useLocale} from '../../context/LocaleContext';

const C = {
  bg: '#F5F7F6',
  card: '#FFFFFF',
  ink: '#12211C',
  muted: '#6B7C76',
  line: '#E3EAE7',
  green: '#0F7A3D',
  greenSoft: '#E7F4EF',
  amber: '#B4790B',
  amberSoft: '#FDF3DF',
  red: '#C0392B',
};

type Props = {navigation: any; route: any};

export default function SubjectLoadingDetailScreen({navigation, route}: Props) {
  const {t} = useLocale();
  const loadingId: number = route?.params?.loadingId;

  const [record, setRecord] = useState<SubjectLoading | null>(null);
  const [student, setStudent] = useState<any>(null);
  const [audits, setAudits] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [reasonOpen, setReasonOpen] = useState<null | 'reject' | 'cancel'>(null);
  const [reason, setReason] = useState('');

  const fetchAll = useCallback(async () => {
    try {
      setFetching(true);
      setError(null);
      const res = await subjectLoadingService.detail(loadingId);
      setRecord(res.loading);
      setStudent(res.student);
      try {
        const trail = await subjectLoadingService.audit(loadingId);
        setAudits(trail.audits || []);
      } catch (e) {
        setAudits([]);
      }
    } catch (e: any) {
      setError(e.message || t('subject_loading_detail.load_error', 'Could not load this record.'));
    } finally {
      setFetching(false);
    }
  }, [loadingId, t]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const run = async (fn: () => Promise<any>, okMessage: string) => {
    try {
      setBusy(true);
      const res = await fn();
      setRecord(res.loading);
      Alert.alert(t('subject_loading_detail.done', 'Done'), okMessage);
      fetchAll();
    } catch (e: any) {
      Alert.alert(t('subject_loading_detail.could_not_complete', 'Could not complete'), e.message || t('subject_loading_detail.unknown_error', 'Unknown error.'));
    } finally {
      setBusy(false);
    }
  };

  const submitReason = () => {
    if (reason.trim().length < 5) {
      Alert.alert(t('subject_loading_detail.reason_required_title', 'Reason required'), t('subject_loading_detail.reason_required_message', 'Give a short reason. It is stored in the audit trail.'));
      return;
    }
    const kind = reasonOpen;
    const text = reason.trim();
    setReasonOpen(null);
    setReason('');

    if (kind === 'reject') {
      run(
        () => subjectLoadingService.reject(loadingId, text),
        t('subject_loading_detail.returned_message', 'Returned to the adviser for correction.'),
      );
    } else {
      run(
        () => subjectLoadingService.cancel(loadingId, text),
        t('subject_loading_detail.cancelled_message', 'Subject load cancelled and seats released.'),
      );
    }
  };

  if (fetching) {
    return (
      <SafeAreaView style={s.center}>
        <ActivityIndicator size={'large'} color={C.green} />
      </SafeAreaView>
    );
  }

  if (error || !record) {
    return (
      <SafeAreaView style={s.center}>
        <Text style={s.errorTitle}>{t('subject_loading_detail.not_available', 'Not available')}</Text>
        <Text style={s.muted}>{error}</Text>
      </SafeAreaView>
    );
  }

  const canApprove = record.status === 'submitted';
  const canCancel = record.status !== 'cancelled';

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView contentContainerStyle={{paddingBottom: 40}}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={s.back}>{t('common.back', 'Back')}</Text>
          </TouchableOpacity>
          <Text style={s.title}>
            {student?.name || `${t('subject_loading_detail.student_hash', 'Student #')}${record.student_id}`}
          </Text>
          <Text style={s.subtitle}>
            {record.load_number || t('subject_loading_detail.no_load_number', 'No load number yet')} ·{' '}
            {record.status.toUpperCase()}
          </Text>
        </View>

        <View style={s.card}>
          <View style={s.statRow}>
            <View style={s.stat}>
              <Text style={s.statValue}>{record.total_subjects}</Text>
              <Text style={s.statLabel}>{t('subject_loading_detail.subjects', 'subjects')}</Text>
            </View>
            <View style={s.stat}>
              <Text style={s.statValue}>{record.total_units}</Text>
              <Text style={s.statLabel}>{t('subject_loading_detail.units', 'units')}</Text>
            </View>
            <View style={s.stat}>
              <Text style={s.statValue}>{record.has_override ? t('common.yes', 'Yes') : t('common.no', 'No')}</Text>
              <Text style={s.statLabel}>{t('subject_loading_detail.overrides', 'overrides')}</Text>
            </View>
          </View>
        </View>

        {record.rejection_reason ? (
          <View style={s.warnCard}>
            <Text style={s.warnTitle}>{t('subject_loading_detail.returned', 'Returned')}</Text>
            <Text style={s.warnBody}>{record.rejection_reason}</Text>
          </View>
        ) : null}

        <Text style={s.sectionTitle}>{t('subject_loading_detail.loaded_subjects', 'Loaded subjects')}</Text>
        {record.items.map(item => (
          <View key={item.id} style={s.card}>
            <Text style={s.itemTitle}>
              {item.subject_code ? item.subject_code + ' - ' : ''}
              {item.subject_name || `${t('subject_loading_detail.subject_hash', 'Subject #')}${item.subject_id}`}
            </Text>
            <Text style={s.itemMeta}>
              {item.units} {t('subject_loading_detail.units', 'units')} · {item.load_type} · {item.status}
            </Text>
            {item.is_override ? (
              <View style={s.overrideBox}>
                <Text style={s.overrideTitle}>{t('subject_loading_detail.override_authorised', 'Override authorised')}</Text>
                <Text style={s.overrideBody}>{item.override_reason}</Text>
                {(item.violated_rules || []).map((v, i) => (
                  <Text key={i} style={s.overrideRule}>
                    {v.code}: {v.message}
                  </Text>
                ))}
              </View>
            ) : null}
            {item.status === 'enrolled' && record.status === 'approved' ? (
              <TouchableOpacity
                style={s.dropBtn}
                onPress={() =>
                  Alert.prompt
                    ? Alert.prompt(t('subject_loading_detail.drop_subject_title', 'Drop subject'), t('subject_loading_detail.reason', 'Reason'), (text: string) =>
                        run(
                          () => subjectLoadingService.dropItem(item.id, text || t('subject_loading_detail.dropped', 'Dropped')),
                          t('subject_loading_detail.dropped_message', 'Subject dropped.'),
                        ),
                      )
                    : run(
                        () =>
                          subjectLoadingService.dropItem(item.id, t('subject_loading_detail.dropped_by_registrar', 'Dropped by registrar')),
                        t('subject_loading_detail.dropped_message', 'Subject dropped.'),
                      )
                }>
                <Text style={s.dropBtnText}>{t('subject_loading_detail.drop_this_subject', 'Drop this subject')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ))}

        <Text style={s.sectionTitle}>{t('subject_loading_detail.audit_trail', 'Audit trail')}</Text>
        {audits.length === 0 ? (
          <Text style={s.mutedPad}>{t('subject_loading_detail.no_audit_entries', 'No audit entries.')}</Text>
        ) : (
          audits.map(a => (
            <View key={a.id} style={s.auditRow}>
              <Text style={s.auditAction}>{a.action}</Text>
              <Text style={s.auditMeta}>
                {a.actor_name || t('subject_loading_detail.system', 'System')} · {a.created_at}
              </Text>
              {a.remarks ? <Text style={s.auditRemark}>{a.remarks}</Text> : null}
            </View>
          ))
        )}
      </ScrollView>

      <View style={s.footer}>
        {canCancel ? (
          <TouchableOpacity
            style={[s.secondaryBtn, busy ? s.disabled : null]}
            disabled={busy}
            onPress={() => {
              setReason('');
              setReasonOpen('cancel');
            }}>
            <Text style={s.secondaryBtnText}>{t('subject_loading_detail.cancel_load', 'Cancel load')}</Text>
          </TouchableOpacity>
        ) : null}
        {canApprove ? (
          <TouchableOpacity
            style={[s.secondaryBtn, busy ? s.disabled : null]}
            disabled={busy}
            onPress={() => {
              setReason('');
              setReasonOpen('reject');
            }}>
            <Text style={s.secondaryBtnText}>{t('subject_loading_detail.return', 'Return')}</Text>
          </TouchableOpacity>
        ) : null}
        {canApprove ? (
          <TouchableOpacity
            style={[s.primaryBtn, {flex: 1}, busy ? s.disabled : null]}
            disabled={busy}
            onPress={() =>
              run(
                () => subjectLoadingService.approve(loadingId),
                t('subject_loading_detail.approved_message', 'Subject load approved and locked.'),
              )
            }>
            <Text style={s.primaryBtnText}>
              {busy ? t('subject_loading_detail.working', 'Working...') : t('subject_loading_detail.approve', 'Approve')}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <KeyboardAwareModal visible={!!reasonOpen} transparent animationType={'fade'}>
        <View style={s.modalWrap}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>
              {reasonOpen === 'reject' ? t('subject_loading_detail.return_for_correction', 'Return for correction') : t('subject_loading_detail.cancel_this_load', 'Cancel this load')}
            </Text>
            <TextInput
              style={s.modalInput}
              placeholder={t('subject_loading_detail.reason', 'Reason')}
              placeholderTextColor={C.muted}
              multiline
              value={reason}
              onChangeText={setReason}
            />
            <View style={s.modalRow}>
              <TouchableOpacity
                style={s.secondaryBtn}
                onPress={() => setReasonOpen(null)}>
                <Text style={s.secondaryBtnText}>{t('common.close', 'Close')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.primaryBtn, {flex: 1}]}
                onPress={submitReason}>
                <Text style={s.primaryBtnText}>{t('subject_loading_detail.confirm', 'Confirm')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAwareModal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: {flex: 1, backgroundColor: C.bg},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: C.bg},
  header: {paddingHorizontal: 18, paddingTop: 12, paddingBottom: 8},
  back: {color: C.green, fontWeight: '600', marginBottom: 6},
  title: {fontSize: 21, fontWeight: '700', color: C.ink},
  subtitle: {fontSize: 12, color: C.muted, marginTop: 3},
  card: {backgroundColor: C.card, marginHorizontal: 14, marginBottom: 10, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: C.line},
  statRow: {flexDirection: 'row'},
  stat: {flex: 1, alignItems: 'center'},
  statValue: {fontSize: 18, fontWeight: '700', color: C.ink},
  statLabel: {fontSize: 11, color: C.muted, marginTop: 2},
  sectionTitle: {fontSize: 13, fontWeight: '700', color: C.muted, marginHorizontal: 18, marginTop: 14, marginBottom: 8, letterSpacing: 0.5},
  itemTitle: {fontSize: 15, fontWeight: '600', color: C.ink},
  itemMeta: {fontSize: 12, color: C.muted, marginTop: 3},
  overrideBox: {backgroundColor: C.amberSoft, borderRadius: 10, padding: 10, marginTop: 10},
  overrideTitle: {fontSize: 12, fontWeight: '700', color: C.amber},
  overrideBody: {fontSize: 12, color: C.ink, marginTop: 4},
  overrideRule: {fontSize: 11, color: C.amber, marginTop: 4},
  dropBtn: {marginTop: 10},
  dropBtnText: {color: C.red, fontSize: 12, fontWeight: '600'},
  warnCard: {backgroundColor: '#FCEBE9', marginHorizontal: 14, marginBottom: 10, padding: 14, borderRadius: 14},
  warnTitle: {fontSize: 13, fontWeight: '700', color: C.red},
  warnBody: {fontSize: 13, color: C.ink, marginTop: 4},
  auditRow: {marginHorizontal: 18, marginBottom: 12, borderLeftWidth: 2, borderLeftColor: C.line, paddingLeft: 12},
  auditAction: {fontSize: 13, fontWeight: '600', color: C.ink},
  auditMeta: {fontSize: 11, color: C.muted, marginTop: 2},
  auditRemark: {fontSize: 12, color: C.ink, marginTop: 4},
  footer: {flexDirection: 'row', padding: 14, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.line},
  primaryBtn: {backgroundColor: C.green, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center'},
  primaryBtnText: {color: '#FFFFFF', fontWeight: '700'},
  secondaryBtn: {backgroundColor: C.bg, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center', marginRight: 10, borderWidth: 1, borderColor: C.line},
  secondaryBtnText: {color: C.ink, fontWeight: '600'},
  disabled: {opacity: 0.5},
  muted: {color: C.muted, textAlign: 'center', marginTop: 8},
  mutedPad: {color: C.muted, marginHorizontal: 18},
  errorTitle: {fontSize: 17, fontWeight: '700', color: C.ink},
  modalWrap: {flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20},
  modal: {backgroundColor: C.card, borderRadius: 16, padding: 18},
  modalTitle: {fontSize: 17, fontWeight: '700', color: C.ink},
  modalInput: {borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 12, marginTop: 14, minHeight: 90, textAlignVertical: 'top', color: C.ink},
  modalRow: {flexDirection: 'row', marginTop: 14},
});
