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
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
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
// are ID pickers, gender/birthday get their own dedicated pickers, and the
// photo/signature are their own steps - all handled separately below. Every
// field here is required - a student's record shouldn't have gaps.
const BASE_FIELDS: {
  key: keyof AdmissionInput;
  label: string;
  required?: boolean;
  keyboard?: 'default' | 'email-address' | 'phone-pad';
  secure?: boolean;
}[] = [
  { key: 'name', label: 'Full name', required: true },
  { key: 'name_ar', label: 'Arabic name', required: true },
  { key: 'email', label: 'Email', keyboard: 'email-address', required: true },
  { key: 'password', label: 'Password', required: true, secure: true },
  { key: 'phone', label: 'Phone', keyboard: 'phone-pad', required: true },
  { key: 'address', label: 'Address', required: true },
  { key: 'emergency_contact_name', label: 'Emergency contact name', required: true },
  { key: 'emergency_contact_phone', label: 'Emergency contact phone', keyboard: 'phone-pad', required: true },
];

const GENDER_OPTIONS = [
  { id: 'male', name: 'Male' },
  { id: 'female', name: 'Female' },
];

// Same format check SchoolRegistrationScreen's admin-email field already
// uses - not a full RFC 5322 validator, just enough to catch "missing @",
// "missing domain" typos before they hit the backend.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

// Basic Info used to be one lump step with all 10 of these fields on it at
// once - split into one field per step (Typeform-style) so the wizard reads
// as ten short, focused screens (1-10) instead of one long form buried
// behind a single "Basic Info" step.
type BasicStepKey =
  | 'name' | 'name_ar' | 'email' | 'password' | 'phone' | 'address'
  | 'emergency_contact_name' | 'emergency_contact_phone' | 'gender' | 'birthday';
const BASIC_STEP_KEY_SET = new Set<BasicStepKey>([
  'name', 'name_ar', 'email', 'password', 'phone', 'address',
  'emergency_contact_name', 'emergency_contact_phone', 'gender', 'birthday',
]);

type StepKey = BasicStepKey | 'photo' | 'signature' | 'class' | 'orphan';
type FieldErrors = Partial<Record<string, string>>;

