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
import { useLocale } from '../../context/LocaleContext';

const EXAM_TYPES = ['written', 'oral', 'practical', 'memorisation', 'project', 'quiz'];

type Props = { navigation: any; route: { params?: { examination?: Examination } } };

export default function TeacherExaminationFormScreen({ navigation, route }: Props) {
  const { t } = useLocale();
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
      Alert.alert(t('teacher_examination_form.title_required', 'Title required'), t('teacher_examination_form.title_required_message', 'Give the examination a name students will recognise.'));
      return;
    }
    if (!sectionId.trim()) {
      Alert.alert(t('teacher_examination_form.section_required', 'Section required'), t('teacher_examination_form.section_required_message', 'Pick the section this examination belongs to.'));
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
      Alert.alert(t('teacher_examination_form.save_error', 'Could not save'), e?.message ?? t('common.try_again_full', 'Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps='handled'>
          <Text style={s.title}>{editing ? t('teacher_examination_form.edit_title', 'Edit examination') : t('teacher_examination_form.new_title', 'New examination')}</Text>
          <Text style={s.sub}>{t('teacher_examination_form.draft_note', 'Saved as a draft. Students see nothing until you publish it.')}</Text>

          <Field label={t('teacher_examination_form.title_label', 'Title')} value={title} onChange={setTitle} placeholder={t('teacher_examination_form.title_placeholder', 'Mid-term Tajweed assessment')} />
          <Field label={t('teacher_examination_form.title_ar_label', 'Title (Arabic)')} value={titleAr} onChange={setTitleAr} placeholder={t('teacher_examination_form.optional', 'optional')} />

          <Text style={s.label}>{t('teacher_examination_form.type_label', 'Type')}</Text>
          <View style={s.chipRow}>
            {EXAM_TYPES.map(examTypeOption => (
              <TouchableOpacity
                key={examTypeOption}
                style={[s.chip, examType === examTypeOption && s.chipActive]}
                onPress={() => setExamType(examTypeOption)}
              >
                <Text style={[s.chipText, examType === examTypeOption && s.chipTextActive]}>{t(`teacher_examination_form.exam_type_${examTypeOption}`, examTypeOption)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {sections.length > 0 ? (
            <>
              <Text style={s.label}>{t('teacher_examination_form.section_label', 'Section')}</Text>
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
            <Field label={t('teacher_examination_form.section_id', 'Section id')} value={sectionId} onChange={setSectionId} keyboard='number-pad' half />
            <Field label={t('teacher_examination_form.subject_id', 'Subject id')} value={subjectId} onChange={setSubjectId} keyboard='number-pad' half />
          </View>

          <Field label={t('teacher_examination_form.date_label', 'Date (YYYY-MM-DD)')} value={scheduledDate} onChange={setScheduledDate} placeholder='2026-08-14' />

          <View style={s.row}>
            <Field label={t('teacher_examination_form.start_label', 'Start (HH:MM)')} value={startTime} onChange={setStartTime} placeholder='09:00' half />
            <Field label={t('teacher_examination_form.end_label', 'End (HH:MM)')} value={endTime} onChange={setEndTime} placeholder='10:30' half />
          </View>

          <View style={s.row}>
            <Field label={t('teacher_examination_form.duration_label', 'Duration (min)')} value={duration} onChange={setDuration} keyboard='number-pad' half />
            <Field label={t('teacher_examination_form.room_label', 'Room')} value={room} onChange={setRoom} half />
          </View>

          <View style={s.row}>
            <Field label={t('teacher_examination_form.total_marks_label', 'Total marks')} value={totalMarks} onChange={setTotalMarks} keyboard='decimal-pad' half />
            <Field label={t('teacher_examination_form.pass_mark_label', 'Pass mark')} value={passingMarks} onChange={setPassingMarks} keyboard='decimal-pad' half />
          </View>

          <Field
            label={t('teacher_examination_form.weight_label', 'Weight (%)')}
            value={weight}
            onChange={setWeight}
            keyboard='decimal-pad'
            hint={t('teacher_examination_form.weight_hint', 'Weight toward the final grade, if your grading system uses weighted components.')}
          />

          <Field label={t('teacher_examination_form.description_label', 'Description')} value={description} onChange={setDescription} multiline />
          <Field label={t('teacher_examination_form.instructions_label', 'Instructions for students')} value={instructions} onChange={setInstructions} multiline />
        </ScrollView>

        <View style={s.footer}>
          <TouchableOpacity style={[s.save, saving && s.saveDisabled]} onPress={submit} disabled={saving}>
            {saving ? (
              <ActivityIndicator color='#FFFFFF' />
            ) : (
              <Text style={s.saveText}>{editing ? t('teacher_examination_form.save_changes', 'Save changes') : t('teacher_examination_form.create_draft', 'Create draft')}</Text>
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
