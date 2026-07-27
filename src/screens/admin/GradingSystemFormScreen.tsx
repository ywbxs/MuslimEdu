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
import { useAcademicGlassTheme, AcademicGlassTheme } from '../teachers/academicGlassTheme';
import { RADIUS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';
import {
  GRADING_SYSTEM_TYPES,
  GradingSystemType,
  fetchGradingSystems,
  createGradingSystem,
  updateGradingSystem,
} from '../../services/adminAcademicCatalogService';

/**
 * Create + edit in one screen, matching EnrollmentStageFormScreen's pattern.
 * There's no admin_grading_systems_get - editing re-uses the _list endpoint
 * and finds the row by id client-side, same reasoning as that screen (a
 * school's grading systems is a short list, not a paginated table).
 */

function IconChevronLeft({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Polyline points="15 5 8 12 15 19" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const TYPE_LABELS: Record<GradingSystemType, string> = {
  percentage: 'Percentage',
  letter: 'Letter Grade',
  gpa: 'GPA',
  competency: 'Competency',
  pass_fail: 'Pass / Fail',
  memorization: 'Memorization',
  behavior: 'Behavior',
  attendance: 'Attendance',
  oral: 'Oral',
  written: 'Written',
  practical: 'Practical',
  islamic_studies: 'Islamic Studies',
  arabic: 'Arabic',
  custom: 'Custom',
};

export default function GradingSystemFormScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const theme = useAcademicGlassTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { token } = useAuth();

  const gradingSystemId: number | undefined = route.params?.gradingSystemId;
  const isEditing = !!gradingSystemId;

  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [type, setType] = useState<GradingSystemType>('percentage');
  const [description, setDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!isEditing || !token) return;
    (async () => {
      try {
        setLoading(true);
        const systems = await fetchGradingSystems(token);
        const system = systems.find((s) => s.id === gradingSystemId);
        if (!system) {
          setError('Grading system not found.');
          return;
        }
        setName(system.name);
        setType(system.type);
        setDescription(system.description ?? '');
        setIsDefault(system.is_default);
        setIsActive(system.status === 'active');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load grading system.');
      } finally {
        setLoading(false);
      }
    })();
  }, [isEditing, gradingSystemId, token]);

  const canSubmit = name.trim().length > 0 && !submitting;

  const onSave = async () => {
    if (!token) {
      Alert.alert('Error', 'Your session expired. Please log in again.');
      return;
    }
    if (!name.trim()) {
      Alert.alert('Error', 'Grading system name is required.');
      return;
    }

    setSubmitting(true);
    try {
      const input = {
        name: name.trim(),
        type,
        description: description.trim() || null,
        is_default: isDefault,
        status: (isActive ? 'active' : 'inactive') as 'active' | 'inactive',
      };
      if (isEditing) {
        await updateGradingSystem(token, gradingSystemId!, input);
      } else {
        await createGradingSystem(token, input);
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not save the grading system.');
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
            {isEditing ? 'Edit Grading System' : 'Add Grading System'}
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
          {isEditing ? 'Edit Grading System' : 'Add Grading System'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. High School Percentage Grading"
          placeholderTextColor={theme.textMuted}
        />

        <Text style={styles.label}>Type</Text>
        <View style={styles.typeGrid}>
          {GRADING_SYSTEM_TYPES.map((t) => {
            const selected = t === type;
            return (
              <TouchableOpacity
                key={t}
                style={[styles.typeOption, selected && styles.typeOptionSelected]}
                onPress={() => setType(t)}
              >
                <Text style={[styles.typeOptionText, selected && styles.typeOptionTextSelected]}>
                  {TYPE_LABELS[t]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>Description (optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Notes on when/where this grading system applies"
          placeholderTextColor={theme.textMuted}
          multiline
          numberOfLines={3}
        />

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>Default</Text>
            <Text style={styles.switchHelp}>
              The default grading system is used when nothing more specific applies.
            </Text>
          </View>
          <Switch value={isDefault} onValueChange={setIsDefault} trackColor={{ true: theme.accent }} />
        </View>

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>Active</Text>
            <Text style={styles.switchHelp}>
              Inactive grading systems are hidden from new assignments but kept for history.
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
            <Text style={styles.saveButtonText}>{isEditing ? 'Save Changes' : 'Add Grading System'}</Text>
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
