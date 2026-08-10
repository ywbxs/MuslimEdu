/**
 * LoadPolicyScreen
 *
 * Admin configuration of the rulebook the Subject Loading Engine enforces.
 * Nothing academic is hardcoded: every switch here changes engine behaviour.
 *
 * Navigate with: navigation.navigate('LoadPolicy')
 */
import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import subjectLoadingService from '../../services/subjectLoadingService';
import {useLocale} from '../../context/LocaleContext';

const C = {
  bg: '#F5F7F6',
  card: '#FFFFFF',
  ink: '#12211C',
  muted: '#6B7C76',
  line: '#E3EAE7',
  green: '#1E927E',
  red: '#C0392B',
};

const TOGGLES = [
  {key: 'enforce_curriculum', labelKey: 'enforce_curriculum', label: 'Subject must be in the curriculum'},
  {key: 'enforce_prerequisites', labelKey: 'enforce_prerequisites', label: 'Enforce prerequisites'},
  {key: 'enforce_corequisites', labelKey: 'enforce_corequisites', label: 'Enforce co-requisites'},
  {key: 'enforce_capacity', labelKey: 'enforce_capacity', label: 'Enforce section capacity'},
  {key: 'enforce_schedule_conflict', labelKey: 'enforce_schedule_conflict', label: 'Block timetable conflicts'},
  {key: 'enforce_max_units', labelKey: 'enforce_max_units', label: 'Enforce maximum units'},
  {key: 'enforce_min_units_on_submit', labelKey: 'enforce_min_units_on_submit', label: 'Enforce minimum units on submit'},
  {key: 'block_already_passed', labelKey: 'block_already_passed', label: 'Block subjects already passed'},
  {key: 'allow_retake', labelKey: 'allow_retake', label: 'Allow retakes'},
  {key: 'allow_override', labelKey: 'allow_override', label: 'Allow authorised overrides'},
  {key: 'require_approval', labelKey: 'require_approval', label: 'Require registrar approval'},
];

const EMPTY: any = {
  id: null,
  name: 'Default load policy',
  program_id: null,
  grade_level_id: null,
  min_units: 0,
  max_units: 30,
  default_units: 3,
  enforce_curriculum: true,
  enforce_prerequisites: true,
  enforce_corequisites: true,
  enforce_capacity: true,
  enforce_schedule_conflict: true,
  enforce_max_units: true,
  enforce_min_units_on_submit: false,
  block_already_passed: true,
  allow_retake: true,
  allow_override: true,
  require_approval: true,
  is_active: true,
};

type Props = {navigation: any};

