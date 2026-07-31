import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch,
  StyleSheet,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polyline } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { useAcademicGlassTheme, AcademicGlassTheme } from '../teachers/academicGlassTheme';
import { RADIUS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';
import {
  Subject,
  PickerDepartment,
  PickerCurriculum,
  Program,
  fetchDepartmentsForPicker,
  fetchCurriculaForPicker,
  fetchPrograms,
  fetchSubjectsCatalog,
  createSubject,
  updateSubject,
} from '../../services/adminAcademicCatalogService';

/**
 * Create + edit in one screen, same pattern as GradingSystemFormScreen /
 * ProgramFormScreen. No admin_subjects_catalog_get - editing re-uses
 * _list and finds the row by id client-side.
 *
 * Hours/units/passing-score are all optional numeric fields per spec §4.7 -
 * left blank rather than defaulted to 0, since 0 is a meaningful value for
 * some of them (e.g. laboratory_hours) and blank should mean "not set".
 */

function IconChevronLeft({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Polyline points="15 5 8 12 15 19" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Preset palette for the optional subject color (§4.7 "Subject color/icon
// if supported by the existing design system"). Kept to a fixed set rather
// than a free color picker - simplest option that reuses the same chip
// pattern as every other selector on this screen.
const COLOR_PRESETS = [
  '#4F46E5', '#0EA5E9', '#10B981', '#F59E0B',
  '#EF4444', '#EC4899', '#8B5CF6', '#14B8A6',
];

function toNum(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export default function SubjectFormScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const theme = useAcademicGlassTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { token } = useAuth();
  const { t } = useLocale();

  const subjectId: number | undefined = route.params?.subjectId;
  const isEditing = !!subjectId;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [departments, setDepartments] = useState<PickerDepartment[]>([]);
  const [curricula, setCurricula] = useState<PickerCurriculum[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);

  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [shortName, setShortName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [departmentId, setDepartmentId] = useState<number | null>(null);
  const [programId, setProgramId] = useState<number | null>(null);
  const [curriculumId, setCurriculumId] = useState<number | null>(null);
  const [units, setUnits] = useState('');
  const [passingScore, setPassingScore] = useState('');
  const [weeklyHours, setWeeklyHours] = useState('');
  const [contactHours, setContactHours] = useState('');
  const [lectureHours, setLectureHours] = useState('');
  const [laboratoryHours, setLaboratoryHours] = useState('');
  const [practicalHours, setPracticalHours] = useState('');
  const [displayOrder, setDisplayOrder] = useState('');
  const [color, setColor] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [prerequisiteIds, setPrerequisiteIds] = useState<number[]>([]);
  const [corequisiteIds, setCorequisiteIds] = useState<number[]>([]);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        setLoading(true);
        const [depts, currs, progs, subjects] = await Promise.all([
          fetchDepartmentsForPicker(token),
          fetchCurriculaForPicker(token),
          fetchPrograms(token),
          fetchSubjectsCatalog(token),
        ]);
        setDepartments(depts);
        setCurricula(currs);
        setPrograms(progs);
        setAllSubjects(isEditing ? subjects.filter((s) => s.id !== subjectId) : subjects);

        if (isEditing) {
          const subject = subjects.find((s) => s.id === subjectId);
          if (!subject) {
            setError(t('subject_form.not_found', 'Subject not found.'));
            return;
          }
          setName(subject.name);
          setNameAr(subject.name_ar ?? '');
          setShortName(subject.short_name ?? '');
          setCode(subject.code ?? '');
          setDescription(subject.description ?? '');
          setDepartmentId(subject.department_id);
          setProgramId(subject.program_id);
          setCurriculumId(subject.curriculum_id);
          setUnits(subject.units != null ? String(subject.units) : '');
          setPassingScore(subject.passing_score != null ? String(subject.passing_score) : '');
          setWeeklyHours(subject.weekly_hours != null ? String(subject.weekly_hours) : '');
          setContactHours(subject.contact_hours != null ? String(subject.contact_hours) : '');
          setLectureHours(subject.lecture_hours != null ? String(subject.lecture_hours) : '');
          setLaboratoryHours(subject.laboratory_hours != null ? String(subject.laboratory_hours) : '');
          setPracticalHours(subject.practical_hours != null ? String(subject.practical_hours) : '');
          setDisplayOrder(subject.display_order != null ? String(subject.display_order) : '');
          setColor(subject.color ?? null);
          setIsActive(subject.status === 'active');
          setPrerequisiteIds((subject.prerequisites ?? []).map((p) => p.id));
          setCorequisiteIds((subject.corequisites ?? []).map((c) => c.id));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t('subject_form.load_error', 'Failed to load the subject.'));
      } finally {
        setLoading(false);
      }
    })();
  }, [isEditing, subjectId, token]);

  const canSubmit = name.trim().length > 0 && !submitting;

  const togglePrerequisite = (id: number) => {
    setPrerequisiteIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleCorequisite = (id: number) => {
    setCorequisiteIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const onSave = async () => {
    if (!token) {
      Alert.alert(t('common.error', 'Error'), t('subject_form.error_session_expired', 'Your session expired. Please log in again.'));
      return;
    }
    if (!name.trim()) {
      Alert.alert(t('common.error', 'Error'), t('subject_form.error_name_required', 'Subject name is required.'));
      return;
    }

    setSubmitting(true);
    try {
      const input = {
        name: name.trim(),
        name_ar: nameAr.trim() || null,
        short_name: shortName.trim() || null,
        code: code.trim() || null,
        description: description.trim() || null,
        department_id: departmentId,
        program_id: programId,
        curriculum_id: curriculumId,
        units: toNum(units),
        passing_score: toNum(passingScore),
        weekly_hours: toNum(weeklyHours),
        contact_hours: toNum(contactHours),
        lecture_hours: toNum(lectureHours),
        laboratory_hours: toNum(laboratoryHours),
        practical_hours: toNum(practicalHours),
        display_order: displayOrder.trim() ? Math.trunc(Number(displayOrder)) : null,
        color,
        status: (isActive ? 'active' : 'inactive') as 'active' | 'inactive',
        prerequisite_subject_ids: prerequisiteIds,
        corequisite_subject_ids: corequisiteIds,
      };
      if (isEditing) {
        await updateSubject(token, subjectId!, input);
      } else {
        await createSubject(token, input);
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('subject_form.save_error', 'Could not save the subject.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
            <IconChevronLeft color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, styles.headerTitleFlex]}>
            {isEditing ? t('subject_form.edit_title', 'Edit Subject') : t('subject_form.add_title', 'Add Subject')}
          </Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator color={theme.accent} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
          <IconChevronLeft color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, styles.headerTitleFlex]}>
          {isEditing ? 'Edit Subject' : 'Add Subject'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Text style={styles.label}>{t('subject_form.name_label', 'Name')}</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t('subject_form.name_placeholder', 'e.g. Tajweed')}
          placeholderTextColor={theme.textMuted}
        />

        <Text style={styles.label}>{t('subject_form.name_ar_label', 'Arabic Name (optional)')}</Text>
        <TextInput
          style={styles.input}
          value={nameAr}
          onChangeText={setNameAr}
          placeholder={t('subject_form.name_ar_placeholder', 'الاسم بالعربية')}
          placeholderTextColor={theme.textMuted}
        />

        <Text style={styles.label}>{t('subject_form.short_name_code_label', 'Short Name / Code (optional)')}</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.rowInput]}
            value={shortName}
            onChangeText={setShortName}
            placeholder={t('subject_form.short_name_placeholder', 'Short name')}
            placeholderTextColor={theme.textMuted}
          />
          <TextInput
            style={[styles.input, styles.rowInput]}
            value={code}
            onChangeText={setCode}
            placeholder={t('subject_form.code_placeholder', 'Code')}
            placeholderTextColor={theme.textMuted}
            autoCapitalize="characters"
          />
        </View>

        <Text style={styles.label}>{t('subject_form.department_label', 'Department (optional)')}</Text>
        <View style={styles.typeGrid}>
          <TouchableOpacity
            style={[styles.typeOption, departmentId === null && styles.typeOptionSelected]}
            onPress={() => setDepartmentId(null)}
          >
            <Text style={[styles.typeOptionText, departmentId === null && styles.typeOptionTextSelected]}>
              {t('common.none', 'None')}
            </Text>
          </TouchableOpacity>
          {departments.map((d) => {
            const selected = departmentId === d.id;
            return (
              <TouchableOpacity
                key={d.id}
                style={[styles.typeOption, selected && styles.typeOptionSelected]}
                onPress={() => setDepartmentId(d.id)}
              >
                <Text style={[styles.typeOptionText, selected && styles.typeOptionTextSelected]}>{d.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>{t('subject_form.program_label', 'Program (optional)')}</Text>
        <View style={styles.typeGrid}>
          <TouchableOpacity
            style={[styles.typeOption, programId === null && styles.typeOptionSelected]}
            onPress={() => setProgramId(null)}
          >
            <Text style={[styles.typeOptionText, programId === null && styles.typeOptionTextSelected]}>
              {t('common.none', 'None')}
            </Text>
          </TouchableOpacity>
          {programs.map((p) => {
            const selected = programId === p.id;
            return (
              <TouchableOpacity
                key={p.id}
                style={[styles.typeOption, selected && styles.typeOptionSelected]}
                onPress={() => setProgramId(p.id)}
              >
                <Text style={[styles.typeOptionText, selected && styles.typeOptionTextSelected]}>{p.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>{t('subject_form.curriculum_label', 'Curriculum (optional)')}</Text>
        <View style={styles.typeGrid}>
          <TouchableOpacity
            style={[styles.typeOption, curriculumId === null && styles.typeOptionSelected]}
            onPress={() => setCurriculumId(null)}
          >
            <Text style={[styles.typeOptionText, curriculumId === null && styles.typeOptionTextSelected]}>
              {t('common.none', 'None')}
            </Text>
          </TouchableOpacity>
          {curricula.map((c) => {
            const selected = curriculumId === c.id;
            return (
              <TouchableOpacity
                key={c.id}
                style={[styles.typeOption, selected && styles.typeOptionSelected]}
                onPress={() => setCurriculumId(c.id)}
              >
                <Text style={[styles.typeOptionText, selected && styles.typeOptionTextSelected]}>{c.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>{t('subject_form.units_hours_score_label', 'Units / Weekly Hours / Passing Score (all optional)')}</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.rowInputThird]}
            value={units}
            onChangeText={setUnits}
            placeholder={t('subject_form.units_placeholder', 'Units')}
            placeholderTextColor={theme.textMuted}
            keyboardType="decimal-pad"
          />
          <TextInput
            style={[styles.input, styles.rowInputThird]}
            value={weeklyHours}
            onChangeText={setWeeklyHours}
            placeholder={t('subject_form.weekly_hours_placeholder', 'Wkly hrs')}
            placeholderTextColor={theme.textMuted}
            keyboardType="decimal-pad"
          />
          <TextInput
            style={[styles.input, styles.rowInputThird]}
            value={passingScore}
            onChangeText={setPassingScore}
            placeholder={t('subject_form.passing_score_placeholder', 'Passing %')}
            placeholderTextColor={theme.textMuted}
            keyboardType="decimal-pad"
          />
        </View>

        <Text style={styles.label}>{t('subject_form.hours_label', 'Contact / Lecture / Lab / Practical Hours (all optional)')}</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.rowInputThird]}
            value={contactHours}
            onChangeText={setContactHours}
            placeholder={t('subject_form.contact_hours_placeholder', 'Contact')}
            placeholderTextColor={theme.textMuted}
            keyboardType="decimal-pad"
          />
          <TextInput
            style={[styles.input, styles.rowInputThird]}
            value={lectureHours}
            onChangeText={setLectureHours}
            placeholder={t('subject_form.lecture_hours_placeholder', 'Lecture')}
            placeholderTextColor={theme.textMuted}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={[styles.row, { marginTop: 8 }]}>
          <TextInput
            style={[styles.input, styles.rowInputThird]}
            value={laboratoryHours}
            onChangeText={setLaboratoryHours}
            placeholder={t('subject_form.laboratory_hours_placeholder', 'Laboratory')}
            placeholderTextColor={theme.textMuted}
            keyboardType="decimal-pad"
          />
          <TextInput
            style={[styles.input, styles.rowInputThird]}
            value={practicalHours}
            onChangeText={setPracticalHours}
            placeholder={t('subject_form.practical_hours_placeholder', 'Practical')}
            placeholderTextColor={theme.textMuted}
            keyboardType="decimal-pad"
          />
        </View>

        <Text style={styles.label}>{t('subject_form.display_order_label', 'Display Order (optional)')}</Text>
        <TextInput
          style={styles.input}
          value={displayOrder}
          onChangeText={setDisplayOrder}
          placeholder={t('subject_form.display_order_placeholder', 'e.g. 1 - lower shows first')}
          placeholderTextColor={theme.textMuted}
          keyboardType="number-pad"
        />

        <Text style={styles.label}>{t('subject_form.color_label', 'Color (optional)')}</Text>
        <View style={styles.typeGrid}>
          <TouchableOpacity
            style={[styles.typeOption, color === null && styles.typeOptionSelected]}
            onPress={() => setColor(null)}
          >
            <Text style={[styles.typeOptionText, color === null && styles.typeOptionTextSelected]}>{t('common.none', 'None')}</Text>
          </TouchableOpacity>
          {COLOR_PRESETS.map((c) => {
            const selected = color === c;
            return (
              <TouchableOpacity
                key={c}
                style={[
                  styles.colorSwatch,
                  { backgroundColor: c },
                  selected && styles.colorSwatchSelected,
                ]}
                onPress={() => setColor(c)}
              />
            );
          })}
        </View>

        {allSubjects.length > 0 ? (
          <>
            <Text style={styles.label}>{t('subject_form.prerequisites_label', 'Prerequisites (optional)')}</Text>
            <View style={styles.typeGrid}>
              {allSubjects.map((s) => {
                const selected = prerequisiteIds.includes(s.id);
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.typeOption, selected && styles.typeOptionSelected]}
                    onPress={() => togglePrerequisite(s.id)}
                  >
                    <Text style={[styles.typeOptionText, selected && styles.typeOptionTextSelected]}>
                      {s.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>{t('subject_form.corequisites_label', 'Corequisites (optional)')}</Text>
            <Text style={styles.switchHelp}>{t('subject_form.corequisites_help', 'Subjects that must be taken alongside this one.')}</Text>
            <View style={[styles.typeGrid, { marginTop: 8 }]}>
              {allSubjects.map((s) => {
                const selected = corequisiteIds.includes(s.id);
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.typeOption, selected && styles.typeOptionSelected]}
                    onPress={() => toggleCorequisite(s.id)}
                  >
                    <Text style={[styles.typeOptionText, selected && styles.typeOptionTextSelected]}>
                      {s.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        ) : null}

        <Text style={styles.label}>{t('subject_form.description_label', 'Description (optional)')}</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder={t('subject_form.description_placeholder', 'Notes about this subject')}
          placeholderTextColor={theme.textMuted}
          multiline
          numberOfLines={3}
        />

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>{t('common.active', 'Active')}</Text>
            <Text style={styles.switchHelp}>
              {t('subject_form.active_help', 'Inactive subjects are hidden from new assignments but kept for history.')}
            </Text>
          </View>
          <Switch value={isActive} onValueChange={setIsActive} trackColor={{ true: theme.accent }} />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, !canSubmit && styles.saveButtonDisabled]}
          disabled={!canSubmit}
          onPress={onSave}
        >
          {submitting ? (
            <ActivityIndicator color={theme.onAccent} />
          ) : (
            <Text style={styles.saveButtonText}>{isEditing ? t('common.save_changes', 'Save Changes') : t('subject_form.add_title', 'Add Subject')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const makeStyles = (theme: AcademicGlassTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerTitle: { fontSize: 20, fontWeight: '700', color: theme.textPrimary },
    headerTitleFlex: { flex: 1, marginLeft: 8 },
    backButton: { width: 32 },
    headerSpacer: { width: 32 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    content: { padding: 20 },
    errorText: { color: theme.danger, fontSize: 13.5, marginBottom: 16, textAlign: 'center' },
    label: { fontSize: 12.5, fontWeight: '600', color: theme.textSecondary, marginBottom: 6, marginTop: 16 },
    input: {
      height: 48,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: RADIUS.sm,
      paddingHorizontal: 16,
      fontSize: 15,
      backgroundColor: theme.surface,
      color: theme.textPrimary,
    },
    textArea: { height: 84, paddingTop: 12, textAlignVertical: 'top' },

    row: { flexDirection: 'row', gap: 8 },
    rowInput: { flex: 1 },
    rowInputThird: { flex: 1 },

    typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    typeOption: {
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: RADIUS.sm,
    },
    typeOptionSelected: { backgroundColor: theme.accentSoft, borderColor: theme.accent },
    typeOptionText: { fontSize: 12.5, fontWeight: '600', color: theme.textSecondary },
    typeOptionTextSelected: { color: theme.accentSoftText },

    colorSwatch: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    colorSwatchSelected: { borderColor: theme.textPrimary },

    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 22,
      paddingVertical: 4,
    },
    switchLabel: { fontSize: 14.5, fontWeight: '600', color: theme.textPrimary, marginBottom: 3 },
    switchHelp: { fontSize: 12, color: theme.textSecondary, lineHeight: 16 },

    saveButton: {
      backgroundColor: theme.accent,
      borderRadius: RADIUS.sm,
      height: 50,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 32,
    },
    saveButtonDisabled: { opacity: 0.5 },
    saveButtonText: { color: theme.onAccent, fontSize: 15.5, fontWeight: '700' },
  });
