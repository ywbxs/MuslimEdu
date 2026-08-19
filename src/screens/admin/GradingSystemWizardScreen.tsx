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
import { WizardStepHeader, WizardGradientButton } from '../../components/wizard/WizardKit';
import GlassBackground from '../../components/glass/GlassBackground';
import {
  BandInput,
  fetchGradingSystems,
  createGradingSystem,
  updateGradingSystem,
  fetchGradeScales,
  createGradeScale,
  createGradeScaleNewVersion,
  GradeScale,
} from '../../services/adminAcademicCatalogService';

/**
 * Quarterly is this school's only grading system now - no more picking a
 * type. Two steps: name it, then build the Q1-Q4 report's grade scale
 * (used only to decide the "With Honors" badge on
 * StudentQuarterlyReportScreen - a band flagged Honors that the general
 * average falls into). Covers both create and edit; saving writes the
 * grading system and its grade scale (or a new scale version, if one
 * already exists) in one action.
 */

const QUARTERLY_NAME = 'Quarterly Grades';

function IconChevronLeft({ color }: { color: string }) {
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}

let bandKeySeq = 0;
function nextBandKey() {
  bandKeySeq += 1;
  return `band-${bandKeySeq}`;
}
interface EditableBand extends BandInput {
  key: string;
}

function defaultBands(): EditableBand[] {
  return [
    { key: nextBandKey(), min_score: 90, max_score: 100, label: 'A', is_passing: true, honors_eligible: true },
    { key: nextBandKey(), min_score: 80, max_score: 89, label: 'B', is_passing: true, honors_eligible: false },
    { key: nextBandKey(), min_score: 70, max_score: 79, label: 'C', is_passing: true, honors_eligible: false },
    { key: nextBandKey(), min_score: 60, max_score: 69, label: 'D', is_passing: true, honors_eligible: false },
    { key: nextBandKey(), min_score: 0, max_score: 59, label: 'F', is_passing: false, honors_eligible: false },
  ];
}

