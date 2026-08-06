import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Switch,
} from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import GlassBackground from '../../components/glass/GlassBackground';
import GlassCard from '../../components/glass/GlassCard';
import { GlassButton, GlassInput } from '../../components/glass/GlassKit';
import { BRAND, COLORS, RADIUS } from '../../theme/glass';
import {
  fetchSetupStatus,
  saveInstitutionProfile,
  completeSetup,
  createAcademicYear,
  InstitutionType,
  ProgramDuration,
  SetupStatus,
} from '../../services/academicSetupService';
import { updateOwnProfile } from '../../services/userProfileService';
import {
  GRADING_SYSTEM_TYPES,
  GradingSystemType,
  createGradingSystem,
} from '../../services/adminAcademicCatalogService';
import { createEnrollmentStage } from '../../services/enrollmentWorkflowService';

const EMERALD = BRAND.emerald;
const EMERALD_SOFT = 'rgba(34,197,94,0.14)';
const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const ERROR = '#BA1A1A';

const GRADING_TYPE_QUICK_PICKS: GradingSystemType[] = GRADING_SYSTEM_TYPES.filter((gt) =>
  ['percentage', 'letter', 'gpa', 'pass_fail'].includes(gt),
);
const GRADING_TYPE_LABELS: Partial<Record<GradingSystemType, string>> = {
  percentage: 'Percentage',
  letter: 'Letter Grade',
  gpa: 'GPA',
  pass_fail: 'Pass / Fail',
};

// Orphan schools have no academic subsystem or enrollment pipeline (confirmed
// throughout this codebase - dashboards already hide all academic tiles and
// the enrollment gate already excludes orphan students), so the grading and
// enrollment onboarding steps are skipped entirely for them, not just hidden.
function buildStepLabels(institutionType: InstitutionType | null) {
  const base = [
    { key: 'institution', label: 'Institution' },
    { key: 'profile', label: 'Profile' },
    { key: 'admin_info', label: 'Your Info' },
    { key: 'academic_year', label: 'Academic Year' },
  ];
  if (institutionType !== 'orphanage') {
    base.push({ key: 'grading', label: 'Grading' }, { key: 'enrollment', label: 'Enrollment' });
  }
  return base;
}

const INSTITUTION_TYPE_LABELS: Record<InstitutionType, string> = {
  mahad: 'Mahad',
  madrasa: 'Madrasa',
  markaz: 'Markaz',
  regular_school: 'Regular School',
  orphanage: 'Orphan School',
};

const PROGRAM_DURATION_LABELS: Record<ProgramDuration, string> = {
  one_year: 'One Year',
  three_year: 'Three Years',
};

function CheckIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function BuildingIcon() {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      <Rect x="4" y="3" width="16" height="18" rx="1.5" stroke={EMERALD} strokeWidth={1.8} />
      <Path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1" stroke={EMERALD} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

// Bento-style selectable tile - replaces a vertical list of radio rows with
// a 2-column grid of big, tappable cards. Same selection state/handler as
// before (onPress just flips whichever useState the caller passes in) -
// only the visual presentation changed.
function OptionTile({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.tile, selected && styles.tileSelected]} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.tileCheck, selected && styles.tileCheckSelected]}>
        {selected ? <CheckIcon /> : null}
      </View>
      <Text style={[styles.tileLabel, selected && styles.tileLabelSelected]} numberOfLines={2}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/**
 * First thing a brand-new school's admin sees, in place of the dashboard
 * card grid - three quick steps (institution type, institution profile,
 * first academic year) before the app becomes usable.
 *
 * Gated the same way SchoolCodeSetupScreen is: AdminDashboard renders this
 * whenever `user.academic_setup_completed === false`. Existing/legacy
 * schools are backfilled on the backend (setup_completed_at set on
 * migration) so this never appears for them.
 */