function parseDateValue(value: string): Date {
  const parsed = value ? new Date(value) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function formatDateValue(date: Date): string {
  return date.toISOString().split('T')[0]; // YYYY-MM-DD - matches what the backend expects
}

// Native date picker for birthday - Android's is a self-dismissing dialog,
// iOS's spinner stays open until "Done" is tapped. Styled with the wizard's
// own md3 tokens so it sits next to FormField/ChipGroup without looking
// like a different component set.
function AdmissionDateField({
  label,
  value,
  onChange,
  required,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  error?: string | null;
}) {
  const [show, setShow] = useState(false);

  const handleChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShow(false);
      if (event.type === 'set' && selectedDate) onChange(formatDateValue(selectedDate));
      return;
    }
    if (selectedDate) onChange(formatDateValue(selectedDate));
  };

  return (
    <View style={dateFieldStyles.wrap}>
      <Text style={[dateFieldStyles.label, error && dateFieldStyles.labelError]}>
        {label}
        {required ? <Text style={dateFieldStyles.required}> *</Text> : null}
      </Text>
      <TouchableOpacity
        style={[dateFieldStyles.inputRow, error && dateFieldStyles.inputRowError]}
        onPress={() => setShow(true)}
        activeOpacity={0.8}
      >
        <Text style={value ? dateFieldStyles.value : dateFieldStyles.placeholder}>
          {value || 'Select date'}
        </Text>
      </TouchableOpacity>
      {show ? (
        <View style={Platform.OS === 'ios' ? dateFieldStyles.iosPickerWrap : undefined}>
          <DateTimePicker
            value={parseDateValue(value)}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            maximumDate={new Date()}
            onChange={handleChange}
          />
          {Platform.OS === 'ios' ? (
            <TouchableOpacity style={dateFieldStyles.iosPickerDone} onPress={() => setShow(false)} activeOpacity={0.85}>
              <Text style={dateFieldStyles.iosPickerDoneText}>Done</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
      {error ? <Text style={dateFieldStyles.errorText}>{error}</Text> : null}
    </View>
  );
}

const dateFieldStyles = StyleSheet.create({
  wrap: { marginBottom: 18 },
  label: {
    fontSize: md3.type.labelMedium.fontSize,
    fontWeight: md3.type.labelMedium.fontWeight,
    color: md3.color.onSurfaceVariant,
    marginBottom: 6,
  },
  labelError: { color: md3.color.error },
  required: { color: md3.color.error },
  inputRow: {
    backgroundColor: md3.color.surfaceContainerLow,
    borderRadius: md3.shape.sm,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: md3.color.outlineVariant,
  },
  inputRowError: { borderColor: md3.color.error, borderWidth: 2 },
  value: { fontSize: md3.type.bodyLarge.fontSize, color: md3.color.onSurface },
  placeholder: { fontSize: md3.type.bodyLarge.fontSize, color: md3.color.onSurfaceVariant },
  iosPickerWrap: { backgroundColor: md3.color.surfaceContainerLowest, borderRadius: md3.shape.sm, marginTop: 8, paddingBottom: 8 },
  iosPickerDone: { alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 6 },
  iosPickerDoneText: { color: md3.color.primary, fontWeight: '700', fontSize: 14 },
  errorText: {
    fontSize: md3.type.bodyMedium.fontSize,
    color: md3.color.error,
    marginTop: 6,
    marginLeft: 2,
  },
});

function CheckIcon({ size = 14 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline
        points="5 13 10 18 19 7"
        stroke={md3.color.primary}
        strokeWidth={3.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

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
    { key: 'name', title: t('admission.field_name', 'Full name'), subtitle: t('admission.step_name_subtitle', "The student's full legal name.") },
    { key: 'name_ar', title: t('admission.field_name_ar', 'Arabic name'), subtitle: t('admission.step_name_ar_subtitle', "The student's name in Arabic.") },
    { key: 'email', title: t('admission.field_email', 'Email'), subtitle: t('admission.step_email_subtitle', 'Used to sign in to the student portal.') },
    { key: 'password', title: t('admission.field_password', 'Password'), subtitle: t('admission.step_password_subtitle', 'At least 6 characters - the student will use this to log in.') },
    { key: 'phone', title: t('admission.field_phone', 'Phone'), subtitle: t('admission.step_phone_subtitle', 'A contact number for the student.') },
    { key: 'address', title: t('admission.field_address', 'Address'), subtitle: t('admission.step_address_subtitle', 'Where the student currently lives.') },
    { key: 'emergency_contact_name', title: t('admission.field_emergency_contact_name', 'Emergency contact name'), subtitle: t('admission.step_emergency_contact_name_subtitle', 'Who to reach in an emergency.') },
    { key: 'emergency_contact_phone', title: t('admission.field_emergency_contact_phone', 'Emergency contact phone'), subtitle: t('admission.step_emergency_contact_phone_subtitle', 'Their phone number.') },
    { key: 'gender', title: t('admission.field_gender', 'Gender'), subtitle: t('admission.step_gender_subtitle', "Select the student's gender.") },
    { key: 'birthday', title: t('admission.field_birthday', 'Birthday'), subtitle: t('admission.step_birthday_subtitle', "The student's date of birth.") },
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

  // One field's worth of validation per basic step, instead of all 10 at
  // once - each step only blocks Next on its own field being wrong.
  const validateBasicStep = (key: BasicStepKey): FieldErrors => {
    const errs: FieldErrors = {};
    const fieldDef = BASE_FIELDS.find((f) => f.key === key);
    if (fieldDef) {
      if (fieldDef.required && !(form[fieldDef.key] as string)?.trim()) {
        errs[fieldDef.key as string] = t('admission.error_field_required', '{field} is required.').replace('{field}', fieldLabel(fieldDef));
      } else if (fieldDef.key === 'email' && form.email?.trim() && !EMAIL_RE.test(form.email.trim())) {
        errs.email = t('admission.error_email_invalid', 'Enter a valid email address, e.g. name@example.com');
      }
      if (fieldDef.key === 'password' && form.password && form.password.length < 6) {
        errs.password = t('admission.error_password_length', 'Use at least 6 characters.');
      }
      return errs;
    }
    if (key === 'gender' && !form.gender) {
      errs.gender = t('admission.error_gender_required', 'Gender is required.');
    }
    if (key === 'birthday' && !form.birthday?.trim()) {
      errs.birthday = t('admission.error_birthday_required', 'Birthday is required.');
    }
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
    if (BASIC_STEP_KEY_SET.has(step.key as BasicStepKey)) errs = validateBasicStep(step.key as BasicStepKey);
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
    if (BASIC_STEP_KEY_SET.has(step.key as BasicStepKey)) {
      if (step.key === 'gender') {
        return (
          <ChipGroup
            label={t('admission.field_gender', 'Gender')}
            options={GENDER_OPTIONS}
            selectedId={form.gender}
            onSelect={(id) => set('gender', id)}
            required
            error={fieldErrors.gender}
          />
        );
      }
      if (step.key === 'birthday') {
        return (
          <>
            <AdmissionDateField
              label={t('admission.field_birthday', 'Birthday')}
              value={form.birthday ?? ''}
              onChange={(v) => set('birthday', v)}
              required
              error={fieldErrors.birthday}
            />
            <View style={styles.wrap}>
              <Text style={styles.helperText}>
                {t('admission.student_code_auto_note', 'A student code will be assigned automatically, based on your Student & Staff Codes setup.')}
              </Text>
            </View>
          </>
        );
      }
      const fieldDef = BASE_FIELDS.find((f) => f.key === step.key)!;
      const emailValue = (form.email ?? '').trim();
      return (
        <>
          <FormField
            label={fieldLabel(fieldDef)}
            value={(form[fieldDef.key] as string) ?? ''}
            onChangeText={(value) => set(fieldDef.key, value)}
            required={fieldDef.required}
            error={fieldErrors[fieldDef.key]}
            keyboardType={fieldDef.keyboard ?? 'default'}
            secure={fieldDef.secure}
            autoCapitalize={fieldDef.key === 'email' || fieldDef.secure ? 'none' : 'words'}
          />
          {/* Live format check as they type, on top of the on-Next required/
              format validation above - same "Looks good" pattern
              SchoolRegistrationScreen's admin-email field already uses, so
              a typo (missing @, missing domain) is obvious immediately
              instead of only surfacing after tapping Next. */}
          {fieldDef.key === 'email' && emailValue.length > 0 && !fieldErrors.email ? (
            EMAIL_RE.test(emailValue) ? (
              <View style={emailCheckStyles.row}>
                <CheckIcon />
                <Text style={emailCheckStyles.validText}>{t('admission.email_valid', 'Looks good')}</Text>
              </View>
            ) : null
          ) : null}
        </>
      );
    }

    switch (step.key) {
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

      <KeyboardAvoidingView style={styles.flexInner} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
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

const emailCheckStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -12 },
  validText: { fontSize: 12.5, color: md3.color.primary, fontWeight: '600' },
});

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
