import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import examService, { Examination } from '../../services/teacherExaminationService';
import teacherClassService from '../../services/teacherClassService';
import { C } from '../nextPhaseTheme';

const EXAM_TYPES = ['written', 'oral', 'practical', 'memorisation', 'project', 'quiz'];

type Props = { navigation: any; route: { params?: { examination?: Examination } } };

export default function TeacherExaminationFormScreen({ navigation, route }: Props) {
  const existing = route.params?.examination;
  const editing = Boolean(existing);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [titleAr, setTitleAr] = useState(existing?.title_ar ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [examType, setExamType] = useState(existing?.exam_type ?? 'written');
  const [sectionId, setSectionId] = useState(existing?.section_id ? String(existing.section_id) : '');
  const [subjectId, setSubjectId] = useState(existing?.subject_id ? String(existing.subject_id) : '');
  const [scheduledDate, setScheduledDate] = useState(existing?.scheduled_date ?? '');
  const [startTime, setStartTime] = useState(existing?.start_time ?? '');
  const [endTime, setEndTime] = useState(existing?.end_time ?? '');
  const [duration, setDuration] = useState(existing?.duration_minutes ? String(existing.duration_minutes) : '');
  const [room, setRoom] = useState(existing?.room ?? '');
  const [totalMarks, setTotalMarks] = useState(String(existing?.total_marks ?? 100));
  const [passingMarks, setPassingMarks] = useState(existing?.passing_marks ? String(existing.passing_marks) : '');
  const [weight, setWeight] = useState(existing?.weight ? String(existing.weight) : '');
  const [instructions, setInstructions] = useState(existing?.instructions ?? '');
  const [saving, setSaving] = useState(false);
  const [sections, setSections] = useState<Array<{ id: number; label: string }>>([]);

  // Section picker is best-effort. If teacher_my_classes is shaped differently
  // in your build, the numeric field below still works, so the form never
  // becomes unusable because a helper endpoint changed.
  useEffect(() => {
    const fetcher = (teacherClassService as any)?.myClasses ?? (teacherClassService as any)?.default?.myClasses;

    if (typeof fetcher !== 'function') return;

    Promise.resolve(fetcher())
      .then((res: any) => {
        const rows = res?.classes ?? res?.sections ?? res?.data ?? [];
        setSections(
          (Array.isArray(rows) ? rows : []).map((r: any) => ({
            id: Number(r.section_id ?? r.id),
            label: String(r.section_name ?? r.name ?? r.title ?? 'Section ' + (r.section_id ?? r.id)),
          })),
        );
      })
      .catch(() => undefined);
    return undefined;
  }, []);

  const submit = async () => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Give the examination a name students will recognise.');
      return;
    }
    if (!sectionId.trim()) {
      Alert.alert('Section required', 'Pick the section this examination belongs to.');
      return;
    }

    const body: Record<string, unknown> = {
      title: title.trim(),
      title_ar: titleAr.trim() || undefined,
      description: description.trim() || undefined,
      exam_type: examType,
      section_id: Number(sectionId),
      subject_id: subjectId ? Number(subjectId) : undefined,
      scheduled_date: scheduledDate.trim() || undefined,
      start_time: startTime.trim() || undefined,
      end_time: endTime.trim() || undefined,
      duration_minutes: duration ? Number(duration) : undefined,
      room: room.trim() || undefined,
      total_marks: totalMarks ? Number(totalMarks) : 100,
      passing_marks: passingMarks ? Number(passingMarks) : undefined,
      weight: weight ? Number(weight) : undefined,
      instructions: instructions.trim() || undefined,
    };

    setSaving(true);
    try {
      if (editing && existing) {
        await examService.update(existing.id, body);
      } else {
        await examService.create(body);
      }
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps='handled'>
          <Text style={s.title}>{editing ? 'Edit examination' : 'New examination'}</Text>
          <Text style={s.sub}>Saved as a draft. Students see nothing until you publish it.</Text>

          <Field label='Title' value={title} onChange={setTitle} placeholder='Mid-term Tajweed assessment' />
          <Field label='Title (Arabic)' value={titleAr} onChange={setTitleAr} placeholder='optional' />

          <Text style={s.label}>Type</Text>
          <View style={s.chipRow}>
            {EXAM_TYPES.map(t => (
              <TouchableOpacity
                key={t}
                style={[s.chip, examType === t && s.chipActive]}
                onPress={() => setExamType(t)}
              >
                <Text style={[s.chipText, examType === t && s.chipTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {sections.length > 0 ? (
            <>
              <Text style={s.label}>Section</Text>
              <View style={s.chipRow}>
                {sections.map(sec => (
                  <TouchableOpacity
                    key={sec.id}
                    style={[s.chip, sectionId === String(sec.id) && s.chipActive]}
                    onPress={() => setSectionId(String(sec.id))}
                  >
                    <Text style={[s.chipText, sectionId === String(sec.id) && s.chipTextActive]}>{sec.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : null}

          <View style={s.row}>
            <Field label='Section id' value={sectionId} onChange={setSectionId} keyboard='number-pad' half />
            <Field label='Subject id' value={subjectId} onChange={setSubjectId} keyboard='number-pad' half />
          </View>

          <Field label='Date (YYYY-MM-DD)' value={scheduledDate} onChange={setScheduledDate} placeholder='2026-08-14' />

          <View style={s.row}>
            <Field label='Start (HH:MM)' value={startTime} onChange={setStartTime} placeholder='09:00' half />
            <Field label='End (HH:MM)' value={endTime} onChange={setEndTime} placeholder='10:30' half />
          </View>

          <View style={s.row}>
            <Field label='Duration (min)' value={duration} onChange={setDuration} keyboard='number-pad' half />
            <Field label='Room' value={room} onChange={setRoom} half />
          </View>

          <View style={s.row}>
            <Field label='Total marks' value={totalMarks} onChange={setTotalMarks} keyboard='decimal-pad' half />
            <Field label='Pass mark' value={passingMarks} onChange={setPassingMarks} keyboard='decimal-pad' half />
          </View>

          <Field
            label='Weight (%)'
            value={weight}
            onChange={setWeight}
            keyboard='decimal-pad'
            hint='Weight toward the final grade, if your grading system uses weighted components.'
          />

          <Field label='Description' value={description} onChange={setDescription} multiline />
          <Field label='Instructions for students' value={instructions} onChange={setInstructions} multiline />
        </ScrollView>

        <View style={s.footer}>
          <TouchableOpacity style={[s.save, saving && s.saveDisabled]} onPress={submit} disabled={saving}>
            {saving ? (
              <ActivityIndicator color='#FFFFFF' />
            ) : (
              <Text style={s.saveText}>{editing ? 'Save changes' : 'Create draft'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboard,
  multiline,
  half,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboard?: any;
  multiline?: boolean;
  half?: boolean;
  hint?: string;
}) {
  return (
    <View style={[s.field, half && { flex: 1 }]}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        style={[s.input, multiline && s.inputMultiline]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor='#9AA8A3'
        keyboardType={keyboard}
        multiline={multiline}
      />
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  title: { fontSize: 24, fontWeight: '700', color: C.ink, marginHorizontal: 18, marginTop: 16 },
  sub: { color: C.muted, marginHorizontal: 18, marginTop: 5, marginBottom: 6 },
  field: { marginHorizontal: 14, marginTop: 12 },
  row: { flexDirection: 'row', gap: 10, marginHorizontal: 0 },
  label: { fontSize: 12, fontWeight: '700', color: C.muted, marginHorizontal: 4, marginBottom: 6, marginTop: 8 },
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
  inputMultiline: { minHeight: 92, textAlignVertical: 'top' },
  hint: { fontSize: 11.5, color: C.muted, marginTop: 5, marginHorizontal: 4, lineHeight: 16 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginHorizontal: 14 },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.card,
  },
  chipActive: { backgroundColor: C.greenSoft, borderColor: C.green },
  chipText: { color: C.muted, fontSize: 13, textTransform: 'capitalize' },
  chipTextActive: { color: C.green, fontWeight: '700' },
  footer: { padding: 14, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.line },
  save: { backgroundColor: C.green, borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  saveDisabled: { backgroundColor: '#A9C4B8' },
  saveText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
