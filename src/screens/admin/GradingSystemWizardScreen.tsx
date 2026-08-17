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
import { ChevronLeft, CircleCheck } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { useAcademicGlassTheme, AcademicGlassTheme } from '../teachers/academicGlassTheme';
import { RADIUS } from '../../theme/glass';
import { WizardStepHeader, WizardGradientButton } from '../../components/wizard/WizardKit';
import GlassBackground from '../../components/glass/GlassBackground';
import {
  GRADING_SYSTEM_TYPES,
  GradingSystemType,
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
 * Replaces the old two-hop flow (GradingSystemFormScreen for name/type,
 * then a separate GradeScaleBuilder navigation for bands) with one wizard:
 * pick a type, fill in the details, build the scale, save - covering both
 * create and edit. Quarterly is the pre-selected type for a brand-new
 * system since it's this school's most common grading period; every other
 * type is still one tap away on step 1.
 */

function IconChevronLeft({ color }: { color: string }) {
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
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
  quarterly: 'Quarterly',
  custom: 'Custom',
};

const TYPE_DESCRIPTIONS: Record<GradingSystemType, string> = {
  percentage: 'Scores as a 0-100% number.',
  letter: 'A, B, C, D, F style letter grades.',
  gpa: 'Grade point average on a 0.0-4.0 scale.',
  competency: 'Skill mastery levels instead of a score.',
  pass_fail: 'Just a pass or fail outcome.',
  memorization: "Track memorized material, e.g. Qur'an.",
  behavior: 'Conduct and behavior ratings.',
  attendance: 'Attendance-based scoring.',
  oral: 'Oral exam or recitation scoring.',
  written: 'Written exam scoring.',
  practical: 'Hands-on / practical skill scoring.',
  islamic_studies: 'Islamic Studies subject grading.',
  arabic: 'Arabic language subject grading.',
  quarterly: 'Grades computed and reported each quarter.',
  custom: 'Define your own grading approach.',
};

const NAME_SUGGESTIONS: Record<GradingSystemType, string> = {
  percentage: 'Percentage Grading',
  letter: 'Letter Grade Grading',
  gpa: 'GPA Grading',
  competency: 'Competency Grading',
  pass_fail: 'Pass / Fail Grading',
  memorization: 'Memorization Grading',
  behavior: 'Behavior Grading',
  attendance: 'Attendance Grading',
  oral: 'Oral Grading',
  written: 'Written Grading',
  practical: 'Practical Grading',
  islamic_studies: 'Islamic Studies Grading',
  arabic: 'Arabic Grading',
  quarterly: 'Quarterly Grades',
  custom: 'Custom Grading',
};

// Type selection is a grid, but Quarterly leads the list (and is
// pre-selected below) since it's the default this wizard steers new
// schools toward - every other type is still right there, just not first.
const ORDERED_TYPES: GradingSystemType[] = [
  'quarterly',
  ...GRADING_SYSTEM_TYPES.filter((t) => t !== 'quarterly'),
];

let bandKeySeq = 0;
function nextBandKey() {
  bandKeySeq += 1;
  return `band-${bandKeySeq}`;
}
interface EditableBand extends BandInput {
  key: string;
}

function defaultBandsFor(type: GradingSystemType): EditableBand[] {
  if (type === 'pass_fail') {
    return [
      { key: nextBandKey(), min_score: 60, max_score: 100, label: 'Pass', is_passing: true },
      { key: nextBandKey(), min_score: 0, max_score: 59, label: 'Fail', is_passing: false },
    ];
  }
  if (type === 'gpa') {
    return [
      { key: nextBandKey(), min_score: 90, max_score: 100, label: 'A', gpa_value: 4.0, is_passing: true },
      { key: nextBandKey(), min_score: 80, max_score: 89, label: 'B', gpa_value: 3.0, is_passing: true },
      { key: nextBandKey(), min_score: 70, max_score: 79, label: 'C', gpa_value: 2.0, is_passing: true },
      { key: nextBandKey(), min_score: 60, max_score: 69, label: 'D', gpa_value: 1.0, is_passing: true },
      { key: nextBandKey(), min_score: 0, max_score: 59, label: 'F', gpa_value: 0.0, is_passing: false },
    ];
  }
  // Standard A-F breakdown - a reasonable starting point for percentage,
  // letter, quarterly, and everything else; admins can freely edit/remove.
  return [
    { key: nextBandKey(), min_score: 90, max_score: 100, label: 'A', is_passing: true },
    { key: nextBandKey(), min_score: 80, max_score: 89, label: 'B', is_passing: true },
    { key: nextBandKey(), min_score: 70, max_score: 79, label: 'C', is_passing: true },
    { key: nextBandKey(), min_score: 60, max_score: 69, label: 'D', is_passing: true },
    { key: nextBandKey(), min_score: 0, max_score: 59, label: 'F', is_passing: false },
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

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<GradingSystemType>('quarterly');
  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const [currentScale, setCurrentScale] = useState<GradeScale | null>(null);
  const [scaleName, setScaleName] = useState('');
  const [bands, setBands] = useState<EditableBand[]>(() => defaultBandsFor('quarterly'));

  // New system, type still at its default: keep the suggested name in sync
  // as the admin browses step 1, but stop touching it the moment they've
  // typed their own.
  useEffect(() => {
    if (!isEditing && !nameTouched) {
      setName(NAME_SUGGESTIONS[type]);
    }
  }, [type, isEditing, nameTouched]);

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
        setType(system.type);
        setName(system.name);
        setNameTouched(true);
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
        } else {
          setScaleName(NAME_SUGGESTIONS[system.type] + ' Scale');
          setBands(defaultBandsFor(system.type));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t('grading_system_wizard.load_error', 'Failed to load grading system.'));
      } finally {
        setLoading(false);
      }
    })();
  }, [isEditing, gradingSystemId, token, t]);

  const selectType = (next: GradingSystemType) => {
    setType(next);
    // A fresh system with untouched (still-default) bands follows the type
    // choice too, so picking GPA on step 1 doesn't leave a Pass/Fail scale
    // sitting on step 3. Once the admin has actually edited a band by hand
    // this stops - see bandsTouched.
    if (!isEditing && !bandsTouched) {
      setBands(defaultBandsFor(next));
      setScaleName(NAME_SUGGESTIONS[next] + ' Scale');
    }
  };

  const [bandsTouched, setBandsTouched] = useState(false);
  const updateBand = (key: string, patch: Partial<EditableBand>) => {
    setBandsTouched(true);
    setBands((prev) => prev.map((b) => (b.key === key ? { ...b, ...patch } : b)));
  };
  const removeBand = (key: string) => {
    setBandsTouched(true);
    setBands((prev) => (prev.length > 1 ? prev.filter((b) => b.key !== key) : prev));
  };
  const addBand = () => {
    setBandsTouched(true);
    setBands((prev) => [
      ...prev,
      { key: nextBandKey(), min_score: 0, max_score: 0, label: '', gpa_value: null, is_passing: true },
    ]);
  };

  const validateStep2 = (): string | null => {
    if (!name.trim()) return t('grading_system_wizard.name_required', 'Grading system name is required.');
    return null;
  };
  const validateStep3 = (): string | null => {
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
    if (step === 2) {
      const err = validateStep2();
      if (err) {
        Alert.alert(t('grading_system_wizard.check_details', 'Check the details'), err);
        return;
      }
    }
    setStep((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3) : s));
  };
  const goBackStep = () => {
    if (step === 1) {
      navigation.goBack();
      return;
    }
    setStep((s) => (s - 1) as 1 | 2 | 3);
  };

  const onSave = async () => {
    if (!token) {
      Alert.alert(t('common.error', 'Error'), t('grading_system_wizard.session_expired', 'Your session expired. Please log in again.'));
      return;
    }
    const err = validateStep3();
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
        type,
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
    t('grading_system_wizard.step_type', 'Type'),
    t('grading_system_wizard.step_details', 'Details'),
    t('grading_system_wizard.step_scale', 'Scale'),
  ];

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
            <IconChevronLeft color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, styles.headerTitleFlex]}>
            {t('grading_system_wizard.title', 'Grading System')}
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
        <TouchableOpacity onPress={goBackStep} hitSlop={10} style={styles.backButton}>
          <IconChevronLeft color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, styles.headerTitleFlex]}>
          {isEditing
            ? t('grading_system_wizard.edit_title', 'Edit Grading System')
            : t('grading_system_wizard.add_title', 'Add Grading System')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <WizardStepHeader step={step} labels={stepLabels} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {step === 1 ? (
          <>
            <Text style={styles.stepTitle}>{t('grading_system_wizard.choose_type_title', 'Choose a grading system')}</Text>
            <Text style={styles.stepSubtitle}>
              {t('grading_system_wizard.choose_type_subtitle', 'Quarterly is selected by default - pick a different one if this school needs it.')}
            </Text>

            <View style={{ gap: 10, marginTop: 16 }}>
              {ORDERED_TYPES.map((gt) => {
                const selected = gt === type;
                return (
                  <TouchableOpacity
                    key={gt}
                    style={[styles.typeCard, selected && styles.typeCardSelected]}
                    onPress={() => selectType(gt)}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={styles.typeCardHeaderRow}>
                        <Text style={[styles.typeCardName, selected && styles.typeCardNameSelected]}>
                          {t(`grading_system_wizard.type_${gt}`, TYPE_LABELS[gt])}
                        </Text>
                        {gt === 'quarterly' ? (
                          <View style={styles.defaultBadge}>
                            <Text style={styles.defaultBadgeText}>{t('grading_system_wizard.default_badge', 'Default')}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.typeCardDesc}>{t(`grading_system_wizard.type_desc_${gt}`, TYPE_DESCRIPTIONS[gt])}</Text>
                    </View>
                    {selected ? <CircleCheck size={20} color={theme.accent} strokeWidth={2.2} /> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        ) : step === 2 ? (
          <>
            <Text style={styles.stepTitle}>{t('grading_system_wizard.details_title', 'Name it')}</Text>
            <Text style={styles.stepSubtitle}>
              {t('grading_system_wizard.details_subtitle', 'How this grading system will show up to teachers and admins.')}
            </Text>

            <Text style={styles.label}>{t('grading_system_form.name_label', 'Name')}</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={(v) => {
                setNameTouched(true);
                setName(v);
              }}
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
                : t('grading_system_wizard.scale_subtitle', "We've started you off with a standard breakdown - edit, remove, or add bands as needed.")}
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
                  <View style={styles.bandGpaField}>
                    <Text style={styles.fieldLabel}>{t('grade_scale_builder.gpa', 'GPA')}</Text>
                    <TextInput
                      style={styles.smallInput}
                      keyboardType="numeric"
                      value={band.gpa_value != null ? String(band.gpa_value) : ''}
                      onChangeText={(v) => updateBand(band.key, { gpa_value: v ? Number(v) : null })}
                      placeholder="-"
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
                step < 3
                  ? t('grading_system_wizard.next', 'Next')
                  : isEditing
                  ? t('grading_system_form.save_changes', 'Save Changes')
                  : t('grading_system_wizard.finish', 'Create Grading System')
              }
              onPress={step < 3 ? goNext : onSave}
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

    typeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      borderRadius: RADIUS.md ?? 10,
      padding: 14,
    },
    typeCardSelected: { borderColor: theme.accent, backgroundColor: theme.accentSoft },
    typeCardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    typeCardName: { fontSize: 15, fontWeight: '700', color: theme.textPrimary },
    typeCardNameSelected: { color: theme.accentSoftText },
    typeCardDesc: { fontSize: 12, color: theme.textSecondary, marginTop: 3, lineHeight: 16 },
    defaultBadge: { backgroundColor: theme.accent, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
    defaultBadgeText: { fontSize: 10, fontWeight: '800', color: theme.onAccent },

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
    bandScoreField: { width: 56 },
    bandLabelField: { flex: 1 },
    bandGpaField: { width: 56 },
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

    bandRowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
    pill: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    pillText: { fontSize: 12.5, color: theme.textSecondary, fontWeight: '600' },
    removeText: { color: theme.danger, fontSize: 12.5, fontWeight: '600' },
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
