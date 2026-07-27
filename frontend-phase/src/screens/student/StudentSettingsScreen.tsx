import React, { useEffect, useState } from 'react';
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
import studentPortalService, { SettingsOptions, UserSettings } from '../../services/studentPortalService';
import { C } from '../nextPhaseTheme';

/**
 * Works for any signed-in role, not just students: the backend routes are
 * user_settings_show / user_settings_save. Registered under the student stack
 * because that is where the spec put it.
 */
type Props = { navigation: any };

export default function StudentSettingsScreen({ navigation }: Props) {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [options, setOptions] = useState<SettingsOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    studentPortalService
      .settings()
      .then(res => {
        setSettings(res.settings);
        setOptions(res.options);
      })
      .catch(e => setError(e?.message ?? 'Could not load settings.'))
      .finally(() => setLoading(false));
  }, []);

  const set = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setSettings(prev => (prev ? { ...prev, [key]: value } : prev));
    setDirty(true);
  };

  const save = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      await studentPortalService.saveSettings(settings);
      setDirty(false);
      Alert.alert('Saved', 'Your settings have been updated.');
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (newPassword.length < 8) {
      Alert.alert('Too short', 'Use at least 8 characters.');
      return;
    }

    setChanging(true);
    try {
      await studentPortalService.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      Alert.alert('Password changed', 'Use your new password next time you sign in.');
    } catch (e: any) {
      Alert.alert('Could not change password', e?.message ?? 'Please try again.');
    } finally {
      setChanging(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.center}>
        <ActivityIndicator color={C.green} />
      </SafeAreaView>
    );
  }

  if (error || !settings || !options) {
    return (
      <SafeAreaView style={s.center}>
        <Text style={s.error}>{error ?? 'Settings unavailable.'}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }} keyboardShouldPersistTaps='handled'>
        <Text style={s.title}>Settings</Text>
        <Text style={s.sub}>Language, display and privacy for this account.</Text>

        <Picker
          label='Language'
          value={settings.language}
          options={options.languages}
          onChange={v => set('language', v)}
        />
        <Picker label='Theme' value={settings.theme} options={options.themes} onChange={v => set('theme', v)} />
        <Picker
          label='Calendar'
          value={settings.calendar_type}
          options={options.calendar_types}
          onChange={v => set('calendar_type', v)}
        />
        <Picker
          label='Date format'
          value={settings.date_format}
          options={options.date_formats}
          onChange={v => set('date_format', v)}
        />

        <Text style={s.section}>Privacy</Text>
        <Picker
          label='Who can see my profile'
          value={settings.profile_visibility}
          options={options.profile_visibility}
          onChange={v => set('profile_visibility', v)}
        />

        <Toggle label='Show my email' value={settings.show_email} onChange={v => set('show_email', v)} />
        <Toggle label='Show my phone number' value={settings.show_phone} onChange={v => set('show_phone', v)} />

        <Text style={s.section}>Notifications</Text>
        <Picker
          label='Summary digest'
          value={settings.digest_frequency}
          options={options.digest_frequency}
          onChange={v => set('digest_frequency', v)}
        />

        <TouchableOpacity style={s.linkRow} onPress={() => navigation.navigate('NotificationPreferences')}>
          <Text style={s.linkRowText}>Per-category notification settings</Text>
          <Text style={s.linkRowChevron}>{'>'}</Text>
        </TouchableOpacity>

        <Text style={s.section}>Password</Text>
        <View style={s.field}>
          <Text style={s.label}>Current password</Text>
          <TextInput
            style={s.input}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            autoCapitalize='none'
          />
        </View>
        <View style={s.field}>
          <Text style={s.label}>New password</Text>
          <TextInput
            style={s.input}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            autoCapitalize='none'
          />
          <Text style={s.hint}>At least 8 characters.</Text>
        </View>

        <TouchableOpacity style={[s.secondary, changing && s.disabled]} onPress={changePassword} disabled={changing}>
          {changing ? <ActivityIndicator color={C.ink} /> : <Text style={s.secondaryText}>Change password</Text>}
        </TouchableOpacity>
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity style={[s.primary, (!dirty || saving) && s.disabled]} onPress={save} disabled={!dirty || saving}>
          {saving ? (
            <ActivityIndicator color='#FFFFFF' />
          ) : (
            <Text style={s.primaryText}>{dirty ? 'Save changes' : 'Saved'}</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function Picker({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <View style={s.chipWrap}>
        {options.map(opt => (
          <TouchableOpacity key={opt} style={[s.chip, value === opt && s.chipActive]} onPress={() => onChange(opt)}>
            <Text style={[s.chipText, value === opt && s.chipTextActive]}>{opt}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={s.toggleRow}>
      <Text style={s.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: C.greenSoft, false: C.line }}
        thumbColor={value ? C.green : '#F4F4F4'}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg, padding: 24 },
  title: { fontSize: 25, fontWeight: '700', color: C.ink, marginHorizontal: 18, marginTop: 16 },
  sub: { color: C.muted, marginHorizontal: 18, marginTop: 4 },
  section: { color: C.muted, fontWeight: '800', fontSize: 12, marginHorizontal: 18, marginTop: 24, letterSpacing: 0.5 },
  field: { marginHorizontal: 14, marginTop: 14 },
  label: { fontSize: 12, fontWeight: '700', color: C.muted, marginBottom: 8, marginHorizontal: 4 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.card,
  },
  chipActive: { backgroundColor: C.greenSoft, borderColor: C.green },
  chipText: { color: C.muted, fontSize: 13 },
  chipTextActive: { color: C.green, fontWeight: '700' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    marginHorizontal: 14,
    marginTop: 9,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
  },
  toggleLabel: { flex: 1, color: C.ink, fontWeight: '600' },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    marginHorizontal: 14,
    marginTop: 9,
    paddingHorizontal: 14,
    paddingVertical: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
  },
  linkRowText: { flex: 1, color: C.ink, fontWeight: '600' },
  linkRowChevron: { color: C.muted, fontWeight: '700' },
  input: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 11,
    paddingHorizontal: 13,
    paddingVertical: 11,
    color: C.ink,
    fontSize: 15,
  },
  hint: { fontSize: 11.5, color: C.muted, marginTop: 5, marginHorizontal: 4 },
  secondary: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    marginHorizontal: 14,
    marginTop: 16,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryText: { color: C.ink, fontWeight: '700', fontSize: 15 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 14,
    backgroundColor: C.card,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  primary: { backgroundColor: C.green, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  disabled: { opacity: 0.55 },
  error: { color: C.red, textAlign: 'center' },
});
