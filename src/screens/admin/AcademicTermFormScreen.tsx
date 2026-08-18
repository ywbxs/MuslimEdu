import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, Switch, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { useAcademicGlassTheme, AcademicGlassTheme } from '../teachers/academicGlassTheme';
import { RADIUS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';
import {
  AcademicYearStructure,
  fetchAcademicTerms,
  createAcademicTerm,
  updateAcademicTerm,
} from '../../services/academicSetupService';

/**
 * Create + edit in one screen, same pattern as EnrollmentStageFormScreen /
 * AcademicYearFormScreen - no admin_academic_terms_get either, editing
 * re-uses the _list endpoint (scoped to this term's session) and finds the
 * row client-side.
 *
 * Dates are plain "YYYY-MM-DD" text fields: no date-picker library is
 * present in package.json (same constraint the enrollment stage-builder
 * hit with drag-and-drop - solved there with up/down arrows instead of
 * blocking on a new dependency). The backend validates with Laravel's
 * `date` rule, which accepts this format directly.
 *
 * Per AcademicSetupController's own comment: once a term has classes
 * attached, in-place edits to its date windows are a known gap ("should go
 * through a new revision instead of an in-place update - not implemented
 * yet"). Not fixed here - out of scope for this screen - but the save
 * button surfaces whatever error the backend eventually returns for that
 * case verbatim, same as every other screen in this module.
 */

const TERM_TYPES: AcademicYearStructure[] = ['semester', 'trimester', 'quarter', 'continuous', 'custom'];

function IconChevronLeft({ color }: { color: string }) {
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}

function DateField({
  label,
  value,
  onChangeText,
  theme,
  styles,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  theme: AcademicGlassTheme;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.dateField}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={theme.textMuted}
        autoCapitalize="none"
      />
    </View>
  );
}

