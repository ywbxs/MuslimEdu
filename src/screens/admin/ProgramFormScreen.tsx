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
import { ChevronLeft } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { useAcademicGlassTheme, AcademicGlassTheme } from '../teachers/academicGlassTheme';
import { RADIUS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';
import {
  PickerDepartment,
  fetchDepartmentsForPicker,
  fetchPrograms,
  createProgram,
  updateProgram,
} from '../../services/adminAcademicCatalogService';

/**
 * Create + edit in one screen, same pattern as GradingSystemFormScreen /
 * EnrollmentStageFormScreen. No admin_programs_get - editing re-uses
 * _list and finds the row by id client-side (a school's program list is
 * short, not a paginated table).
 */

function IconChevronLeft({ color }: { color: string }) {
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}

export default function ProgramFormScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const theme = useAcademicGlassTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { token } = useAuth();
  const { t } = useLocale();

  const programId: number | undefined = route.params?.programId;
  const isEditing = !!programId;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [departments, setDepartments] = useState<PickerDepartment[]>([]);

  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [departmentId, setDepartmentId] = useState<number | null>(null);
  const [durationTerms, setDurationTerms] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        setLoading(true);
        const depts = await fetchDepartmentsForPicker(token);
        setDepartments(depts);

        if (isEditing) {
          const programs = await fetchPrograms(token);
          const program = programs.find((p) => p.id === programId);
          if (!program) {
            setError(t('program_form.not_found', 'Section/Class not found.'));
            return;
          }
          setName(program.name);
          setNameAr(program.name_ar ?? '');
          setCode(program.code ?? '');
          setDescription(program.description ?? '');
          setDepartmentId(program.department_id);
          setDurationTerms(program.duration_terms != null ? String(program.duration_terms) : '');
          setIsActive(program.status === 'active');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t('program_form.load_error', 'Failed to load the section/class.'));
      } finally {
        setLoading(false);
      }
    })();
  }, [isEditing, programId, token, t]);

  const canSubmit = name.trim().length > 0 && !submitting;

  const onSave = async () => {
    if (!token) {
      Alert.alert(t('common.error', 'Error'), t('program_form.session_expired', 'Your session expired. Please log in again.'));
      return;
    }
    if (!name.trim()) {
      Alert.alert(t('common.error', 'Error'), t('program_form.name_required', 'Section/Class name is required.'));
      return;
    }

    setSubmitting(true);
    try {
      const input = {
        name: name.trim(),
        name_ar: nameAr.trim() || null,
        code: code.trim() || null,
        description: description.trim() || null,
        department_id: departmentId,
        duration_terms: durationTerms.trim() ? parseInt(durationTerms, 10) : null,
        status: (isActive ? 'active' : 'inactive') as 'active' | 'inactive',
      };
      if (isEditing) {
        await updateProgram(token, programId!, input);
      } else {
        await createProgram(token, input);
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('program_form.save_error', 'Could not save the section/class.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
            <IconChevronLeft color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, styles.headerTitleFlex]}>
            {isEditing ? t('program_form.edit_title', 'Edit Section/Class') : t('program_form.add_title', 'Add Section/Class')}
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
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
          <IconChevronLeft color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, styles.headerTitleFlex]}>
          {isEditing ? 'Edit Section/Class' : 'Add Section/Class'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Text style={styles.label}>{t('program_form.name_label', 'Name')}</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t('program_form.name_placeholder', 'e.g. Hifz')}
          placeholderTextColor={theme.textMuted}
        />

        <Text style={styles.label}>{t('program_form.name_ar_label', 'Arabic Name (optional)')}</Text>
        <TextInput
          style={styles.input}
          value={nameAr}
          onChangeText={setNameAr}
          placeholder="الاسم بالعربية"
          placeholderTextColor={theme.textMuted}
        />

        <Text style={styles.label}>{t('program_form.code_label', 'Code (optional)')}</Text>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          placeholder={t('program_form.code_placeholder', 'e.g. HIFZ')}
          placeholderTextColor={theme.textMuted}
          autoCapitalize="characters"
        />

        <Text style={styles.label}>{t('program_form.department_label', 'Department (optional)')}</Text>
        <View style={styles.typeGrid}>
          <TouchableOpacity
            style={[styles.typeOption, departmentId === null && styles.typeOptionSelected]}
            onPress={() => setDepartmentId(null)}
          >
            <Text style={[styles.typeOptionText, departmentId === null && styles.typeOptionTextSelected]}>
              {t('program_form.none', 'None')}
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

        <Text style={styles.label}>{t('program_form.duration_label', 'Duration (terms, optional)')}</Text>
        <TextInput
          style={styles.input}
          value={durationTerms}
          onChangeText={setDurationTerms}
          placeholder="e.g. 8"
          placeholderTextColor={theme.textMuted}
          keyboardType="number-pad"
        />

        <Text style={styles.label}>{t('program_form.description_label', 'Description (optional)')}</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder={t('program_form.description_placeholder', 'Notes about this section/class')}
          placeholderTextColor={theme.textMuted}
          multiline
          numberOfLines={3}
        />

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>{t('program_form.active', 'Active')}</Text>
            <Text style={styles.switchHelp}>
              {t('program_form.active_help', 'Inactive sections/classes are hidden from new assignments but kept for history.')}
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
            <Text style={styles.saveButtonText}>{isEditing ? t('program_form.save_changes', 'Save Changes') : t('program_form.add_title', 'Add Section/Class')}</Text>
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