export default function LoadPolicyScreen({navigation}: Props) {
  const {t} = useLocale();
  const [policies, setPolicies] = useState<any[]>([]);
  const [draft, setDraft] = useState<any>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const res = await subjectLoadingService.policyList();
      setPolicies(res.policies || []);
      if (res.policies && res.policies.length > 0) {
        setDraft({...EMPTY, ...res.policies[0]});
      }
    } catch (e: any) {
      Alert.alert(t('load_policy.load_error_title', 'Could not load policies'), e.message || t('load_policy.unknown_error', 'Unknown error.'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const save = async () => {
    if (Number(draft.min_units) > Number(draft.max_units)) {
      Alert.alert(t('load_policy.check_units_title', 'Check the units'), t('load_policy.check_units_message', 'Minimum units cannot exceed maximum units.'));
      return;
    }
    try {
      setSaving(true);
      const payload: any = {...draft};
      payload.min_units = Number(draft.min_units) || 0;
      payload.max_units = Number(draft.max_units) || 0;
      payload.default_units = Number(draft.default_units) || 3;
      const res = await subjectLoadingService.policySave(payload);
      setDraft({...EMPTY, ...res.policy});
      Alert.alert(t('load_policy.saved_title', 'Saved'), t('load_policy.saved_message', 'Load policy updated. It applies to the next validation.'));
      fetchAll();
    } catch (e: any) {
      Alert.alert(t('load_policy.save_error_title', 'Could not save'), e.message || t('load_policy.unknown_error', 'Unknown error.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.center}>
        <ActivityIndicator size={'large'} color={C.green} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView contentContainerStyle={{paddingBottom: 120}}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={s.back}>{t('common.back', 'Back')}</Text>
          </TouchableOpacity>
          <Text style={s.title}>{t('load_policy.title', 'Subject Load Policy')}</Text>
          <Text style={s.subtitle}>
            {policies.length} {t('load_policy.records_configured', 'policy record(s) configured for this school')}
          </Text>
        </View>

        {policies.length > 1 ? (
          <ScrollView horizontal style={s.pickRow} showsHorizontalScrollIndicator={false}>
            {policies.map(p => (
              <TouchableOpacity
                key={String(p.id)}
                style={[s.chip, draft.id === p.id ? s.chipActive : null]}
                onPress={() => setDraft({...EMPTY, ...p})}>
                <Text
                  style={[
                    s.chipText,
                    draft.id === p.id ? s.chipTextActive : null,
                  ]}>
                  {p.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}

        <View style={s.card}>
          <Text style={s.label}>{t('load_policy.policy_name', 'Policy name')}</Text>
          <TextInput
            style={s.input}
            value={String(draft.name || '')}
            onChangeText={v => setDraft({...draft, name: v})}
          />

          <View style={s.twoUp}>
            <View style={{flex: 1, marginRight: 8}}>
              <Text style={s.label}>{t('load_policy.minimum_units', 'Minimum units')}</Text>
              <TextInput
                style={s.input}
                keyboardType={'numeric'}
                value={String(draft.min_units)}
                onChangeText={v => setDraft({...draft, min_units: v})}
              />
            </View>
            <View style={{flex: 1}}>
              <Text style={s.label}>{t('load_policy.maximum_units', 'Maximum units')}</Text>
              <TextInput
                style={s.input}
                keyboardType={'numeric'}
                value={String(draft.max_units)}
                onChangeText={v => setDraft({...draft, max_units: v})}
              />
            </View>
          </View>

          <Text style={s.label}>{t('load_policy.default_units', 'Default units when a subject has none')}</Text>
          <TextInput
            style={s.input}
            keyboardType={'numeric'}
            value={String(draft.default_units)}
            onChangeText={v => setDraft({...draft, default_units: v})}
          />
        </View>

        <Text style={s.sectionTitle}>{t('load_policy.rules', 'Rules')}</Text>
        <View style={s.card}>
          {TOGGLES.map(toggle => (
            <View key={toggle.key} style={s.switchRow}>
              <Text style={s.switchLabel}>{t(`load_policy.toggle_${toggle.labelKey}`, toggle.label)}</Text>
              <Switch
                value={!!draft[toggle.key]}
                trackColor={{true: C.green, false: C.line}}
                onValueChange={v => setDraft({...draft, [toggle.key]: v})}
              />
            </View>
          ))}
        </View>

        <Text style={s.note}>
          {t('load_policy.note', 'Turning a rule off does not delete history. Every load stores a snapshot of the policy that was in force when it was approved.')}
        </Text>
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity
          style={[s.primaryBtn, saving ? s.disabled : null]}
          disabled={saving}
          onPress={save}>
          <Text style={s.primaryBtnText}>
            {saving ? t('load_policy.saving', 'Saving...') : t('load_policy.save_policy', 'Save policy')}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: {flex: 1, backgroundColor: C.bg},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg},
  header: {paddingHorizontal: 18, paddingTop: 12, paddingBottom: 8},
  back: {color: C.green, fontWeight: '600', marginBottom: 6},
  title: {fontSize: 22, fontWeight: '700', color: C.ink},
  subtitle: {fontSize: 12, color: C.muted, marginTop: 3},
  pickRow: {paddingHorizontal: 14, maxHeight: 46, marginBottom: 6},
  chip: {backgroundColor: C.card, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, borderWidth: 1, borderColor: C.line, height: 34},
  chipActive: {backgroundColor: C.green, borderColor: C.green},
  chipText: {fontSize: 12, color: C.muted, fontWeight: '600'},
  chipTextActive: {color: '#FFFFFF'},
  card: {backgroundColor: C.card, marginHorizontal: 14, marginBottom: 10, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: C.line},
  label: {fontSize: 12, color: C.muted, marginBottom: 6, marginTop: 8},
  input: {borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: C.ink},
  twoUp: {flexDirection: 'row'},
  sectionTitle: {fontSize: 13, fontWeight: '700', color: C.muted, marginHorizontal: 18, marginTop: 10, marginBottom: 8, letterSpacing: 0.5},
  switchRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line},
  switchLabel: {flex: 1, fontSize: 14, color: C.ink, paddingRight: 12},
  note: {fontSize: 12, color: C.muted, marginHorizontal: 18, marginTop: 10, lineHeight: 18},
  footer: {position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.line},
  primaryBtn: {backgroundColor: C.green, borderRadius: 12, paddingVertical: 15, alignItems: 'center'},
  primaryBtnText: {color: '#FFFFFF', fontWeight: '700'},
  disabled: {opacity: 0.5},
});