export default function GradingSystemWizardScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const theme = useAcademicGlassTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { token } = useAuth();
  const { t } = useLocale();

  const gradingSystemId: number | undefined = route.params?.gradingSystemId;
  const isEditing = !!gradingSystemId;

  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(QUARTERLY_NAME);
  const [description, setDescription] = useState('');
  const [isDefault, setIsDefault] = useState(true);
  const [isActive, setIsActive] = useState(true);

  const [currentScale, setCurrentScale] = useState<GradeScale | null>(null);
  const [scaleName, setScaleName] = useState(QUARTERLY_NAME + ' Scale');
  const [bands, setBands] = useState<EditableBand[]>(() => defaultBands());

  useEffect(() => {
    if (!isEditing || !token || !gradingSystemId) return;
    (async () => {
      try {
        setLoading(true);
        const systems = await fetchGradingSystems(token);
        const system = systems.find((s) => s.id === gradingSystemId);
        if (!system) {
          setError(t('grading_system_wizard.not_found', 'Grading system not found.'));
          return;
        }
        setName(system.name);
        setDescription(system.description ?? '');
        setIsDefault(system.is_default);
        setIsActive(system.status === 'active');

        const scales = await fetchGradeScales(token, gradingSystemId);
        const current = scales.find((s) => s.is_current) ?? scales[0] ?? null;
        setCurrentScale(current);
        if (current) {
          setScaleName(current.name);
          setBands(
            (current.bands ?? []).map((b) => ({
              key: nextBandKey(),
              min_score: b.min_score,
              max_score: b.max_score,
              label: b.label,
              gpa_value: b.gpa_value ?? null,
              remarks: b.remarks ?? null,
              is_passing: b.is_passing ?? true,
              honors_eligible: b.honors_eligible ?? false,
              promotion_eligible: b.promotion_eligible ?? true,
            })),
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t('grading_system_wizard.load_error', 'Failed to load grading system.'));
      } finally {
        setLoading(false);
      }
    })();
  }, [isEditing, gradingSystemId, token, t]);

  const updateBand = (key: string, patch: Partial<EditableBand>) => {
    setBands((prev) => prev.map((b) => (b.key === key ? { ...b, ...patch } : b)));
  };
  const removeBand = (key: string) => {
    setBands((prev) => (prev.length > 1 ? prev.filter((b) => b.key !== key) : prev));
  };
  const addBand = () => {
    setBands((prev) => [
      ...prev,
      { key: nextBandKey(), min_score: 0, max_score: 0, label: '', gpa_value: null, is_passing: true, honors_eligible: false },
    ]);
  };

  const validateStep1 = (): string | null => {
    if (!name.trim()) return t('grading_system_wizard.name_required', 'Grading system name is required.');
    return null;
  };
  const validateStep2 = (): string | null => {
    if (!scaleName.trim()) return t('grading_system_wizard.scale_name_required', 'Scale name is required.');
    if (bands.length === 0) return t('grading_system_wizard.need_one_band', 'Add at least one band.');
    for (const b of bands) {
      if (!b.label.trim()) return t('grading_system_wizard.label_required', 'Every band needs a label (e.g. "A", "Pass").');
      if (Number.isNaN(b.min_score) || Number.isNaN(b.max_score)) return t('grading_system_wizard.scores_must_be_numbers', 'Band scores must be numbers.');
      if (b.max_score < b.min_score) {
        return t('grading_system_wizard.max_below_min', '"{label}" has a max score below its min score.').replace('{label}', b.label);
      }
    }
    return null;
  };

  const goNext = () => {
    const err = validateStep1();
    if (err) {
      Alert.alert(t('grading_system_wizard.check_details', 'Check the details'), err);
      return;
    }
    setStep(2);
  };
  const goBackStep = () => {
    if (step === 1) {
      navigation.goBack();
      return;
    }
    setStep(1);
  };

  const onSave = async () => {
    if (!token) {
      Alert.alert(t('common.error', 'Error'), t('grading_system_wizard.session_expired', 'Your session expired. Please log in again.'));
      return;
    }
    const err = validateStep2();
    if (err) {
      Alert.alert(t('grading_system_wizard.check_bands', 'Check the bands'), err);
      return;
    }

    const bandPayload: BandInput[] = bands.map((b) => ({
      min_score: b.min_score,
      max_score: b.max_score,
      label: b.label.trim(),
      gpa_value: b.gpa_value,
      remarks: b.remarks,
      is_passing: b.is_passing,
      honors_eligible: b.honors_eligible,
      promotion_eligible: b.promotion_eligible,
    }));

    setSubmitting(true);
    try {
      const input = {
        name: name.trim(),
        type: 'quarterly' as const,
        description: description.trim() || null,
        is_default: isDefault,
        status: (isActive ? 'active' : 'inactive') as 'active' | 'inactive',
      };

      let targetId = gradingSystemId;
      if (isEditing) {
        await updateGradingSystem(token, gradingSystemId!, input);
      } else {
        const created = await createGradingSystem(token, input);
        targetId = created.id;
      }

      if (currentScale) {
        await createGradeScaleNewVersion(token, currentScale.id, bandPayload, scaleName.trim());
      } else {
        await createGradeScale(token, targetId!, scaleName.trim(), bandPayload);
      }

      navigation.goBack();
    } catch (err) {
      Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('grading_system_wizard.save_error', 'Could not save the grading system.'));
    } finally {
      setSubmitting(false);
    }
  };

  const stepLabels = [
    t('grading_system_wizard.step_details', 'Details'),
    t('grading_system_wizard.step_scale', 'Scale'),
  ];

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
            <IconChevronLeft color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, styles.headerTitleFlex]}>
            {t('grading_system_wizard.title', 'Quarterly Grades')}
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
        <TouchableOpacity onPress={goBackStep} hitSlop={10} style={styles.backButton}>
          <IconChevronLeft color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, styles.headerTitleFlex]}>
          {isEditing
            ? t('grading_system_wizard.edit_title', 'Edit Quarterly Grades')
            : t('grading_system_wizard.add_title', 'Set Up Quarterly Grades')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <WizardStepHeader step={step} labels={stepLabels} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {step === 1 ? (
          <>
            <Text style={styles.stepTitle}>{t('grading_system_wizard.details_title', 'Name it')}</Text>
            <Text style={styles.stepSubtitle}>
              {t(
                'grading_system_wizard.details_subtitle_quarterly',
                'Grades are computed and reported each quarter (Q1-Q4) - this names the setup teachers and admins will see.',
              )}
            </Text>

            <Text style={styles.label}>{t('grading_system_form.name_label', 'Name')}</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={t('grading_system_form.name_placeholder', 'e.g. Quarterly Grades')}
              placeholderTextColor={theme.textMuted}
            />

            <Text style={styles.label}>{t('grading_system_form.description_label', 'Description (optional)')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder={t('grading_system_form.description_placeholder', 'Notes on when/where this grading system applies')}
              placeholderTextColor={theme.textMuted}
              multiline
              numberOfLines={3}
            />

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchLabel}>{t('grading_system_form.default', 'Default')}</Text>
                <Text style={styles.switchHelp}>
                  {t('grading_system_form.default_help', 'The default grading system is used when nothing more specific applies.')}
                </Text>
              </View>
              <Switch value={isDefault} onValueChange={setIsDefault} trackColor={{ true: theme.accent }} />
            </View>

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchLabel}>{t('grading_system_form.active', 'Active')}</Text>
                <Text style={styles.switchHelp}>
                  {t('grading_system_form.active_help', 'Inactive grading systems are hidden from new assignments but kept for history.')}
                </Text>
              </View>
              <Switch value={isActive} onValueChange={setIsActive} trackColor={{ true: theme.accent }} />
            </View>
          </>
        ) : (
          <>
            <Text style={styles.stepTitle}>{t('grading_system_wizard.scale_title', 'Build the grade scale')}</Text>
            <Text style={styles.stepSubtitle}>
              {currentScale
                ? t(
                    'grade_scale_builder.version_banner',
                    'Editing bands creates version {next}. Version {current} stays intact for any grade already recorded against it.',
                  )
                    .replace('{next}', String(currentScale.version + 1))
                    .replace('{current}', String(currentScale.version))
                : t(
                    'grading_system_wizard.scale_subtitle_quarterly',
                    "This decides the \"With Honors\" badge on a student's quarterly report - whichever band their general average falls into. We've started you off with a standard breakdown.",
                  )}
            </Text>

            <Text style={styles.label}>{t('grade_scale_builder.scale_name', 'Scale Name')}</Text>
            <TextInput
              style={styles.input}
              value={scaleName}
              onChangeText={setScaleName}
              placeholder={t('grade_scale_builder.scale_name_placeholder', 'e.g. Standard Percentage Scale')}
              placeholderTextColor={theme.textMuted}
            />

            <View style={styles.bandsHeaderRow}>
              <Text style={styles.label}>{t('grade_scale_builder.bands', 'Bands')}</Text>
              <TouchableOpacity onPress={addBand}>
                <Text style={styles.addBandText}>{t('grade_scale_builder.add_band', '+ Add band')}</Text>
              </TouchableOpacity>
            </View>

            {bands.map((band) => (
              <View key={band.key} style={styles.bandCard}>
                <View style={styles.bandRowTop}>
                  <View style={styles.bandScoreField}>
                    <Text style={styles.fieldLabel}>{t('grade_scale_builder.min', 'Min')}</Text>
                    <TextInput
                      style={styles.smallInput}
                      keyboardType="numeric"
                      value={String(band.min_score)}
                      onChangeText={(v) => updateBand(band.key, { min_score: Number(v) || 0 })}
                    />
                  </View>
                  <View style={styles.bandScoreField}>
                    <Text style={styles.fieldLabel}>{t('grade_scale_builder.max', 'Max')}</Text>
                    <TextInput
                      style={styles.smallInput}
                      keyboardType="numeric"
                      value={String(band.max_score)}
                      onChangeText={(v) => updateBand(band.key, { max_score: Number(v) || 0 })}
                    />
                  </View>
                  <View style={styles.bandLabelField}>
                    <Text style={styles.fieldLabel}>{t('grade_scale_builder.label', 'Label')}</Text>
                    <TextInput
                      style={styles.smallInput}
                      value={band.label}
                      onChangeText={(v) => updateBand(band.key, { label: v })}
                      placeholder="A / Pass / 4.0"
                      placeholderTextColor={theme.textMuted}
                    />
                  </View>
                </View>

                <View style={styles.bandRowBottom}>
                  <View style={styles.pill}>
                    <Switch
                      value={!!band.is_passing}
                      onValueChange={(v) => updateBand(band.key, { is_passing: v })}
                      trackColor={{ true: theme.accent }}
                    />
                    <Text style={styles.pillText}>{t('grade_scale_builder.passing', 'Passing')}</Text>
                  </View>
                  <View style={styles.pill}>
                    <Switch
                      value={!!band.honors_eligible}
                      onValueChange={(v) => updateBand(band.key, { honors_eligible: v })}
                      trackColor={{ true: theme.accent }}
                    />
                    <Text style={styles.pillText}>{t('grade_scale_builder.honors', 'Honors')}</Text>
                  </View>

                  <TouchableOpacity onPress={() => removeBand(band.key)} disabled={bands.length <= 1}>
                    <Text style={[styles.removeText, bands.length <= 1 && styles.removeTextDisabled]}>
                      {t('grade_scale_builder.remove', 'Remove')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}

        <View style={styles.navRow}>
          {step > 1 ? (
            <TouchableOpacity style={styles.backStepButton} onPress={goBackStep}>
              <Text style={styles.backStepButtonText}>{t('common.back', 'Back')}</Text>
            </TouchableOpacity>
          ) : null}
          <View style={{ flex: 1 }}>
            <WizardGradientButton
              label={
                step < 2
                  ? t('grading_system_wizard.next', 'Next')
                  : isEditing
                  ? t('grading_system_form.save_changes', 'Save Changes')
                  : t('grading_system_wizard.finish', 'Create Grading System')
              }
              onPress={step < 2 ? goNext : onSave}
              loading={submitting}
            />
          </View>
        </View>
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
    headerTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
    headerTitleFlex: { flex: 1, marginLeft: 8 },
    backButton: { width: 32 },
    headerSpacer: { width: 32 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    content: { padding: 20, paddingBottom: 48 },
    errorText: { color: theme.danger, fontSize: 13.5, marginBottom: 16, textAlign: 'center' },

    stepTitle: { fontSize: 19, fontWeight: '800', color: theme.textPrimary },
    stepSubtitle: { fontSize: 13, color: theme.textSecondary, marginTop: 6, lineHeight: 18 },

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

    switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: 22, paddingVertical: 4 },
    switchLabel: { fontSize: 14.5, fontWeight: '600', color: theme.textPrimary, marginBottom: 3 },
    switchHelp: { fontSize: 12, color: theme.textSecondary, lineHeight: 16 },

    bandsHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    addBandText: { color: theme.accent, fontWeight: '700', fontSize: 13, marginTop: 16 },

    bandCard: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: RADIUS.md ?? 10,
      padding: 12,
      marginTop: 10,
    },
    bandRowTop: { flexDirection: 'row', gap: 8 },
    bandScoreField: { width: 64 },
    bandLabelField: { flex: 1 },
    fieldLabel: { fontSize: 10.5, fontWeight: '600', color: theme.textSecondary, marginBottom: 4 },
    smallInput: {
      height: 40,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: RADIUS.sm,
      paddingHorizontal: 8,
      fontSize: 13.5,
      backgroundColor: theme.background === 'transparent' ? '#FFFFFF' : theme.background,
      color: theme.textPrimary,
    },

    bandRowBottom: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, alignItems: 'center', marginTop: 10 },
    pill: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    pillText: { fontSize: 12.5, color: theme.textSecondary, fontWeight: '600' },
    removeText: { color: theme.danger, fontSize: 12.5, fontWeight: '600', marginLeft: 'auto' },
    removeTextDisabled: { opacity: 0.4 },

    navRow: { flexDirection: 'row', gap: 10, marginTop: 32, alignItems: 'center' },
    backStepButton: {
      height: 54,
      paddingHorizontal: 18,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backStepButtonText: { color: theme.textPrimary, fontWeight: '700', fontSize: 15 },
  });
