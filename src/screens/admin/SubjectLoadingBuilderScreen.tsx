/**
 * SubjectLoadingBuilderScreen
 *
 * Registrar / adviser workspace. Pick subjects, watch the engine validate the
 * basket live, override with a reason where policy allows, then save + submit.
 *
 * Navigate with:
 *   navigation.navigate('SubjectLoadingBuilder', { studentId, studentName })
 */
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
  BasketEntry,
  EligibilityVerdict,
  OfferedSubject,
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
  redSoft: '#FCEBE9',
};

const NEWLINE = String.fromCharCode(10);

type Props = {navigation: any; route: any};

export default function SubjectLoadingBuilderScreen({navigation, route}: Props) {
  const studentId: number = route?.params?.studentId;
  const studentNameParam: string = route?.params?.studentName || '';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [studentName, setStudentName] = useState(studentNameParam);
  const [offered, setOffered] = useState<OfferedSubject[]>([]);
  const [basket, setBasket] = useState<BasketEntry[]>([]);
  const [verdict, setVerdict] = useState<EligibilityVerdict | null>(null);
  const [current, setCurrent] = useState<SubjectLoading | null>(null);
  const [skipped, setSkipped] = useState<{code: string; message: string}[]>([]);
  const [policyName, setPolicyName] = useState('');
  const [allowOverride, setAllowOverride] = useState(false);
  const [query, setQuery] = useState('');

  const [overrideTarget, setOverrideTarget] = useState<OfferedSubject | null>(null);
  const [overrideReason, setOverrideReason] = useState('');

  const load = useCallback(async () => {
    if (!studentId) {
      setError('No student was passed to this screen.');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await subjectLoadingService.context(studentId);
      setOffered(res.offered_subjects || []);
      setSkipped(res.checks_skipped || []);
      setCurrent(res.current_load || null);
      setStudentName(res.context?.student_name || studentNameParam);
      setPolicyName(res.policy?.name || 'System default');
      setAllowOverride(!!res.policy?.allow_override);

      const seeded: BasketEntry[] = (res.current_load?.items || []).map(item => ({
        subject_id: item.subject_id,
        schedule_id: item.schedule_id || null,
        section_id: item.section_id || null,
        load_type: item.load_type || 'regular',
        is_override: item.is_override,
        override_reason: item.override_reason || null,
      }));
      setBasket(seeded);
    } catch (e: any) {
      setError(e.message || 'Could not load the subject loading workspace.');
    } finally {
      setLoading(false);
    }
  }, [studentId, studentNameParam]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    if (!studentId) {
      return;
    }
    if (basket.length === 0) {
      setVerdict(null);
      return;
    }
    setChecking(true);
    subjectLoadingService
      .checkEligibility(studentId, basket, false)
      .then(res => {
        if (!cancelled) {
          setVerdict(res);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setChecking(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [basket, studentId]);

  const basketIds = useMemo(() => basket.map(b => b.subject_id), [basket]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return offered;
    }
    return offered.filter(item => {
      const name = (item.subject_name || '').toLowerCase();
      const code = (item.subject_code || '').toLowerCase();
      return name.indexOf(q) >= 0 || code.indexOf(q) >= 0;
    });
  }, [offered, query]);

  const toggle = (subject: OfferedSubject) => {
    if (basketIds.indexOf(subject.subject_id) >= 0) {
      setBasket(prev => prev.filter(b => b.subject_id !== subject.subject_id));
      return;
    }

    const reasons = subject.violations.map(v => v.message).join(NEWLINE + NEWLINE);

    if (subject.hard_blocked) {
      Alert.alert('Cannot load this subject', reasons);
      return;
    }

    if (!subject.eligible) {
      if (!allowOverride) {
        Alert.alert(
          'Blocked by policy',
          reasons + NEWLINE + NEWLINE + 'Overrides are disabled for this load policy.',
        );
        return;
      }
      setOverrideReason('');
      setOverrideTarget(subject);
      return;
    }

    const onlySchedule =
      subject.schedules && subject.schedules.length === 1
        ? subject.schedules[0].id
        : null;

    setBasket(prev => [
      ...prev,
      {
        subject_id: subject.subject_id,
        schedule_id: onlySchedule,
        load_type: 'regular',
      },
    ]);
  };

  const confirmOverride = () => {
    if (!overrideTarget) {
      return;
    }
    if (overrideReason.trim().length < 10) {
      Alert.alert(
        'Reason required',
        'Write at least 10 characters explaining the exception. It is stored in the audit trail.',
      );
      return;
    }
    setBasket(prev => [
      ...prev,
      {
        subject_id: overrideTarget.subject_id,
        schedule_id: null,
        load_type: 'regular',
        is_override: true,
        override_reason: overrideReason.trim(),
      },
    ]);
    setOverrideTarget(null);
    setOverrideReason('');
  };

  const save = async (thenSubmit: boolean) => {
    try {
      setSaving(true);
      const res = await subjectLoadingService.save(studentId, basket);
      let latest = res.loading;

      if (thenSubmit) {
        const sub = await subjectLoadingService.submit(latest.id);
        latest = sub.loading;
      }

      setCurrent(latest);
      Alert.alert(
        'Saved',
        thenSubmit
          ? 'Subject load submitted for approval.'
          : 'Draft subject load saved.',
      );
    } catch (e: any) {
      Alert.alert('Could not save', e.message || 'Unknown error.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.center}>
        <ActivityIndicator size={'large'} color={C.green} />
        <Text style={s.muted}>Loading curriculum and rules...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={s.center}>
        <Text style={s.errorTitle}>Something went wrong</Text>
        <Text style={s.muted}>{error}</Text>
        <TouchableOpacity style={s.primaryBtn} onPress={load}>
          <Text style={s.primaryBtnText}>Try again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const totals = verdict ? verdict.totals : null;
  const blocked = verdict ? !verdict.eligible : false;

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.back}>Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Subject Loading</Text>
        <Text style={s.subtitle}>{studentName || 'Student #' + studentId}</Text>
        <Text style={s.policy}>Policy: {policyName}</Text>
      </View>

      <View style={s.summary}>
        <View style={s.summaryCell}>
          <Text style={s.summaryValue}>{basket.length}</Text>
          <Text style={s.summaryLabel}>subjects</Text>
        </View>
        <View style={s.summaryCell}>
          <Text style={s.summaryValue}>{totals ? totals.units : 0}</Text>
          <Text style={s.summaryLabel}>units</Text>
        </View>
        <View style={s.summaryCell}>
          <Text style={s.summaryValue}>{totals ? totals.max_units : '-'}</Text>
          <Text style={s.summaryLabel}>max</Text>
        </View>
        <View style={s.summaryCell}>
          {checking ? (
            <ActivityIndicator color={C.green} />
          ) : (
            <Text
              style={[
                s.summaryValue,
                {color: blocked ? C.red : C.green, fontSize: 14},
              ]}>
              {blocked ? 'BLOCKED' : 'OK'}
            </Text>
          )}
          <Text style={s.summaryLabel}>status</Text>
        </View>
      </View>

      {current ? (
        <View style={s.statusStrip}>
          <Text style={s.statusStripText}>
            Existing load #{current.id} is {current.status.toUpperCase()}
            {current.load_number ? ' (' + current.load_number + ')' : ''}
          </Text>
        </View>
      ) : null}

      {verdict && verdict.basket_violations.length > 0 ? (
        <View style={s.alertBox}>
          {verdict.basket_violations.map((v, i) => (
            <Text key={i} style={s.alertText}>
              {v.message}
            </Text>
          ))}
        </View>
      ) : null}

      {skipped.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.skipRow}>
          {skipped.map(sk => (
            <View key={sk.code} style={s.skipChip}>
              <Text style={s.skipChipText}>Not enforced: {sk.code}</Text>
            </View>
          ))}
        </ScrollView>
      ) : null}

      <TextInput
        style={s.search}
        placeholder={'Search subjects'}
        placeholderTextColor={C.muted}
        value={query}
        onChangeText={setQuery}
      />

      <FlatList
        data={filtered}
        keyExtractor={item => String(item.subject_id)}
        contentContainerStyle={{paddingBottom: 140}}
        renderItem={({item}) => {
          const selected = basketIds.indexOf(item.subject_id) >= 0;
          const entry = basket.find(b => b.subject_id === item.subject_id);
          const tone = item.hard_blocked
            ? C.red
            : item.eligible
            ? C.green
            : C.amber;

          return (
            <TouchableOpacity
              style={[s.row, selected ? s.rowSelected : null]}
              onPress={() => toggle(item)}
              activeOpacity={0.8}>
              <View style={[s.dot, {backgroundColor: tone}]} />
              <View style={{flex: 1}}>
                <Text style={s.rowTitle}>
                  {item.subject_code ? item.subject_code + ' - ' : ''}
                  {item.subject_name || 'Subject #' + item.subject_id}
                </Text>
                <Text style={s.rowMeta}>
                  {item.units} units
                  {entry && entry.is_override ? '   OVERRIDDEN' : ''}
                </Text>
                {item.violations.map((v, i) => (
                  <Text
                    key={i}
                    style={[
                      s.violation,
                      {color: v.severity === 'block' ? C.red : C.amber},
                    ]}>
                    {v.message}
                  </Text>
                ))}
              </View>
              <Text style={[s.check, {color: selected ? C.green : C.muted}]}>
                {selected ? 'REMOVE' : 'ADD'}
              </Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={s.center}>
            <Text style={s.muted}>
              No subjects are offered for this curriculum and term.
            </Text>
          </View>
        }
      />

      <View style={s.footer}>
        <TouchableOpacity
          style={[s.secondaryBtn, saving ? s.disabled : null]}
          disabled={saving}
          onPress={() => save(false)}>
          <Text style={s.secondaryBtnText}>Save draft</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.primaryBtn, {flex: 1}, saving || blocked ? s.disabled : null]}
          disabled={saving || blocked}
          onPress={() => save(true)}>
          <Text style={s.primaryBtnText}>
            {saving ? 'Working...' : 'Save and submit'}
          </Text>
        </TouchableOpacity>
      </View>

      <Modal visible={!!overrideTarget} transparent animationType={'fade'}>
        <View style={s.modalWrap}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Authorise an exception</Text>
            <Text style={s.modalBody}>{overrideTarget?.subject_name}</Text>
            {(overrideTarget?.violations || []).map((v, i) => (
              <Text key={i} style={s.modalRule}>
                {v.code}: {v.message}
              </Text>
            ))}
            <TextInput
              style={s.modalInput}
              placeholder={'Reason for the override (stored in the audit trail)'}
              placeholderTextColor={C.muted}
              multiline
              value={overrideReason}
              onChangeText={setOverrideReason}
            />
            <View style={s.modalRow}>
              <TouchableOpacity
                style={s.secondaryBtn}
                onPress={() => setOverrideTarget(null)}>
                <Text style={s.secondaryBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.primaryBtn, {flex: 1}]}
                onPress={confirmOverride}>
                <Text style={s.primaryBtnText}>Override and add</Text>
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: C.bg,
  },
  header: {paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10},
  back: {color: C.green, fontWeight: '600', marginBottom: 6},
  title: {fontSize: 22, fontWeight: '700', color: C.ink},
  subtitle: {fontSize: 15, color: C.ink, marginTop: 2},
  policy: {fontSize: 12, color: C.muted, marginTop: 2},
  summary: {
    flexDirection: 'row',
    backgroundColor: C.card,
    marginHorizontal: 14,
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: C.line,
  },
  summaryCell: {flex: 1, alignItems: 'center'},
  summaryValue: {fontSize: 18, fontWeight: '700', color: C.ink},
  summaryLabel: {fontSize: 11, color: C.muted, marginTop: 2},
  statusStrip: {
    marginHorizontal: 14,
    marginTop: 10,
    backgroundColor: C.greenSoft,
    borderRadius: 10,
    padding: 10,
  },
  statusStripText: {color: C.green, fontSize: 12, fontWeight: '600'},
  alertBox: {
    marginHorizontal: 14,
    marginTop: 10,
    backgroundColor: C.redSoft,
    borderRadius: 10,
    padding: 12,
  },
  alertText: {color: C.red, fontSize: 13, marginBottom: 4},
  skipRow: {marginTop: 10, paddingHorizontal: 14, maxHeight: 40},
  skipChip: {
    backgroundColor: C.amberSoft,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    height: 30,
  },
  skipChipText: {color: C.amber, fontSize: 11, fontWeight: '600'},
  search: {
    margin: 14,
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: C.ink,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: C.card,
    marginHorizontal: 14,
    marginBottom: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.line,
  },
  rowSelected: {borderColor: C.green, backgroundColor: C.greenSoft},
  dot: {width: 8, height: 8, borderRadius: 4, marginTop: 6, marginRight: 12},
  rowTitle: {fontSize: 15, fontWeight: '600', color: C.ink},
  rowMeta: {fontSize: 12, color: C.muted, marginTop: 2},
  violation: {fontSize: 12, marginTop: 6, lineHeight: 16},
  check: {fontSize: 11, fontWeight: '700', marginLeft: 10},
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    padding: 14,
    backgroundColor: C.card,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  primaryBtn: {
    backgroundColor: C.green,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  primaryBtnText: {color: '#FFFFFF', fontWeight: '700'},
  secondaryBtn: {
    backgroundColor: C.bg,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: C.line,
  },
  secondaryBtnText: {color: C.ink, fontWeight: '600'},
  disabled: {opacity: 0.5},
  muted: {color: C.muted, textAlign: 'center', marginTop: 8},
  errorTitle: {fontSize: 17, fontWeight: '700', color: C.ink},
  modalWrap: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  modal: {backgroundColor: C.card, borderRadius: 16, padding: 18},
  modalTitle: {fontSize: 17, fontWeight: '700', color: C.ink},
  modalBody: {fontSize: 14, color: C.ink, marginTop: 6, fontWeight: '600'},
  modalRule: {fontSize: 12, color: C.red, marginTop: 6},
  modalInput: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
    minHeight: 90,
    textAlignVertical: 'top',
    color: C.ink,
  },
  modalRow: {flexDirection: 'row', marginTop: 14},
});
