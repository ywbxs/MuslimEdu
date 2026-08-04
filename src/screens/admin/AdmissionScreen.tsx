import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { BlurView } from '@react-native-community/blur';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { md3 } from './admission/theme';
import Stepper, { StepDef } from './admission/components/Stepper';
import FormField from './admission/components/FormField';
import ChipGroup from './admission/components/ChipGroup';
import PhotoField, { PreparedPhotoState } from './admission/components/PhotoField';
import AdmissionSuccessModal from './admission/components/SuccessModal';
import SignaturePad, { SignaturePadHandle } from '../../components/SignaturePad';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GlassBackground from '../../components/glass/GlassBackground';
import GlassCard from '../../components/glass/GlassCard';
import { GLASS, RADIUS } from '../../theme/glass';
import { isOrphanSchoolUser } from '../../utils/orphanSchool';
import {
  admitStudent,
  fetchClasses,
  fetchSections,
  AdmissionInput,
  ClassOption,
  SectionOption,
} from '../../services/adminService';
import { PickedPhoto } from '../../services/orphanService';

// Plain text fields, grouped by which step they belong to. Class + Section
// are ID pickers and the photo is its own step, both handled separately below.
const BASE_FIELDS: {
  key: keyof AdmissionInput;
  label: string;
  required?: boolean;
  requiredWhenOrphan?: boolean;
  keyboard?: 'default' | 'email-address' | 'phone-pad';
  secure?: boolean;
}[] = [
  { key: 'name', label: 'Full name', required: true },
  { key: 'name_ar', label: 'Arabic name' },
  { key: 'email', label: 'Email', keyboard: 'email-address', requiredWhenOrphan: true },
  { key: 'password', label: 'Password', required: true, secure: true },
  { key: 'phone', label: 'Phone', keyboard: 'phone-pad', requiredWhenOrphan: true },
  { key: 'emergency_contact_name', label: 'Emergency contact name' },
  { key: 'emergency_contact_phone', label: 'Emergency contact phone', keyboard: 'phone-pad' },
];

// Orphan-profile fields. These only ever get saved on the backend when the
// admin's school is orphanage-type, so this whole step is skipped otherwise -
// no point asking for info that would just be silently discarded. Since the
// step only shows up for orphan schools, every field in it is required: a
// child's care record shouldn't have gaps in guardian/health info.
const ORPHAN_FIELDS: {
  key: keyof AdmissionInput;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  required?: boolean;
}[] = [
  { key: 'guardian_name', label: 'Guardian name', required: true },
  { key: 'guardian_relation', label: 'Guardian relation', placeholder: 'e.g. Uncle, Grandmother', required: true },
  { key: 'guardian_phone', label: 'Guardian phone', placeholder: 'Guardian phone', required: true },
  { key: 'health_status', label: 'Health status', required: true },
  { key: 'special_needs', label: 'Special needs', required: true },
  { key: 'admission_date', label: 'Admission date', placeholder: 'YYYY-MM-DD', required: true },
  { key: 'admission_reason', label: 'Admission reason', multiline: true, required: true },
];

type StepKey = 'basic' | 'photo' | 'signature' | 'class' | 'orphan';
type FieldErrors = Partial<Record<string, string>>;