export default function AcademicTermFormScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const theme = useAcademicGlassTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { token } = useAuth();
  const { t } = useLocale();

  const sessionId: number = route.params?.sessionId;
  const termId: number | undefined = route.params?.termId;
  const isEditing = !!termId;

  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [termType, setTermType] = useState<AcademicYearStructure>('semester');
  const [order, setOrder] = useState('0');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [enrollmentStart, setEnrollmentStart] = useState('');
  const [enrollmentEnd, setEnrollmentEnd] = useState('');
  const [gradingStart, setGradingStart] = useState('');
  const [gradingEnd, setGradingEnd] = useState('');
  const [examStart, setExamStart] = useState('');
  const [examEnd, setExamEnd] = useState('');
  const [closureDate, setClosureDate] = useState('');
  const [setCurrent, setSetCurrent] = useState(false);

  useEffect(() => {
    if (!isEditing || !token || !sessionId) return;
    (async () => {
      try {
        setLoading(true);
        const terms = await fetchAcademicTerms(token, sessionId);
        const term = terms.find((x) => x.id === termId);
        if (!term) {
          setError(t('academic_term_form.not_found', 'Term not found.'));
          return;
        }
        setName(term.name);
        setTermType(term.term_type);
        setOrder(String(term.order ?? 0));
        setStartDate(term.start_date ?? '');
        setEndDate(term.end_date ?? '');
        setEnrollmentStart(term.enrollment_start ?? '');
        setEnrollmentEnd(term.enrollment_end ?? '');
        setGradingStart(term.grading_start ?? '');
        setGradingEnd(term.grading_end ?? '');
        setExamStart(term.exam_start ?? '');
        setExamEnd(term.exam_end ?? '');
        setClosureDate(term.closure_date ?? '');
      } catch (err) {
        setError(err instanceof Error ? err.message : t('academic_term_form.load_error', 'Failed to load term.'));
      } finally {
        setLoading(false);
      }
    })();
  }, [isEditing, sessionId, termId, token, t]);

  const canSubmit = name.trim().length > 0 && !submitting;

  const onSave = async () => {
    if (!token) {
      Alert.alert(t('common.error', 'Error'), t('academic_term_form.session_expired', 'Your session expired. Please log in again.'));
      return;
    }
    if (!name.trim()) {
      Alert.alert(t('common.error', 'Error'), t('academic_term_form.name_required', 'Term name is required.'));
      return;
    }

    const input = {
      session_id: sessionId,
      name: name.trim(),
      term_type: termType,
      order: parseInt(order, 10) || 0,
      start_date: startDate.trim() || undefined,
      end_date: endDate.trim() || undefined,
      enrollment_start: enrollmentStart.trim() || undefined,
      enrollment_end: enrollmentEnd.trim() || undefined,
      grading_start: gradingStart.trim() || undefined,
      grading_end: gradingEnd.trim() || undefined,
      exam_start: examStart.trim() || undefined,
      exam_end: examEnd.trim() || undefined,
      closure_date: closureDate.trim() || undefined,
      set_current: setCurrent,
    };

    setSubmitting(true);
    try {
      if (isEditing) {
        await updateAcademicTerm(token, termId!, input);
      } else {
        await createAcademicTerm(token, input);
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('academic_term_form.save_error', 'Could not save the term.'));
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
          <Text style={[styles.headerTitle, styles.headerTitleFlex]}>{isEditing ? t('academic_term_form.edit_title', 'Edit Term') : t('academic_term_form.add_title', 'Add Term')}</Text>
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
        <Text style={[styles.headerTitle, styles.headerTitleFlex]}>{isEditing ? 'Edit Term' : 'Add Term'}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Text style={styles.label}>{t('academic_term_form.name_label', 'Term Name')}</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t('academic_term_form.name_placeholder', 'e.g. Fall Semester')}
          placeholderTextColor={theme.textMuted}
        />

        <Text style={styles.label}>{t('academic_term_form.type_label', 'Term Type')}</Text>
        <View style={styles.typeRow}>
          {TERM_TYPES.map((termTypeOption) => (
            <TouchableOpacity
              key={termTypeOption}
              style={[styles.typeChip, termType === termTypeOption && styles.typeChipSelected]}
              onPress={() => setTermType(termTypeOption)}
            >
              <Text style={[styles.typeChipText, termType === termTypeOption && styles.typeChipTextSelected]}>{t(`academic_term_form.type_${termTypeOption}`, termTypeOption)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>{t('academic_term_form.order_label', 'Order')}</Text>
        <TextInput
          style={styles.input}
          value={order}
          onChangeText={setOrder}
          placeholder="0"
          placeholderTextColor={theme.textMuted}
          keyboardType="number-pad"
        />

        <Text style={styles.sectionLabel}>{t('academic_term_form.term_dates', 'Term dates')}</Text>
        <View style={styles.dateRow}>
          <DateField label={t('academic_term_form.start', 'Start')} value={startDate} onChangeText={setStartDate} theme={theme} styles={styles} />
          <DateField label={t('academic_term_form.end', 'End')} value={endDate} onChangeText={setEndDate} theme={theme} styles={styles} />
        </View>

        <Text style={styles.sectionLabel}>{t('academic_term_form.enrollment_window', 'Enrollment window')}</Text>
        <View style={styles.dateRow}>
          <DateField label={t('academic_term_form.start', 'Start')} value={enrollmentStart} onChangeText={setEnrollmentStart} theme={theme} styles={styles} />
          <DateField label={t('academic_term_form.end', 'End')} value={enrollmentEnd} onChangeText={setEnrollmentEnd} theme={theme} styles={styles} />
        </View>

        <Text style={styles.sectionLabel}>{t('academic_term_form.grading_window', 'Grading window')}</Text>
        <View style={styles.dateRow}>
          <DateField label={t('academic_term_form.start', 'Start')} value={gradingStart} onChangeText={setGradingStart} theme={theme} styles={styles} />
          <DateField label={t('academic_term_form.end', 'End')} value={gradingEnd} onChangeText={setGradingEnd} theme={theme} styles={styles} />
        </View>

        <Text style={styles.sectionLabel}>{t('academic_term_form.exam_window', 'Exam window')}</Text>
        <View style={styles.dateRow}>
          <DateField label={t('academic_term_form.start', 'Start')} value={examStart} onChangeText={setExamStart} theme={theme} styles={styles} />
          <DateField label={t('academic_term_form.end', 'End')} value={examEnd} onChangeText={setExamEnd} theme={theme} styles={styles} />
        </View>

        <Text style={styles.label}>{t('academic_term_form.closure_date_label', 'Closure date (optional)')}</Text>
        <TextInput
          style={styles.input}
          value={closureDate}
          onChangeText={setClosureDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={theme.textMuted}
          autoCapitalize="none"
        />

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>{t('academic_term_form.set_current', 'Set as current term')}</Text>
            <Text style={styles.switchHelp}>
              {t('academic_term_form.set_current_help', 'Makes this the active term within its academic year, replacing whichever term is current now.')}
            </Text>
          </View>
          <Switch value={setCurrent} onValueChange={setSetCurrent} trackColor={{ true: theme.accent }} />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, !canSubmit && styles.saveButtonDisabled]}
          disabled={!canSubmit}
          onPress={onSave}
        >
          {submitting ? (
            <ActivityIndicator color={theme.onAccent} />
          ) : (
            <Text style={styles.saveButtonText}>{isEditing ? t('academic_term_form.save_changes', 'Save Changes') : t('academic_term_form.add_title', 'Add Term')}</Text>
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

    content: { padding: 20, paddingBottom: 40 },
    errorText: { color: theme.danger, fontSize: 13.5, marginBottom: 16, textAlign: 'center' },
    label: { fontSize: 12.5, fontWeight: '600', color: theme.textSecondary, marginBottom: 6, marginTop: 16 },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.textPrimary,
      marginTop: 24,
      marginBottom: 4,
    },
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

    typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    typeChip: {
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: RADIUS.sm,
      backgroundColor: theme.surface,
    },
    typeChipSelected: { borderColor: theme.accent, backgroundColor: theme.accentSoft },
    typeChipText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary, textTransform: 'capitalize' },
    typeChipTextSelected: { color: theme.accentSoftText },

    dateRow: { flexDirection: 'row', gap: 12 },
    dateField: { flex: 1 },

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
