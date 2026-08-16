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
import { fetchAcademicYears, createAcademicYear, updateAcademicYear } from '../../services/academicSetupService';

/**
 * Create + edit in one screen, matching EnrollmentStageFormScreen's pattern.
 * There's no admin_sessions_get either - editing re-uses admin_sessions_list
 * and finds the row client-side (a school's year list is always small).
 *
 * admin_sessions_update only accepts session_title (per
 * AcademicSetupController), so "set as current" is only offered on create -
 * on an existing year that's handled by AcademicYearsScreen's dedicated
 * "Set Current" button, which calls admin_sessions_set_current directly.
 */

function IconChevronLeft({ color }: { color: string }) {
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}

export default function AcademicYearFormScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const theme = useAcademicGlassTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { token } = useAuth();
  const { t } = useLocale();

  const sessionId: number | undefined = route.params?.sessionId;
  const isEditing = !!sessionId;

  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [setCurrent, setSetCurrent] = useState(false);

  useEffect(() => {
    if (!isEditing || !token) return;
    (async () => {
      try {
        setLoading(true);
        const years = await fetchAcademicYears(token);
        const year = years.find((y) => y.id === sessionId);
        if (!year) {
          setError(t('academic_year_form.not_found', 'Academic year not found.'));
          return;
        }
        setTitle(year.session_title);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('academic_year_form.load_error', 'Failed to load academic year.'));
      } finally {
        setLoading(false);
      }
    })();
  }, [isEditing, sessionId, token, t]);

  const canSubmit = title.trim().length > 0 && !submitting;

  const onSave = async () => {
    if (!token) {
      Alert.alert(t('common.error', 'Error'), t('academic_year_form.session_expired', 'Your session expired. Please log in again.'));
      return;
    }
    if (!title.trim()) {
      Alert.alert(t('common.error', 'Error'), t('academic_year_form.title_required', 'Academic year title is required.'));
      return;
    }

    setSubmitting(true);
    try {
      if (isEditing) {
        await updateAcademicYear(token, sessionId!, title.trim());
      } else {
        await createAcademicYear(token, title.trim(), setCurrent);
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('academic_year_form.save_error', 'Could not save the academic year.'));
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
            {isEditing ? t('academic_year_form.edit_title', 'Edit Academic Year') : t('academic_year_form.add_title', 'Add Academic Year')}
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
          {isEditing ? 'Edit Academic Year' : 'Add Academic Year'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Text style={styles.label}>{t('academic_year_form.title_label', 'Academic Year Title')}</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder={t('academic_year_form.title_placeholder', 'e.g. 2026-2027')}
          placeholderTextColor={theme.textMuted}
        />

        {!isEditing ? (
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>{t('academic_year_form.set_current', 'Set as current year')}</Text>
              <Text style={styles.switchHelp}>
                {t('academic_year_form.set_current_help', 'Makes this the active academic year school-wide, replacing whichever year is current now.')}
              </Text>
            </View>
            <Switch value={setCurrent} onValueChange={setSetCurrent} trackColor={{ true: theme.accent }} />
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.saveButton, !canSubmit && styles.saveButtonDisabled]}
          disabled={!canSubmit}
          onPress={onSave}
        >
          {submitting ? (
            <ActivityIndicator color={theme.onAccent} />
          ) : (
            <Text style={styles.saveButtonText}>{isEditing ? t('academic_year_form.save_changes', 'Save Changes') : t('academic_year_form.add_title', 'Add Academic Year')}</Text>
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
