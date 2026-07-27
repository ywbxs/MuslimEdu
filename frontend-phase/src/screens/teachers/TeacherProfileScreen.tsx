import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import teacherPortalService, { TeacherProfile } from '../../services/teacherPortalService';
import { C } from '../nextPhaseTheme';

export default function TeacherProfileScreen() {
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [stats, setStats] = useState({ sections: 0, examinations: 0, published: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    teacherPortalService
      .profile()
      .then(res => {
        setProfile(res.profile);
        setStats(res.stats);
      })
      .catch(e => setError(e?.message ?? 'Could not load your profile.'))
      .finally(() => setLoading(false));
  }, []);

  const field = (key: keyof TeacherProfile, value: string) =>
    setProfile(prev => (prev ? { ...prev, [key]: value } : prev));

  const save = async () => {
    if (!profile) return;

    setSaving(true);
    try {
      await teacherPortalService.updateProfile({
        name: profile.name,
        phone: profile.phone,
        address: profile.address,
        gender: profile.gender,
        date_of_birth: profile.date_of_birth,
        qualification: profile.qualification,
        designation: profile.designation,
        bio: profile.bio,
      });
      Alert.alert('Saved', 'Your profile has been updated.');
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

    setChangingPassword(true);
    try {
      await teacherPortalService.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      Alert.alert('Password changed', 'Use your new password next time you sign in.');
    } catch (e: any) {
      Alert.alert('Could not change password', e?.message ?? 'Please try again.');
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.center}>
        <ActivityIndicator color={C.green} />
      </SafeAreaView>
    );
  }

  if (error || !profile) {
    return (
      <SafeAreaView style={s.center}>
        <Text style={s.error}>{error ?? 'Profile unavailable.'}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps='handled'>
          <View style={s.hero}>
            {profile.photo ? (
              <Image source={{ uri: profile.photo }} style={s.avatar} />
            ) : (
              <View style={[s.avatar, s.avatarFallback]}>
                <Text style={s.avatarText}>{(profile.name || '?').charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{profile.name}</Text>
              <Text style={s.email}>{profile.email}</Text>
              {profile.designation ? <Text style={s.designation}>{profile.designation}</Text> : null}
            </View>
          </View>

          <View style={s.stats}>
            <Stat label='My sections' value={stats.sections} />
            <Stat label='Examinations' value={stats.examinations} />
            <Stat label='Published' value={stats.published} />
          </View>

          <Text style={s.section}>Details</Text>
          <Field label='Full name' value={profile.name ?? ''} onChange={v => field('name', v)} />
          <Field label='Phone' value={profile.phone ?? ''} onChange={v => field('phone', v)} keyboard='phone-pad' />
          <Field label='Designation' value={profile.designation ?? ''} onChange={v => field('designation', v)} />
          <Field label='Qualification' value={profile.qualification ?? ''} onChange={v => field('qualification', v)} />
          <Field
            label='Date of birth (YYYY-MM-DD)'
            value={profile.date_of_birth ?? ''}
            onChange={v => field('date_of_birth', v)}
          />
          <Field label='Address' value={profile.address ?? ''} onChange={v => field('address', v)} multiline />
          <Field label='About you' value={profile.bio ?? ''} onChange={v => field('bio', v)} multiline />

          <TouchableOpacity style={[s.primary, saving && s.disabled]} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color='#FFFFFF' /> : <Text style={s.primaryText}>Save profile</Text>}
          </TouchableOpacity>

          <Text style={s.section}>Password</Text>
          <Field label='Current password' value={currentPassword} onChange={setCurrentPassword} secure />
          <Field label='New password' value={newPassword} onChange={setNewPassword} secure hint='At least 8 characters.' />

          <TouchableOpacity
            style={[s.secondary, changingPassword && s.disabled]}
            onPress={changePassword}
            disabled={changingPassword}
          >
            {changingPassword ? (
              <ActivityIndicator color={C.ink} />
            ) : (
              <Text style={s.secondaryText}>Change password</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={s.stat}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline,
  secure,
  keyboard,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  secure?: boolean;
  keyboard?: any;
  hint?: string;
}) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        style={[s.input, multiline && s.inputMultiline]}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        secureTextEntry={secure}
        keyboardType={keyboard}
        autoCapitalize={secure ? 'none' : 'sentences'}
        placeholderTextColor='#9AA8A3'
      />
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg, padding: 24 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18 },
  avatar: { width: 66, height: 66, borderRadius: 22 },
  avatarFallback: { backgroundColor: C.greenSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: C.green, fontWeight: '800', fontSize: 25 },
  name: { fontSize: 21, fontWeight: '700', color: C.ink },
  email: { color: C.muted, marginTop: 2 },
  designation: { color: C.green, fontWeight: '600', marginTop: 3, fontSize: 13 },
  stats: { flexDirection: 'row', gap: 8, paddingHorizontal: 14 },
  stat: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    paddingVertical: 13,
    alignItems: 'center',
  },
  statValue: { fontSize: 20, fontWeight: '800', color: C.ink },
  statLabel: { fontSize: 11, color: C.muted, marginTop: 3 },
  section: { color: C.muted, fontWeight: '800', fontSize: 12, marginHorizontal: 18, marginTop: 24, letterSpacing: 0.5 },
  field: { marginHorizontal: 14, marginTop: 12 },
  label: { fontSize: 12, fontWeight: '700', color: C.muted, marginBottom: 6, marginHorizontal: 4 },
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
  inputMultiline: { minHeight: 86, textAlignVertical: 'top' },
  hint: { fontSize: 11.5, color: C.muted, marginTop: 5, marginHorizontal: 4 },
  primary: {
    backgroundColor: C.green,
    marginHorizontal: 14,
    marginTop: 20,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  secondary: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    marginHorizontal: 14,
    marginTop: 18,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryText: { color: C.ink, fontWeight: '700', fontSize: 15 },
  disabled: { opacity: 0.6 },
  error: { color: C.red, textAlign: 'center' },
});
