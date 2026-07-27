import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import examService, { ExamRosterRow, Examination } from '../../services/teacherExaminationService';
import { C } from '../nextPhaseTheme';

type Props = { navigation: any; route: { params: { examinationId: number } } };

export default function TeacherExaminationGradingScreen({ navigation, route }: Props) {
  const { examinationId } = route.params;

  const [exam, setExam] = useState<Examination | null>(null);
  const [rows, setRows] = useState<ExamRosterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await examService.results(examinationId);
      setExam(res.examination);
      setRows(res.roster);
      setDirty(false);
    } catch (e: any) {
      setError(e?.message ?? 'Could not load the roster.');
    } finally {
      setLoading(false);
    }
  }, [examinationId]);

  useEffect(() => {
    load();
  }, [load]);

  const setMark = (studentId: number, raw: string) => {
    const cleaned = raw.replace(/[^0-9.]/g, '');
    setRows(prev =>
      prev.map(r =>
        r.student_id === studentId
          ? { ...r, marks_obtained: cleaned === '' ? null : Number(cleaned), is_absent: false }
          : r,
      ),
    );
    setDirty(true);
  };

  const setAbsent = (studentId: number, value: boolean) => {
    setRows(prev =>
      prev.map(r => (r.student_id === studentId ? { ...r, is_absent: value, marks_obtained: value ? null : r.marks_obtained } : r)),
    );
    setDirty(true);
  };

  const save = async (release: boolean) => {
    const total = exam?.total_marks ?? 100;
    const over = rows.find(r => r.marks_obtained !== null && r.marks_obtained > total);

    if (over) {
      Alert.alert('Mark too high', over.name + ' has ' + over.marks_obtained + ' out of ' + total + '.');
      return;
    }

    setSaving(true);
    try {
      await examService.grade(
        examinationId,
        rows.map(r => ({
          student_id: r.student_id,
          marks_obtained: r.marks_obtained,
          is_absent: r.is_absent,
          remarks: r.remarks ?? undefined,
        })),
        release,
      );
      setDirty(false);
      Alert.alert(
        release ? 'Released' : 'Saved',
        release ? 'Students can now see their results.' : 'Marks saved. Students cannot see them yet.',
      );
      load();
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const confirmRelease = () => {
    const missing = rows.filter(r => r.marks_obtained === null && !r.is_absent).length;

    Alert.alert(
      'Release results',
      missing > 0
        ? missing + ' student(s) have no mark yet. Release anyway?'
        : 'Every student will be notified that results are available.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Release', onPress: () => save(true) },
      ],
    );
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
        <TouchableOpacity style={s.retry} onPress={load}>
          <Text style={s.retryText}>Try again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const graded = rows.filter(r => r.marks_obtained !== null || r.is_absent).length;

  return (
    <SafeAreaView style={s.screen}>
      <FlatList
        data={rows}
        keyExtractor={r => String(r.student_id)}
        contentContainerStyle={{ paddingBottom: 130 }}
        ListHeaderComponent={
          <View>
            <Text style={s.title}>{exam?.title ?? 'Marks'}</Text>
            <Text style={s.sub}>
              {graded} of {rows.length} entered · out of {exam?.total_marks ?? 100}
              {exam?.scheduled_date ? ' · ' + exam.scheduled_date : ''}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyTitle}>No students in this section</Text>
            <Text style={s.emptyBody}>Add students to the section before entering marks.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{item.name}</Text>
              {item.student_number ? <Text style={s.meta}>{item.student_number}</Text> : null}
              <View style={s.absentRow}>
                <Switch
                  value={item.is_absent}
                  onValueChange={v => setAbsent(item.student_id, v)}
                  trackColor={{ true: '#FDECEA', false: C.line }}
                  thumbColor={item.is_absent ? C.red : '#F4F4F4'}
                />
                <Text style={s.absentLabel}>Absent</Text>
                {item.released ? <Text style={s.released}>released</Text> : null}
              </View>
            </View>

            <TextInput
              style={[s.markInput, item.is_absent && s.markDisabled]}
              value={item.marks_obtained === null ? '' : String(item.marks_obtained)}
              onChangeText={v => setMark(item.student_id, v)}
              keyboardType='decimal-pad'
              editable={!item.is_absent}
              placeholder='--'
              placeholderTextColor='#9AA8A3'
              maxLength={6}
            />
          </View>
        )}
      />

      <View style={s.footer}>
        <TouchableOpacity
          style={[s.secondary, (!dirty || saving) && s.disabled]}
          disabled={!dirty || saving}
          onPress={() => save(false)}
        >
          <Text style={s.secondaryText}>Save draft</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.primary, saving && s.disabled]} disabled={saving} onPress={confirmRelease}>
          {saving ? <ActivityIndicator color='#FFFFFF' /> : <Text style={s.primaryText}>Save and release</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg, padding: 24 },
  title: { fontSize: 23, fontWeight: '700', color: C.ink, marginHorizontal: 18, marginTop: 16 },
  sub: { color: C.muted, marginHorizontal: 18, marginTop: 5, marginBottom: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.card,
    marginHorizontal: 14,
    marginBottom: 8,
    padding: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
  },
  name: { color: C.ink, fontWeight: '700', fontSize: 15 },
  meta: { color: C.muted, fontSize: 12, marginTop: 2 },
  absentRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  absentLabel: { color: C.muted, fontSize: 12.5 },
  released: { color: C.green, fontSize: 11, fontWeight: '700', marginLeft: 4 },
  markInput: {
    width: 74,
    textAlign: 'center',
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 10,
    paddingVertical: 11,
    fontSize: 16,
    fontWeight: '700',
    color: C.ink,
  },
  markDisabled: { backgroundColor: '#F1F1F1', color: '#B3BDB9' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    backgroundColor: C.card,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  primary: { flex: 1, backgroundColor: C.green, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: '#FFFFFF', fontWeight: '700' },
  secondary: {
    flex: 1,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryText: { color: C.ink, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  empty: { alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: C.ink },
  emptyBody: { color: C.muted, marginTop: 6, textAlign: 'center' },
  error: { color: C.red, textAlign: 'center' },
  retry: { marginTop: 16, backgroundColor: C.green, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  retryText: { color: '#FFFFFF', fontWeight: '700' },
});
