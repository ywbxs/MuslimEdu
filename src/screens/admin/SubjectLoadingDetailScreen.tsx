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
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import subjectLoadingService, {
  SubjectLoading,
} from '../../services/subjectLoadingService';

const C = {
  bg: '#F5F7F6',
  card: '#FFFFFF',
  ink: '#12211C',
  muted: '#6B7C76',
  line: '#E3EAE7',
  green: '#12805C',
  greenSoft: '#E7F4EF',
  amber: '#B4790B',
  amberSoft: '#FDF3DF',
  red: '#C0392B',
};

type Props = {navigation: any; route: any};

export default function SubjectLoadingDetailScreen({navigation, route}: Props) {
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
      setError(e.message || 'Could not load this record.');
    } finally {
      setFetching(false);
    }
  }, [loadingId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const run = async (fn: () => Promise<any>, okMessage: string) => {
    try {
      setBusy(true);
      const res = await fn();
      setRecord(res.loading);
      Alert.alert('Done', okMessage);
      fetchAll();
    } catch (e: any) {
      Alert.alert('Could not complete', e.message || 'Unknown error.');
    } finally {
      setBusy(false);
    }
  };

  const submitReason = () => {
    if (reason.trim().length < 5) {
      Alert.alert('Reason required', 'Give a short reason. It is stored in the audit trail.');
      return;
    }
    const kind = reasonOpen;
    const text = reason.trim();
    setReasonOpen(null);
    setReason('');

    if (kind === 'reject') {
      run(
        () => subjectLoadingService.reject(loadingId, text),
        'Returned to the adviser for correction.',
      );
    } else {
      run(
        () => subjectLoadingService.cancel(loadingId, text),
        'Subject load cancelled and seats released.',
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
        <Text style={s.errorTitle}>Not available</Text>
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
            <Text style={s.back}>Back</Text>
          </TouchableOpacity>
          <Text style={s.title}>
            {student?.name || 'Student #' + record.student_id}
          </Text>
          <Text style={s.subtitle}>
            {record.load_number || 'No load number yet'} ·{' '}
            {record.status.toUpperCase()}
          </Text>
        </View>

        <View style={s.card}>
          <View style={s.statRow}>
            <View style={s.stat}>
              <Text style={s.statValue}>{record.total_subjects}</Text>
              <Text style={s.statLabel}>subjects</Text>
            </View>
            <View style={s.stat}>
              <Text style={s.statValue}>{record.total_units}</Text>
              <Text style={s.statLabel}>units</Text>
            </View>
            <View style={s.stat}>
              <Text style={s.statValue}>{record.has_override ? 'Yes' : 'No'}</Text>
              <Text style={s.statLabel}>overrides</Text>
            </View>
          </View>
        </View>

        {record.rejection_reason ? (
          <View style={s.warnCard}>
            <Text style={s.warnTitle}>Returned</Text>
            <Text style={s.warnBody}>{record.rejection_reason}</Text>
          </View>
        ) : null}

        <Text style={s.sectionTitle}>Loaded subjects</Text>
        {record.items.map(item => (
          <View key={item.id} style={s.card}>
            <Text style={s.itemTitle}>
              {item.subject_code ? item.subject_code + ' - ' : ''}
              {item.subject_name || 'Subject #' + item.subject_id}
            </Text>
            <Text style={s.itemMeta}>
              {item.units} units · {item.load_type} · {item.status}
            </Text>
            {item.is_override ? (
              <View style={s.overrideBox}>
                <Text style={s.overrideTitle}>Override authorised</Text>
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
                    ? Alert.prompt('Drop subject', 'Reason', (text: string) =>
                        run(
                          () => subjectLoadingService.dropItem(item.id, text || 'Dropped'),
                          'Subject dropped.',
                        ),
                      )
                    : run(
                        () =>
                          subjectLoadingService.dropItem(item.id, 'Dropped by registrar'),
                        'Subject dropped.',
                      )
                }>
                <Text style={s.dropBtnText}>Drop this subject</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ))}

        <Text style={s.sectionTitle}>Audit trail</Text>
        {audits.length === 0 ? (
          <Text style={s.mutedPad}>No audit entries.</Text>
        ) : (
          audits.map(a => (
            <View key={a.id} style={s.auditRow}>
              <Text style={s.auditAction}>{a.action}</Text>
              <Text style={s.auditMeta}>
                {a.actor_name || 'System'} · {a.created_at}
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
            <Text style={s.secondaryBtnText}>Cancel load</Text>
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
            <Text style={s.secondaryBtnText}>Return</Text>
          </TouchableOpacity>
        ) : null}
        {canApprove ? (
          <TouchableOpacity
            style={[s.primaryBtn, {flex: 1}, busy ? s.disabled : null]}
            disabled={busy}
            onPress={() =>
              run(
                () => subjectLoadingService.approve(loadingId),
                'Subject load approved and locked.',
              )
            }>
            <Text style={s.primaryBtnText}>
              {busy ? 'Working...' : 'Approve'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <Modal visible={!!reasonOpen} transparent animationType={'fade'}>
        <View style={s.modalWrap}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>
              {reasonOpen === 'reject' ? 'Return for correction' : 'Cancel this load'}
            </Text>
            <TextInput
              style={s.modalInput}
              placeholder={'Reason'}
              placeholderTextColor={C.muted}
              multiline
              value={reason}
              onChangeText={setReason}
            />
            <View style={s.modalRow}>
              <TouchableOpacity
                style={s.secondaryBtn}
                onPress={() => setReasonOpen(null)}>
                <Text style={s.secondaryBtnText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.primaryBtn, {flex: 1}]}
                onPress={submitReason}>
                <Text style={s.primaryBtnText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
