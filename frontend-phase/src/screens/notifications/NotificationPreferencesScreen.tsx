import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import notificationService, { NotificationPreference } from '../../services/notificationService';
import { C } from '../nextPhaseTheme';

const LABELS: Record<string, string> = {
  announcement: 'Announcements',
  assessment: 'Assignments and assessments',
  grade: 'Grades and results',
  attendance: 'Attendance',
  lesson_plan: 'Lesson plans',
  material: 'Learning materials',
  enrollment: 'Enrollment',
  examination: 'Examinations',
  document: 'Document requests',
  service_request: 'Service requests',
  message: 'Messages',
  orphan_report: 'Child reports',
  system: 'System and account',
};

export default function NotificationPreferencesScreen() {
  const [prefs, setPrefs] = useState<NotificationPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    notificationService
      .preferences()
      .then(res => setPrefs(res.preferences))
      .catch(e => setError(e?.message ?? 'Could not load preferences.'))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (category: string, channel: 'in_app' | 'push' | 'email') => {
    setPrefs(prev => prev.map(p => (p.category === category ? { ...p, [channel]: !p[channel] } : p)));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await notificationService.savePreferences(prefs);
      setDirty(false);
      Alert.alert('Saved', 'Your notification preferences have been updated.');
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.center}>
        <ActivityIndicator color={C.green} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={s.center}>
        <Text style={s.error}>{error}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }}>
        <Text style={s.title}>Notification settings</Text>
        <Text style={s.sub}>
          Turning off In app also stops that category from being written to your inbox at all.
        </Text>

        <View style={s.legend}>
          <Text style={s.legendCell}>In app</Text>
          <Text style={s.legendCell}>Push</Text>
          <Text style={s.legendCell}>Email</Text>
        </View>

        {prefs.map(pref => (
          <View key={pref.category} style={s.row}>
            <Text style={s.rowLabel}>{LABELS[pref.category] ?? pref.category}</Text>
            <View style={s.switches}>
              <Switch
                value={pref.in_app}
                onValueChange={() => toggle(pref.category, 'in_app')}
                trackColor={{ true: C.greenSoft, false: C.line }}
                thumbColor={pref.in_app ? C.green : '#F4F4F4'}
              />
              <Switch
                value={pref.push}
                onValueChange={() => toggle(pref.category, 'push')}
                trackColor={{ true: C.greenSoft, false: C.line }}
                thumbColor={pref.push ? C.green : '#F4F4F4'}
              />
              <Switch
                value={pref.email}
                onValueChange={() => toggle(pref.category, 'email')}
                trackColor={{ true: C.greenSoft, false: C.line }}
                thumbColor={pref.email ? C.green : '#F4F4F4'}
              />
            </View>
          </View>
        ))}

        <Text style={s.note}>
          Push delivery also needs a registered device. The app registers one automatically at launch
          once a push provider is configured on the server.
        </Text>
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity
          style={[s.save, (!dirty || saving) && s.saveDisabled]}
          disabled={!dirty || saving}
          onPress={save}
        >
          {saving ? (
            <ActivityIndicator color='#FFFFFF' />
          ) : (
            <Text style={s.saveText}>{dirty ? 'Save changes' : 'Saved'}</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg, padding: 24 },
  title: { fontSize: 24, fontWeight: '700', color: C.ink, marginHorizontal: 18, marginTop: 16 },
  sub: { color: C.muted, marginHorizontal: 18, marginTop: 6, lineHeight: 20 },
  legend: { flexDirection: 'row', justifyContent: 'flex-end', gap: 18, paddingHorizontal: 22, marginTop: 18 },
  legendCell: { width: 52, textAlign: 'center', fontSize: 11, color: C.muted, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    marginHorizontal: 14,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
  },
  rowLabel: { flex: 1, color: C.ink, fontWeight: '600', paddingRight: 10 },
  switches: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  note: { color: C.muted, fontSize: 12, marginHorizontal: 18, marginTop: 18, lineHeight: 18 },
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
  save: { backgroundColor: C.green, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  saveDisabled: { backgroundColor: '#A9C4B8' },
  saveText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  error: { color: C.red, textAlign: 'center' },
});
