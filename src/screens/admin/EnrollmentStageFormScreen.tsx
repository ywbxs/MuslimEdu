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
  fetchEnrollmentStages,
  createEnrollmentStage,
  updateEnrollmentStage,
} from '../../services/enrollmentWorkflowService';

/**
 * Create + edit in one screen, matching DepartmentFormScreen's pattern for
 * the module. There's no admin_enrollment_stages_get - editing re-uses the
 * _list endpoint and finds the row by id client-side (the list is always
 * small - a school's enrollment pipeline, not a paginated table).
 */

function IconChevronLeft({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Polyline points="15 5 8 12 15 19" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function EnrollmentStageFormScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const theme = useAcademicGlassTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { token } = useAuth();

  const stageId: number | undefined = route.params?.stageId;
  const isEditing = !!stageId;

  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [isTerminal, setIsTerminal] = useState(false);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!isEditing || !token) return;
    (async () => {
      try {
        setLoading(true);
        const stages = await fetchEnrollmentStages(token);
        const stage = stages.find((s) => s.id === stageId);
        if (!stage) {
          setError('Stage not found.');
          return;
        }
        setName(stage.name);
        setCode(stage.code ?? '');
        setIsTerminal(stage.is_terminal);
        setIsActive(stage.status === 'active');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load stage.');
      } finally {
        setLoading(false);
      }
    })();
  }, [isEditing, stageId, token]);

  const canSubmit = name.trim().length > 0 && !submitting;

  const onSave = async () => {
    if (!token) {
      Alert.alert('Error', 'Your session expired. Please log in again.');
      return;
    }
    if (!name.trim()) {
      Alert.alert('Error', 'Stage name is required.');
      return;
    }

    setSubmitting(true);
    try {
      const input = {
        name: name.trim(),
        code: code.trim() || null,
        is_terminal: isTerminal,
        status: (isActive ? 'active' : 'inactive') as 'active' | 'inactive',
      };
      if (isEditing) {
        await updateEnrollmentStage(token, stageId!, input);
      } else {
        await createEnrollmentStage(token, input);
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not save the stage.');
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
            {isEditing ? 'Edit Stage' : 'Add Stage'}
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
          {isEditing ? 'Edit Stage' : 'Add Stage'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Text style={styles.label}>Stage Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Admission, Cashier, Registrar"
          placeholderTextColor={theme.textMuted}
        />

        <Text style={styles.label}>Code (optional)</Text>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          placeholder="e.g. ADMISSION"
          placeholderTextColor={theme.textMuted}
          autoCapitalize="characters"
        />

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>Final stage</Text>
            <Text style={styles.switchHelp}>
              Reaching this stage marks the student's enrollment as complete.
            </Text>
          </View>
          <Switch
            value={isTerminal}
            onValueChange={setIsTerminal}
            trackColor={{ true: theme.accent }}
          />
        </View>

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>Active</Text>
            <Text style={styles.switchHelp}>
              Inactive stages are hidden from new students but kept for history.
            </Text>
          </View>
          <Switch
            value={isActive}
            onValueChange={setIsActive}
            trackColor={{ true: theme.accent }}
          />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, !canSubmit && styles.saveButtonDisabled]}
          disabled={!canSubmit}
          onPress={onSave}
        >
          {submitting ? (
            <ActivityIndicator color={theme.onAccent} />
          ) : (
            <Text style={styles.saveButtonText}>{isEditing ? 'Save Changes' : 'Add Stage'}</Text>
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