function ChevronLeft({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline
        points="15 5 8 12 15 19"
        stroke={md3.color.primary}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const emptyForm: AdmissionInput = { name: '' };

export default function AdmissionScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token, user } = useAuth();
  const { t } = useLocale();
  const fieldLabel = (f: { key: string; label: string }) => t(`admission.field_${f.key}`, f.label);
  const fieldPlaceholder = (f: { key: string; placeholder?: string }) =>
    f.placeholder ? t(`admission.field_${f.key}_placeholder`, f.placeholder) : undefined;

  const [form, setForm] = useState<AdmissionInput>(emptyForm);
  const [photo, setPhoto] = useState<PreparedPhotoState | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [signature, setSignature] = useState<PickedPhoto | null>(null);
  const [signatureEmpty, setSignatureEmpty] = useState(true);
  const signaturePadRef = useRef<SignaturePadHandle>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [admittedName, setAdmittedName] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [sections, setSections] = useState<SectionOption[]>([]);

  const stepAnim = useRef(new Animated.Value(1)).current;

  const set = (key: keyof AdmissionInput, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setPhoto(null);
    setPhotoError(null);
    setSignature(null);
    setSignatureEmpty(true);
    signaturePadRef.current?.clear();
    setFieldErrors({});
    setSubmitError(null);
    setStepIndex(0);
  };

  const isOrphanSchool = isOrphanSchoolUser(user);

  // Load classes once. Sections reload whenever the chosen class changes.
  // Orphan schools never show the Class & Section step (see `steps` below)
  // and have no classes/sections to speak of, so skip both calls entirely.
  useEffect(() => {
    if (!token || isOrphanSchool) return;
    fetchClasses(token)
      .then(setClasses)
      .catch(() => {
        /* silent - picker just stays empty, admin can still submit name-only */
      });
  }, [token, isOrphanSchool]);

  useEffect(() => {
    if (!token || isOrphanSchool) return;
    fetchSections(token, form.class_id)
      .then(setSections)
      .catch(() => setSections([]));
  }, [token, isOrphanSchool, form.class_id]);

  useEffect(() => {
    stepAnim.setValue(0);
    Animated.timing(stepAnim, {
      toValue: 1,
      duration: md3.motion.standard,
      useNativeDriver: true,
    }).start();
  }, [stepIndex, stepAnim]);

  const steps: { key: StepKey; title: string; subtitle: string }[] = [
    { key: 'basic', title: t('admission.step_basic_title', 'Basic Info'), subtitle: t('admission.step_basic_subtitle', "The student's name, login, and contact details.") },
    { key: 'photo', title: t('admission.step_photo_title', 'Profile Picture'), subtitle: t('admission.step_photo_subtitle', 'A clear photo helps staff recognize this student.') },
    { key: 'signature', title: t('admission.step_signature_title', 'Signature'), subtitle: t('admission.step_signature_subtitle', "Draw the student's signature for their ID card - optional, skip if unavailable.") },
    // Orphan schools don't organize children by class/section - they're
    // identified by the unified student code (auto-generated on the backend,
    // or set manually via the "Student code" field in Basic Info) instead.
    // Skipping this step entirely also fixes a fresh orphan school - with no
    // classes/sections created yet - being unable to admit any student at all.
    ...(isOrphanSchool
      ? []
      : ([{ key: 'class', title: t('admission.step_class_title', 'Class & Section'), subtitle: t('admission.step_class_subtitle', 'Where this student will be enrolled.') }] as const)),
    ...(isOrphanSchool
      ? ([{ key: 'orphan', title: t('admission.step_orphan_title', 'Orphan Information'), subtitle: t('admission.step_orphan_subtitle', 'Guardian and care details for this child.') }] as const)
      : []),
  ];
  const step = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;

  const validateBasic = (): FieldErrors => {
    const errs: FieldErrors = {};
    if (!form.name?.trim()) errs.name = t('admission.error_name_required', 'A student needs at least a full name.');
    if (!form.password || form.password.length < 6) errs.password = t('admission.error_password_length', 'Use at least 6 characters.');
    if (isOrphanSchool && !form.email?.trim()) errs.email = t('admission.error_email_required', 'Email is required for orphan admission.');
    if (isOrphanSchool && !form.phone?.trim()) errs.phone = t('admission.error_phone_required', 'Phone is required for orphan admission.');
    return errs;
  };

  const validateClass = (): FieldErrors => {
    // Class & Section is optional either way (and this step isn't even shown
    // to orphan schools - see the `steps` array above).
    return {};
  };

  const validateOrphan = (): FieldErrors => {
    const errs: FieldErrors = {};
    ORPHAN_FIELDS.forEach((f) => {
      if (f.required && !(form[f.key] as string)?.trim()) {
        errs[f.key as string] = t('admission.error_field_required', '{field} is required for orphan admission.').replace('{field}', fieldLabel(f));
      }
    });
    return errs;
  };

  const goNext = async () => {
    let errs: FieldErrors = {};
    if (step.key === 'basic') errs = validateBasic();
    if (step.key === 'photo' && !photo) {
      setPhotoError(t('admission.error_photo_required', 'A profile picture is required.'));
      return;
    }
    if (step.key === 'signature' && !signatureEmpty && signaturePadRef.current) {
      try {
        const uri = await signaturePadRef.current.capture();
        setSignature({ uri, fileName: 'signature.png', type: 'image/png' });
      } catch {
        // Best-effort - admission can proceed without a signature image.
      }
    }
    if (step.key === 'class') errs = validateClass();
    if (step.key === 'orphan') errs = validateOrphan();

    const cleaned = Object.fromEntries(Object.entries(errs).filter(([, v]) => v));
    if (Object.keys(cleaned).length > 0) {
      setFieldErrors(cleaned);
      return;
    }
    setFieldErrors({});

    if (isLastStep) {
      onSubmit();
      return;
    }
    setStepIndex((i) => i + 1);
  };

  const goBack = () => {
    if (stepIndex === 0) {
      (navigation as any).goBack();
      return;
    }
    setStepIndex((i) => i - 1);
  };

  const onSubmit = async () => {
    if (!token) {
      setSubmitError(t('admission.error_session_expired', 'Your session expired. Please log in again.'));
      return;
    }
    if (!photo) {
      setPhotoError(t('admission.error_photo_required', 'A profile picture is required.'));
      setStepIndex(steps.findIndex((s) => s.key === 'photo'));
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    try {
      const student = await admitStudent(token, form, photo, signature);
      const name = student?.name ?? form.name;
      resetForm();
      setAdmittedName(name);
    } catch (err: any) {
      setSubmitError(err?.message ?? t('admission.error_generic', 'Something went wrong. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const admitAnother = () => {
    setAdmittedName(null);
  };

  const viewStudent = () => {
    const name = admittedName;
    setAdmittedName(null);
    (navigation as any).navigate('StudentsList', { initialSearch: name ?? '' });
  };

  const renderStepBody = () => {
    switch (step.key) {
      case 'basic':
        return (
          <>
            {BASE_FIELDS.map((f) => {
              const requiredWhenOrphan = !!f.requiredWhenOrphan;
              const required = !!f.required || (requiredWhenOrphan && isOrphanSchool);
              return (
                <FormField
                  key={f.key}
                  label={fieldLabel(f)}
                  value={(form[f.key] as string) ?? ''}
                  onChangeText={(value) => set(f.key, value)}
                  required={required}
                  error={fieldErrors[f.key]}
                  keyboardType={f.keyboard ?? 'default'}
                  secure={f.secure}
                  autoCapitalize={f.key === 'email' || f.secure ? 'none' : 'words'}
                />
              );
            })}

            <View style={styles.wrap}>
              <Text style={styles.helperText}>
                {t('admission.student_code_auto_note', 'A student code will be assigned automatically, based on your Student & Staff Codes setup.')}
              </Text>
            </View>
          </>
        );

      case 'photo':
        return (
          <PhotoField
            photo={photo}
            onChange={(p) => {
              setPhoto(p);
              if (p) setPhotoError(null);
            }}
            initial={form.name?.trim()?.[0]?.toUpperCase() ?? '?'}
            error={photoError}
            onErrorChange={setPhotoError}
          />
        );

      case 'signature':
        return (
          <SignaturePad
            ref={signaturePadRef}
            onStrokeChange={(isEmpty) => setSignatureEmpty(isEmpty)}
          />
        );

      case 'class':
        return (
          <>
            <ChipGroup
              label={t('admission.class_label', 'Class')}
              options={classes}
              selectedId={form.class_id}
              onSelect={(id) => {
                setForm((prev) => ({ ...prev, class_id: id, section_id: undefined }));
                setFieldErrors((prev) => ({ ...prev, class_id: undefined }));
              }}
              error={fieldErrors.class_id}
              emptyHint={t('admission.class_empty_hint', 'No classes found yet - you can still admit the student and assign a class later.')}
            />
            <ChipGroup
              label={t('admission.section_label', 'Section')}
              options={sections}
              selectedId={form.section_id}
              onSelect={(id) => set('section_id', id)}
              error={fieldErrors.section_id}
              emptyHint={t('admission.section_empty_hint', 'Pick a class first, or continue without one.')}
            />
          </>
        );

      case 'orphan':
        return ORPHAN_FIELDS.map((f) => (
          <FormField
            key={f.key}
            label={fieldLabel(f)}
            value={(form[f.key] as string) ?? ''}
            onChangeText={(value) => set(f.key, value)}
            required={f.required}
            error={fieldErrors[f.key as string]}
            placeholder={fieldPlaceholder(f)}
            multiline={f.multiline}
          />
        ));

      default:
        return null;
    }
  };

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />

      <KeyboardAvoidingView style={styles.flexInner} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
          <BlurView blurType="light" blurAmount={GLASS.blurAmount.strong} reducedTransparencyFallbackColor={GLASS.fillOnLightStrong} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, styles.barTint]} />
          <TouchableOpacity
            onPress={goBack}
            style={styles.backRow}
            disabled={submitting}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ChevronLeft />
            <Text style={styles.backText}>{stepIndex === 0 ? t('common.cancel', 'Cancel') : t('common.back', 'Back')}</Text>
          </TouchableOpacity>
          <Text style={styles.topTitle}>{t('admission.header_title', 'New Admission')}</Text>
          <View style={{ width: 64 }} />
        </View>

        <View style={styles.stepperWrap}>
          <BlurView blurType="light" blurAmount={GLASS.blurAmount.subtle} reducedTransparencyFallbackColor={GLASS.fillOnLightStrong} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, styles.barTint]} />
          <Stepper steps={steps as StepDef[]} activeIndex={stepIndex} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Animated.View
            style={{
              opacity: stepAnim,
              transform: [
                {
                  translateY: stepAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }),
                },
              ],
            }}
          >
            <GlassCard surface="light" radius={RADIUS.xl} intensity={GLASS.blurAmount.md} style={styles.cardOuter}>
              <Text style={styles.cardTitle}>{step.title}</Text>
              <Text style={styles.cardSubtitle}>{step.subtitle}</Text>
              <View>{renderStepBody()}</View>
            </GlassCard>

            {submitError ? (
              <View style={styles.submitErrorBox}>
                <Text style={styles.submitErrorText}>{submitError}</Text>
              </View>
            ) : null}
          </Animated.View>
        </ScrollView>

        <View style={styles.buttonRow}>
          <BlurView blurType="light" blurAmount={GLASS.blurAmount.strong} reducedTransparencyFallbackColor={GLASS.fillOnLightStrong} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, styles.barTint]} />
          <TouchableOpacity style={styles.backButton} onPress={goBack} disabled={submitting} activeOpacity={0.85}>
            <Text style={styles.backButtonText}>{stepIndex === 0 ? t('common.cancel', 'Cancel') : t('common.back', 'Back')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, submitting && styles.buttonDisabled]}
            onPress={goNext}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color={md3.color.onPrimary} />
            ) : (
              <Text style={styles.buttonText}>{isLastStep ? t('admission.admit_student', 'Admit Student') : t('common.next', 'Next')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <AdmissionSuccessModal
        visible={!!admittedName}
        studentName={admittedName ?? ''}
        onViewStudent={viewStudent}
        onAdmitAnother={admitAnother}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#EFF7F1' },
  flexInner: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    paddingHorizontal: 16,
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: md3.color.outlineVariant,
  },
  barTint: { backgroundColor: GLASS.fillOnLightStrong },
  backRow: { flexDirection: 'row', alignItems: 'center', width: 64 },
  backText: { color: md3.color.primary, fontSize: 15, fontWeight: '600', marginLeft: 2 },
  topTitle: {
    fontSize: md3.type.titleMedium.fontSize,
    fontWeight: md3.type.titleMedium.fontWeight,
    color: md3.color.onSurface,
  },

  stepperWrap: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: md3.color.outlineVariant,
  },

  content: { padding: 16, paddingBottom: 24 },
  cardOuter: {},
  cardTitle: {
    fontSize: md3.type.titleLarge.fontSize,
    fontWeight: md3.type.titleLarge.fontWeight,
    color: md3.color.onSurface,
  },
  cardSubtitle: {
    fontSize: md3.type.bodyMedium.fontSize,
    color: md3.color.onSurfaceVariant,
    marginTop: 4,
    marginBottom: 20,
    lineHeight: 18,
  },

  wrap: { marginBottom: 18 },
  label: {
    fontSize: md3.type.labelMedium.fontSize,
    fontWeight: md3.type.labelMedium.fontWeight,
    color: md3.color.onSurfaceVariant,
    marginBottom: 6,
  },
  helperText: {
    fontSize: md3.type.bodyMedium.fontSize,
    color: md3.color.onSurfaceVariant,
    marginTop: 6,
    marginLeft: 2,
    lineHeight: 17,
  },
  submitErrorBox: {
    backgroundColor: md3.color.errorContainer,
    borderRadius: md3.shape.md,
    padding: 14,
    marginTop: 14,
  },
  submitErrorText: { color: md3.color.onErrorContainer, fontSize: 13.5, fontWeight: '600', lineHeight: 19 },

  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderTopColor: md3.color.outlineVariant,
  },
  backButton: {
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderRadius: md3.shape.full,
    backgroundColor: md3.color.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: md3.color.outlineVariant,
  },
  backButtonText: { color: md3.color.onSurfaceVariant, fontSize: 15, fontWeight: '700' },
  button: {
    flex: 1,
    backgroundColor: md3.color.primary,
    borderRadius: md3.shape.full,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...md3.elevation.glow,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: md3.color.onPrimary, fontSize: 16, fontWeight: '700' },
});