export default function AcademicSetupWizardScreen() {
  const { token, user, updateUser } = useAuth();
  const { t } = useLocale();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step: institution
  const [institutionType, setInstitutionType] = useState<InstitutionType | null>(null);
  // Markaz-only sub-choice - see PROGRAM_DURATION_LABELS.
  const [programDuration, setProgramDuration] = useState<ProgramDuration | null>(null);
  // Step: profile
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  // Step: admin_info
  const [adminName, setAdminName] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  // Step: academic_year
  const [yearTitle, setYearTitle] = useState('');
  // Step: grading (skipped for orphanage)
  const [gradingName, setGradingName] = useState('');
  const [gradingType, setGradingType] = useState<GradingSystemType>('percentage');
  // Step: enrollment (skipped for orphanage)
  const [stageName, setStageName] = useState('');
  const [stageCode, setStageCode] = useState('');
  const [stageInstructions, setStageInstructions] = useState('');
  const [stageIsTerminal, setStageIsTerminal] = useState(true);

  const STEP_LABELS = useMemo(() => buildStepLabels(institutionType), [institutionType]);
  const isLastStep = step === STEP_LABELS.length - 1;
  const stepKey = STEP_LABELS[step]?.key;

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await fetchSetupStatus(token);
      setStatus(data);
      setInstitutionType(data.school.institution_type);
      setProgramDuration(data.school.program_duration);
      setName(data.school.name ?? '');
      setNameAr(data.school.name_ar ?? '');
      setAddress(data.school.address ?? '');
      setPhone(data.school.phone ?? '');
      setAdminName(user?.name ?? '');
      setAdminPhone(user?.phone ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('academic_setup_wizard.load_error', 'Could not load setup status.'));
    } finally {
      setLoading(false);
    }
  }, [token, t, user]);

  useEffect(() => {
    load();
  }, [load]);

  const finishUp = async () => {
    const school = await completeSetup(token!);
    updateUser({
      academic_setup_completed: true,
      institution_type: school.institution_type ?? undefined,
    });
  };

  const advance = async () => {
    if (isLastStep) {
      await finishUp();
    } else {
      setStep((s) => s + 1);
    }
  };

  const goNext = async () => {
    if (!token) return;
    setError(null);

    if (stepKey === 'institution') {
      if (!institutionType) {
        setError(t('academic_setup_wizard.choose_institution_type', 'Choose an institution type to continue.'));
        return;
      }
      if (institutionType === 'markaz' && !programDuration) {
        setError(t('academic_setup_wizard.choose_program_duration', 'Choose a program duration to continue.'));
        return;
      }
      setSubmitting(true);
      try {
        await saveInstitutionProfile(token, {
          institution_type: institutionType,
          program_duration: institutionType === 'markaz' ? programDuration ?? undefined : undefined,
        });
        await advance();
      } catch (err) {
        setError(err instanceof Error ? err.message : t('academic_setup_wizard.save_type_error', 'Could not save institution type.'));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (stepKey === 'profile') {
      if (!name.trim()) {
        setError(t('academic_setup_wizard.name_required', 'Institution name is required.'));
        return;
      }
      setSubmitting(true);
      try {
        await saveInstitutionProfile(token, {
          name: name.trim(),
          name_ar: nameAr.trim() || undefined,
          address: address.trim() || undefined,
          phone: phone.trim() || undefined,
        });
        await advance();
      } catch (err) {
        setError(err instanceof Error ? err.message : t('academic_setup_wizard.save_profile_error', 'Could not save institution profile.'));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (stepKey === 'admin_info') {
      if (!adminName.trim()) {
        setError(t('academic_setup_wizard.admin_name_required', 'Your name is required.'));
        return;
      }
      setSubmitting(true);
      try {
        const updated = await updateOwnProfile(token, {
          name: adminName.trim(),
          phone: adminPhone.trim() || null,
        });
        updateUser({ name: updated.name, phone: updated.phone });
        await advance();
      } catch (err) {
        setError(err instanceof Error ? err.message : t('academic_setup_wizard.save_admin_info_error', 'Could not save your info.'));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (stepKey === 'academic_year') {
      if (!yearTitle.trim()) {
        setError(t('academic_setup_wizard.year_title_required', 'Enter a title for your first academic year (e.g. "2026-2027").'));
        return;
      }
      setSubmitting(true);
      try {
        await createAcademicYear(token, yearTitle.trim(), true);
        await advance();
      } catch (err) {
        setError(err instanceof Error ? err.message : t('academic_setup_wizard.finish_error', 'Could not finish setup.'));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (stepKey === 'grading') {
      if (!gradingName.trim()) {
        setError(t('academic_setup_wizard.grading_name_required', 'Name your grading system to continue.'));
        return;
      }
      setSubmitting(true);
      try {
        await createGradingSystem(token, {
          name: gradingName.trim(),
          type: gradingType,
          status: 'active',
        });
        await advance();
      } catch (err) {
        setError(err instanceof Error ? err.message : t('academic_setup_wizard.grading_error', 'Could not save the grading system.'));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (stepKey === 'enrollment') {
      if (!stageName.trim()) {
        setError(t('academic_setup_wizard.stage_name_required', 'Name your first enrollment stage to continue.'));
        return;
      }
      setSubmitting(true);
      try {
        await createEnrollmentStage(token, {
          name: stageName.trim(),
          code: stageCode.trim() || null,
          student_instructions: stageInstructions.trim() || null,
          is_terminal: stageIsTerminal,
          status: 'active',
        });
        await advance();
      } catch (err) {
        setError(err instanceof Error ? err.message : t('academic_setup_wizard.stage_error', 'Could not save the enrollment stage.'));
      } finally {
        setSubmitting(false);
      }
    }
  };

  const goBack = () => {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  };

  if (loading || !status) {
    return (
      <View style={styles.flex}>
        <GlassBackground variant="canvas" />
        <View style={styles.centerLoading}>
          <ActivityIndicator color={EMERALD} size="large" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <KeyboardAvoidingView style={styles.flexInner} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>
          <View style={styles.headerRow}>
            <View style={styles.iconWrap}>
              <BuildingIcon />
            </View>
            <View style={styles.flex1}>
              <Text style={styles.title}>{t('academic_setup_wizard.title', 'Set up your school')}</Text>
              <Text style={styles.subtitle}>
                {t('academic_setup_wizard.subtitle', 'A few quick steps before your Admin, Teacher, and Student portals go live.')}
              </Text>
            </View>
          </View>

          <View style={styles.stepper}>
            {STEP_LABELS.map((step_, i) => (
              <View key={step_.key} style={styles.stepperItem}>
                <View style={[styles.stepDot, i < step && styles.stepDotDone, i === step && styles.stepDotActive]}>
                  {i < step ? <CheckIcon /> : <Text style={[styles.stepDotText, i === step && styles.stepDotTextActive]}>{i + 1}</Text>}
                </View>
                <Text style={[styles.stepLabel, i === step && styles.stepLabelActive]}>{t(`academic_setup_wizard.step_${step_.key}`, step_.label)}</Text>
              </View>
            ))}
          </View>

          <GlassCard surface="light" radius={RADIUS.lg} style={styles.stepCard} contentStyle={styles.stepCardContent}>
            <ScrollView
              contentContainerStyle={styles.stepScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {stepKey === 'institution' && (
                <View>
                  <Text style={styles.stepHeading}>{t('academic_setup_wizard.institution_type_heading', 'What type of institution is this?')}</Text>
                  <Text style={styles.stepHint}>
                    {t('academic_setup_wizard.institution_type_hint', 'This only picks editable starting defaults - everything can be renamed or changed later.')}
                  </Text>
                  <View style={styles.tileGrid}>
                    {status.institution_types.map((type) => (
                      <OptionTile
                        key={type}
                        label={t(`academic_setup_wizard.institution_type_${type}`, INSTITUTION_TYPE_LABELS[type])}
                        selected={institutionType === type}
                        onPress={() => setInstitutionType(type)}
                      />
                    ))}
                  </View>

                  {institutionType === 'markaz' ? (
                    <View style={styles.programDurationWrap}>
                      <Text style={styles.stepHeading}>{t('academic_setup_wizard.program_duration_heading', 'Program duration')}</Text>
                      <Text style={styles.stepHint}>
                        {t('academic_setup_wizard.program_duration_hint', 'How long is your Markaz program?')}
                      </Text>
                      <View style={styles.tileGrid}>
                        {status.program_durations.map((duration) => (
                          <OptionTile
                            key={duration}
                            label={t(`academic_setup_wizard.program_duration_${duration}`, PROGRAM_DURATION_LABELS[duration])}
                            selected={programDuration === duration}
                            onPress={() => setProgramDuration(duration)}
                          />
                        ))}
                      </View>
                    </View>
                  ) : null}
                </View>
              )}

              {stepKey === 'profile' && (
                <View>
                  <Text style={styles.stepHeading}>{t('academic_setup_wizard.profile_heading', 'Institution profile')}</Text>
                  <View style={styles.fieldRow}>
                    <View style={styles.field}>
                      <Text style={styles.label}>{t('academic_setup_wizard.name_label', 'Name')}</Text>
                      <GlassInput value={name} onChangeText={setName} placeholder={t('academic_setup_wizard.name_placeholder', 'Institution name')} style={styles.input} />
                    </View>
                    <View style={styles.field}>
                      <Text style={styles.label}>{t('academic_setup_wizard.name_ar_label', 'Arabic name (optional)')}</Text>
                      <GlassInput value={nameAr} onChangeText={setNameAr} placeholder="الاسم بالعربية" style={styles.input} />
                    </View>
                  </View>
                  <View style={styles.fieldRow}>
                    <View style={styles.field}>
                      <Text style={styles.label}>{t('academic_setup_wizard.address_label', 'Address (optional)')}</Text>
                      <GlassInput value={address} onChangeText={setAddress} placeholder={t('academic_setup_wizard.address_placeholder', 'Address')} style={styles.input} />
                    </View>
                    <View style={styles.field}>
                      <Text style={styles.label}>{t('academic_setup_wizard.phone_label', 'Phone (optional)')}</Text>
                      <GlassInput value={phone} onChangeText={setPhone} placeholder={t('academic_setup_wizard.phone_placeholder', 'Phone number')} keyboardType="phone-pad" style={styles.input} />
                    </View>
                  </View>
                </View>
              )}

              {stepKey === 'admin_info' && (
                <View>
                  <Text style={styles.stepHeading}>{t('academic_setup_wizard.admin_info_heading', 'Your info')}</Text>
                  <Text style={styles.stepHint}>
                    {t('academic_setup_wizard.admin_info_hint', 'A quick confirmation of your own contact details as the school admin.')}
                  </Text>
                  <View style={styles.fieldRow}>
                    <View style={styles.field}>
                      <Text style={styles.label}>{t('academic_setup_wizard.admin_name_label', 'Your name')}</Text>
                      <GlassInput value={adminName} onChangeText={setAdminName} placeholder={t('academic_setup_wizard.admin_name_placeholder', 'Your name')} style={styles.input} />
                    </View>
                    <View style={styles.field}>
                      <Text style={styles.label}>{t('academic_setup_wizard.admin_phone_label', 'Phone (optional)')}</Text>
                      <GlassInput value={adminPhone} onChangeText={setAdminPhone} placeholder={t('academic_setup_wizard.admin_phone_placeholder', 'Your phone number')} keyboardType="phone-pad" style={styles.input} />
                    </View>
                  </View>
                  <Text style={styles.label}>{t('academic_setup_wizard.admin_email_label', 'Email')}</Text>
                  <GlassInput value={user?.email ?? ''} editable={false} style={[styles.input, styles.inputDisabled]} />
                </View>
              )}

              {stepKey === 'academic_year' && (
                <View>
                  <Text style={styles.stepHeading}>{t('academic_setup_wizard.year_heading', 'Your first academic year')}</Text>
                  <Text style={styles.stepHint}>
                    {t('academic_setup_wizard.year_hint', 'You can add more academic years and terms later from Academic Setup in the admin menu.')}
                  </Text>
                  <Text style={styles.label}>{t('academic_setup_wizard.year_title_label', 'Academic year title')}</Text>
                  <GlassInput
                    value={yearTitle}
                    onChangeText={setYearTitle}
                    placeholder="e.g. 2026-2027"
                    style={styles.input}
                  />
                </View>
              )}

              {stepKey === 'grading' && (
                <View>
                  <Text style={styles.stepHeading}>{t('academic_setup_wizard.grading_heading', 'Your first grading system')}</Text>
                  <Text style={styles.stepHint}>
                    {t('academic_setup_wizard.grading_hint', 'You can add more grading systems and build out grade scales later from Academic Setup.')}
                  </Text>
                  <Text style={styles.label}>{t('academic_setup_wizard.grading_name_label', 'Name')}</Text>
                  <GlassInput value={gradingName} onChangeText={setGradingName} placeholder={t('academic_setup_wizard.grading_name_placeholder', 'e.g. Standard Grading')} style={styles.input} />
                  <Text style={styles.label}>{t('academic_setup_wizard.grading_type_label', 'Type')}</Text>
                  <View style={styles.tileGrid}>
                    {GRADING_TYPE_QUICK_PICKS.map((gt) => (
                      <OptionTile
                        key={gt}
                        label={t(`academic_setup_wizard.grading_type_${gt}`, GRADING_TYPE_LABELS[gt] ?? gt)}
                        selected={gradingType === gt}
                        onPress={() => setGradingType(gt)}
                      />
                    ))}
                  </View>
                </View>
              )}

              {stepKey === 'enrollment' && (
                <View>
                  <Text style={styles.stepHeading}>{t('academic_setup_wizard.enrollment_heading', 'Your first enrollment stage')}</Text>
                  <Text style={styles.stepHint}>
                    {t('academic_setup_wizard.enrollment_hint', 'You can build out a full multi-stage pipeline later from Enrollment in the admin menu.')}
                  </Text>
                  <View style={styles.fieldRow}>
                    <View style={[styles.field, { flex: 2 }]}>
                      <Text style={styles.label}>{t('academic_setup_wizard.stage_name_label', 'Stage name')}</Text>
                      <GlassInput value={stageName} onChangeText={setStageName} placeholder={t('academic_setup_wizard.stage_name_placeholder', 'e.g. Admission')} style={styles.input} />
                    </View>
                    <View style={styles.field}>
                      <Text style={styles.label}>{t('academic_setup_wizard.stage_code_label', 'Code (optional)')}</Text>
                      <GlassInput value={stageCode} onChangeText={setStageCode} placeholder={t('academic_setup_wizard.stage_code_placeholder', 'e.g. ADMISSION')} autoCapitalize="characters" style={styles.input} />
                    </View>
                  </View>
                  <Text style={styles.label}>{t('academic_setup_wizard.stage_instructions_label', "What should the student do? (optional)")}</Text>
                  <GlassInput
                    value={stageInstructions}
                    onChangeText={setStageInstructions}
                    placeholder={t('academic_setup_wizard.stage_instructions_placeholder', 'Shown to the student at this stage')}
                    style={[styles.input, styles.textArea]}
                    multiline
                    numberOfLines={2}
                  />
                  <View style={styles.switchRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.switchLabel}>{t('academic_setup_wizard.stage_final_label', 'Final stage')}</Text>
                      <Text style={styles.stepHint}>
                        {t('academic_setup_wizard.stage_final_hint', "Reaching this stage marks the student's enrollment as complete. A new school usually starts with just one.")}
                      </Text>
                    </View>
                    <Switch value={stageIsTerminal} onValueChange={setStageIsTerminal} trackColor={{ true: EMERALD }} />
                  </View>
                </View>
              )}
            </ScrollView>
          </GlassCard>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.actions}>
            {step > 0 ? (
              <GlassButton label={t('common.back', 'Back')} variant="ghost" onPress={goBack} disabled={submitting} style={styles.backButton} />
            ) : null}
            <GlassButton
              label={isLastStep ? t('academic_setup_wizard.finish_setup', 'Finish Setup') : t('academic_setup_wizard.continue', 'Continue')}
              onPress={goNext}
              loading={submitting}
              style={styles.nextButton}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#EFF7F1' },
  flexInner: { flex: 1 },
  flex1: { flex: 1 },
  centerLoading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // flex (not flexGrow) - the header, stepper and action buttons stay put
  // as a fixed frame; only the step card's own content scrolls (see
  // stepCard/stepScroll below). No horizontal padding here anymore - the
  // step card goes edge-to-edge; every other row gets its own horizontal
  // padding instead of inheriting one blanket inset.
  content: { flex: 1, paddingTop: 56 },

  // Icon + title/subtitle side by side instead of stacked and centered -
  // a big, clear header that costs less vertical space than the old
  // centered icon-above-title layout, which matters now that nothing
  // scrolls.
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18, paddingHorizontal: 20 },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  title: { fontSize: 20, fontWeight: '800', color: INK },
  subtitle: { fontSize: 13, color: SUBTLE, lineHeight: 18, marginTop: 3 },

  stepper: { flexDirection: 'row', justifyContent: 'center', gap: 22, marginBottom: 18, paddingHorizontal: 20 },
  stepperItem: { alignItems: 'center', gap: 5 },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: { backgroundColor: EMERALD },
  stepDotDone: { backgroundColor: BRAND.emeraldDeep },
  stepDotText: { fontSize: 11.5, fontWeight: '700', color: SUBTLE },
  stepDotTextActive: { color: '#fff' },
  stepLabel: { fontSize: 10.5, color: SUBTLE, fontWeight: '600' },
  stepLabelActive: { color: EMERALD },

  // flex:1 - the step card fills whatever vertical space is left between
  // the stepper above and the action buttons below.
  //
  // Its content scrolls rather than being clipped: most steps do fit, but
  // some don't - picking Markaz reveals an extra "Program duration" section,
  // and a short screen squeezes the taller steps regardless. The card used
  // to center its content with no ScrollView, so anything too tall
  // overflowed and got cut off at BOTH ends (the heading above and the last
  // options below simply disappeared). stepScroll keeps that centered look
  // while content still fits, and scrolls once it doesn't.
  stepCard: { flex: 1, marginBottom: 16 },
  // flex:1 so the ScrollView inside the card gets a bounded height - without
  // it the card's inner wrapper sizes to content and nothing ever scrolls.
  stepCardContent: { flex: 1 },
  stepScroll: { flexGrow: 1, justifyContent: 'center' },
  stepHeading: { fontSize: 17, fontWeight: '700', color: INK, marginBottom: 6 },
  stepHint: { fontSize: 12.5, color: SUBTLE, lineHeight: 18, marginBottom: 14 },

  // Bento grid: big, self-contained selectable tiles (2 per row) instead
  // of a vertical list of plain radio rows - fewer, taller rows means the
  // same set of options takes less total height while looking "bigger".
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  tile: {
    width: '48%',
    minHeight: 76,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: 14,
    justifyContent: 'space-between',
  },
  tileSelected: { borderColor: EMERALD, backgroundColor: EMERALD_SOFT },
  tileCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
  },
  tileCheckSelected: { borderColor: EMERALD, backgroundColor: EMERALD },
  tileLabel: { fontSize: 14.5, color: INK, fontWeight: '700', marginTop: 10 },
  tileLabelSelected: { color: BRAND.emeraldDeep },
  programDurationWrap: { marginTop: 18, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EDEEF0' },

  // Two labeled fields side by side - a "bento" pairing that halves the
  // vertical space a set of short fields (name/phone, address/phone, etc.)
  // would otherwise take stacked one per row.
  fieldRow: { flexDirection: 'row', gap: 12 },
  field: { flex: 1 },

  label: { fontSize: 12.5, fontWeight: '600', color: SUBTLE, marginBottom: 6, marginTop: 10 },
  input: {},
  inputDisabled: { opacity: 0.6 },
  textArea: { minHeight: 64, paddingTop: 12 },

  switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, paddingVertical: 4, gap: 12 },
  switchLabel: { fontSize: 14.5, fontWeight: '600', color: INK, marginBottom: 3 },

  errorText: { color: ERROR, fontSize: 13.5, marginBottom: 12, textAlign: 'center', paddingHorizontal: 20 },

  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingBottom: 4 },
  backButton: { flex: 1 },
  nextButton: { flex: 2 },
});
