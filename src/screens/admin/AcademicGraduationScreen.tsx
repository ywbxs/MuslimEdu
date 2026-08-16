import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import graduation from '../../services/graduationService';
import { useLocale } from '../../context/LocaleContext';

const C = {
  bg: '#F5F7F6',
  card: '#FFF',
  ink: '#12211C',
  muted: '#6B7C76',
  line: '#E3EAE7',
  green: '#0F7A3D',
  red: '#C0392B',
  amber: '#B7791F',
};

const DECISION_COLOR: Record<string, string> = {
  eligible: C.green,
  approved: C.green,
  ineligible: C.red,
  rejected: C.red,
  deferred: C.amber,
};

export default function AcademicGraduationScreen({ navigation }: any) {
  const { t } = useLocale();
  const [tab, setTab] = useState<'evaluate' | 'requirements' | 'records'>('evaluate');

  // --- evaluate tab ---
  const [student, setStudent] = useState('');
  const [type, setType] = useState('graduation');
  const [ev, setEv] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  // --- requirements tab ---
  const [sets, setSets] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [minCredits, setMinCredits] = useState('');
  const [minGpa, setMinGpa] = useState('');
  const [maxFailed, setMaxFailed] = useState('');
  const [minAttendance, setMinAttendance] = useState('');
  const [requiredSubjects, setRequiredSubjects] = useState('');

  // --- records tab ---
  const [records, setRecords] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [reason, setReason] = useState('');
  const [audits, setAudits] = useState<any[]>([]);

  const loadRequirements = useCallback(async () => {
    try {
      const r = await graduation.requirements();
      setSets(r.sets || []);
    } catch (e: any) {
      Alert.alert(t('academic_graduation.load_requirements_error', 'Could not load requirement sets'), e.message);
    }
  }, [t]);

  const loadRecords = useCallback(async () => {
    try {
      const r = await graduation.list();
      setRecords(r.data || r.snapshots || []);
    } catch (e: any) {
      Alert.alert(t('academic_graduation.load_records_error', 'Could not load completion records'), e.message);
    }
  }, [t]);

  useEffect(() => {
    loadRequirements();
    loadRecords();
  }, [loadRequirements, loadRecords]);

  const evaluate = async () => {
    if (!student) {
      Alert.alert(t('academic_graduation.enter_student_id', 'Enter a student ID first'));
      return;
    }
    try {
      setBusy(true);
      setEv(await graduation.evaluate(Number(student), type));
    } catch (e: any) {
      Alert.alert(t('academic_graduation.evaluate_error', 'Could not evaluate'), e.message);
    } finally {
      setBusy(false);
    }
  };

  const saveSnapshot = async () => {
    if (!student) return;
    try {
      await graduation.save({ student_id: Number(student), completion_type: type });
      Alert.alert(t('academic_graduation.saved', 'Saved'), t('academic_graduation.snapshot_saved', 'Completion snapshot saved for review.'));
      loadRecords();
    } catch (e: any) {
      Alert.alert(t('academic_graduation.save_error', 'Could not save'), e.message);
    }
  };

  const saveRequirementSet = async () => {
    if (!name || !minCredits) {
      Alert.alert(t('academic_graduation.name_credits_required', 'Name and minimum credits are required'));
      return;
    }
    try {
      await graduation.saveRequirement({
        name,
        requirements: {
          minimum_credits: Number(minCredits),
          minimum_gpa: minGpa ? Number(minGpa) : undefined,
          maximum_failed_subjects: maxFailed ? Number(maxFailed) : undefined,
          minimum_attendance: minAttendance ? Number(minAttendance) : undefined,
          required_subject_ids: requiredSubjects
            ? requiredSubjects.split(',').map((x) => Number(x.trim())).filter(Boolean)
            : [],
        },
      });
      Alert.alert(t('academic_graduation.saved', 'Saved'), t('academic_graduation.requirement_set_active', 'Requirement set is now active.'));
      setName('');
      setMinCredits('');
      setMinGpa('');
      setMaxFailed('');
      setMinAttendance('');
      setRequiredSubjects('');
      loadRequirements();
    } catch (e: any) {
      Alert.alert(t('academic_graduation.save_requirement_error', 'Could not save requirement set'), e.message);
    }
  };

  const openRecord = async (rec: any) => {
    setSelected(rec);
    setReason('');
    try {
      const r = await graduation.audit(rec.id);
      setAudits(r.audits || []);
    } catch {
      setAudits([]);
    }
  };

  const decide = async (decision: string) => {
    if (!selected) return;
    try {
      await graduation.approve({ id: selected.id, decision, reason: reason || undefined });
      Alert.alert(t('academic_graduation.updated', 'Updated'), t('academic_graduation.marked_as', 'Marked as {decision}.').replace('{decision}', decision));
      setSelected(null);
      loadRecords();
    } catch (e: any) {
      Alert.alert(t('academic_graduation.update_decision_error', 'Could not update decision'), e.message);
    }
  };

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.back}>{t('academic_graduation.back', 'Back')}</Text>
        </TouchableOpacity>
        <Text style={s.title}>{t('academic_graduation.title', 'Graduation & Completion')}</Text>
        <Text style={s.sub}>
          {t('academic_graduation.subtitle', 'Requirement sets, per-student eligibility evaluation, and approval decisions.')}
        </Text>
      </View>

      <View style={s.tabs}>
        {(['evaluate', 'requirements', 'records'] as const).map((tabKey) => (
          <TouchableOpacity
            key={tabKey}
            onPress={() => setTab(tabKey)}
            style={[s.tab, tab === tabKey && s.tabActive]}
          >
            <Text style={[s.tabText, tab === tabKey && s.tabTextActive]}>
              {tabKey === 'evaluate'
                ? t('academic_graduation.tab_evaluate', 'Evaluate')
                : tabKey === 'requirements'
                ? t('academic_graduation.tab_requirements', 'Requirements')
                : t('academic_graduation.tab_records', 'Records')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'evaluate' && (
        <ScrollView contentContainerStyle={s.content}>
          <View style={s.card}>
            <TextInput
              style={s.input}
              placeholder={t('academic_graduation.student_id_placeholder', 'Student ID')}
              placeholderTextColor={C.muted}
              value={student}
              onChangeText={setStudent}
              keyboardType="numeric"
            />
            <TextInput
              style={s.input}
              placeholder={t('academic_graduation.completion_type_placeholder', 'Completion type (graduation / promotion)')}
              placeholderTextColor={C.muted}
              value={type}
              onChangeText={setType}
            />
            <View style={s.row}>
              <TouchableOpacity style={s.secondary} onPress={evaluate}>
                <Text>{t('academic_graduation.evaluate', 'Evaluate')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.primary, { flex: 1 }]} onPress={saveSnapshot}>
                <Text style={s.primaryText}>{t('academic_graduation.save_snapshot', 'Save snapshot')}</Text>
              </TouchableOpacity>
            </View>
            {busy ? <ActivityIndicator color={C.green} /> : null}
            {ev ? (
              <View style={s.result}>
                <Text style={[s.decision, { color: DECISION_COLOR[ev.decision] || C.ink }]}>
                  {String(ev.decision).toUpperCase()}
                </Text>
                <Text style={s.meta}>
                  {t('academic_graduation.eval_meta', 'Credits: {credits} · GPA: {gpa} · Failed: {failed} · Attendance: {attendance}%')
                    .replace('{credits}', String(ev.credits ?? '-'))
                    .replace('{gpa}', String(ev.gpa ?? '-'))
                    .replace('{failed}', String(ev.failed ?? 0))
                    .replace('{attendance}', String(ev.attendance ?? '-'))}
                </Text>
                {(ev.reasons || []).length === 0 ? (
                  <Text style={s.okText}>{t('academic_graduation.all_requirements_met', 'All requirements met.')}</Text>
                ) : (
                  (ev.reasons || []).map((x: string, i: number) => (
                    <Text key={i} style={s.reason}>
                      • {x}
                    </Text>
                  ))
                )}
              </View>
            ) : null}
          </View>
        </ScrollView>
      )}

      {tab === 'requirements' && (
        <ScrollView contentContainerStyle={s.content}>
          <View style={s.card}>
            <Text style={s.label}>{t('academic_graduation.new_update_set', 'New / update requirement set')}</Text>
            <TextInput
              style={s.input}
              placeholder={t('academic_graduation.name_placeholder', 'Name')}
              placeholderTextColor={C.muted}
              value={name}
              onChangeText={setName}
            />
            <TextInput
              style={s.input}
              placeholder={t('academic_graduation.min_credits_placeholder', 'Minimum credits')}
              placeholderTextColor={C.muted}
              value={minCredits}
              onChangeText={setMinCredits}
              keyboardType="numeric"
            />
            <TextInput
              style={s.input}
              placeholder={t('academic_graduation.min_gpa_placeholder', 'Minimum GPA (optional)')}
              placeholderTextColor={C.muted}
              value={minGpa}
              onChangeText={setMinGpa}
              keyboardType="numeric"
            />
            <TextInput
              style={s.input}
              placeholder={t('academic_graduation.max_failed_placeholder', 'Maximum failed subjects (optional)')}
              placeholderTextColor={C.muted}
              value={maxFailed}
              onChangeText={setMaxFailed}
              keyboardType="numeric"
            />
            <TextInput
              style={s.input}
              placeholder={t('academic_graduation.min_attendance_placeholder', 'Minimum attendance % (optional)')}
              placeholderTextColor={C.muted}
              value={minAttendance}
              onChangeText={setMinAttendance}
              keyboardType="numeric"
            />
            <TextInput
              style={s.input}
              placeholder={t('academic_graduation.required_subjects_placeholder', 'Required subject IDs, comma separated (optional)')}
              placeholderTextColor={C.muted}
              value={requiredSubjects}
              onChangeText={setRequiredSubjects}
            />
            <TouchableOpacity style={s.primary} onPress={saveRequirementSet}>
              <Text style={s.primaryText}>{t('academic_graduation.save_requirement_set', 'Save requirement set')}</Text>
            </TouchableOpacity>
          </View>

          <Text style={s.sectionLabel}>{t('academic_graduation.existing_sets', 'Existing sets')}</Text>
          {sets.length === 0 ? (
            <Text style={s.empty}>{t('academic_graduation.no_sets', 'No requirement sets configured yet.')}</Text>
          ) : (
            sets.map((set) => (
              <View key={set.id} style={s.card}>
                <Text style={s.item}>{set.name}</Text>
                <Text style={s.meta}>
                  {t('academic_graduation.set_meta', 'Credits ≥ {credits} · GPA ≥ {gpa} · Attendance ≥ {attendance}%')
                    .replace('{credits}', String(set.requirements?.minimum_credits ?? '-'))
                    .replace('{gpa}', String(set.requirements?.minimum_gpa ?? '-'))
                    .replace('{attendance}', String(set.requirements?.minimum_attendance ?? '-'))}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {tab === 'records' && (
        <View style={s.flex1}>
          <FlatList
            contentContainerStyle={s.content}
            data={records}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <TouchableOpacity style={s.card} onPress={() => openRecord(item)}>
                <Text style={s.item}>{t('academic_graduation.student_hash', 'Student #{id}').replace('{id}', String(item.student_id))}</Text>
                <Text
                  style={[s.decision, { fontSize: 14, color: DECISION_COLOR[item.decision] || C.ink }]}
                >
                  {String(item.decision).toUpperCase()}
                </Text>
                <Text style={s.meta}>{item.completion_type}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={s.empty}>{t('academic_graduation.no_records', 'No completion records yet.')}</Text>}
          />
          {selected ? (
            <View style={s.sheet}>
              <Text style={s.item}>
                {t('academic_graduation.student_hash', 'Student #{id}').replace('{id}', String(selected.student_id))} · {selected.completion_type}
              </Text>
              <TextInput
                style={s.input}
                placeholder={t('academic_graduation.reason_placeholder', 'Reason (optional)')}
                placeholderTextColor={C.muted}
                value={reason}
                onChangeText={setReason}
              />
              <View style={s.row}>
                <TouchableOpacity style={s.secondary} onPress={() => decide('approved')}>
                  <Text style={{ color: C.green }}>{t('academic_graduation.approve', 'Approve')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.secondary} onPress={() => decide('deferred')}>
                  <Text style={{ color: C.amber }}>{t('academic_graduation.defer', 'Defer')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.secondary} onPress={() => decide('rejected')}>
                  <Text style={{ color: C.red }}>{t('academic_graduation.reject', 'Reject')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.secondary} onPress={() => setSelected(null)}>
                  <Text>{t('common.close', 'Close')}</Text>
                </TouchableOpacity>
              </View>
              {audits.length > 0 ? (
                <View>
                  <Text style={s.sectionLabel}>{t('academic_graduation.audit_trail', 'Audit trail')}</Text>
                  {audits.map((a) => (
                    <Text key={a.id} style={s.meta}>
                      {a.action} by #{a.actor_id} {a.reason ? `— ${a.reason}` : ''}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  flex1: { flex: 1 },
  header: { padding: 18 },
  back: { color: C.green, fontWeight: '700', marginBottom: 6 },
  title: { fontSize: 23, fontWeight: '700', color: C.ink },
  sub: { color: C.muted, marginTop: 4, lineHeight: 18 },
  tabs: { flexDirection: 'row', paddingHorizontal: 14, marginBottom: 6 },
  tab: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, marginRight: 8, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  tabActive: { backgroundColor: C.green, borderColor: C.green },
  tabText: { color: C.muted, fontWeight: '600' },
  tabTextActive: { color: '#FFF' },
  content: { padding: 14, paddingBottom: 40 },
  card: { backgroundColor: C.card, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: C.line, marginBottom: 10 },
  input: { borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 11, color: C.ink, marginBottom: 9 },
  label: { color: C.muted, fontSize: 12, marginBottom: 8 },
  sectionLabel: { color: C.ink, fontWeight: '700', marginTop: 6, marginBottom: 8, marginLeft: 2 },
  row: { flexDirection: 'row' },
  primary: { backgroundColor: C.green, borderRadius: 10, padding: 13, alignItems: 'center' },
  primaryText: { color: '#FFF', fontWeight: '700' },
  secondary: { backgroundColor: C.bg, borderRadius: 10, padding: 13, marginRight: 8, borderWidth: 1, borderColor: C.line },
  result: { marginTop: 13, backgroundColor: '#E7F4EF', padding: 12, borderRadius: 10 },
  decision: { fontWeight: '800', fontSize: 18 },
  meta: { color: C.muted, marginTop: 5 },
  reason: { color: C.red, marginTop: 5 },
  okText: { color: C.green, marginTop: 5, fontWeight: '600' },
  item: { fontSize: 15, fontWeight: '700', color: C.ink },
  empty: { color: C.muted, textAlign: 'center', marginTop: 20 },
  sheet: { backgroundColor: C.card, borderTopWidth: 1, borderColor: C.line, padding: 14 },
});
