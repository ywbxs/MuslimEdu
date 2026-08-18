import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import KeyboardAwareModal from '../components/KeyboardAwareModal';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import Svg, { Path, Circle } from 'react-native-svg';
import { Camera, ChevronLeft, IdCard, Images, ScanFace, School, X } from 'lucide-react-native';
import { useLocale } from '../context/LocaleContext';
import { BRAND, COLORS, RADIUS, SHADOW } from '../theme/glass';
import GlassBackground from '../components/glass/GlassBackground';
import BentoOptionGrid, { BentoOption } from '../components/glass/BentoOptionGrid';
import { useAcademicGlassTheme } from './teachers/academicGlassTheme';
import { preparePostPhoto, InvalidPhotoTypeError } from '../utils/imagePrep';
import { submitSchoolRegistration, SchoolRegistrationInput } from '../services/schoolRegistrationService';
import {
  WizardGradientButton as GradientButton,
  WizardStepHeader,
  WizardFieldLabel as FieldLabel,
  CheckCircleIcon,
  form,
} from '../components/wizard/WizardKit';

const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const BORDER = COLORS.border;

type InstitutionType = 'mahad' | 'madrasa' | 'markaz' | 'regular_school' | 'orphanage';

interface InstitutionOption extends BentoOption {
  type: InstitutionType;
}

const INSTITUTION_OPTIONS: InstitutionOption[] = [
  { id: 1, type: 'mahad', name: 'Mahad' },
  { id: 2, type: 'madrasa', name: 'Madrasa' },
  { id: 3, type: 'markaz', name: 'Markaz' },
  { id: 4, type: 'regular_school', name: 'Regular School' },
  { id: 5, type: 'orphanage', name: 'Orphan School' },
];

// Every type except "orphanage" gets the same full academic toolkit -
// classes, gradebook, exams, fees, enrollment (see ACADEMIC_ROUTES /
// isOrphanSchoolUser in utils/orphanSchool.ts, the actual source of truth
// this list has to stay honest to). Markaz is the one exception that adds
// something on top (Quran/Hifz tracking is gated to markaz only - see
// isQuranTrackingSchoolUser). Orphan School swaps the whole academic
// module out for orphan-care features instead - it has no class-based
// curriculum at all.
const STANDARD_ACADEMIC_FEATURES = [
  'Classes, attendance & gradebook',
  'Exams, grading & report cards',
  'Fee collection & student enrollment',
];
const INSTITUTION_META: Record<InstitutionType, { tagline: string; features: string[] }> = {
  mahad: {
    tagline: 'Islamic seminary or full-time program',
    features: STANDARD_ACADEMIC_FEATURES,
  },
  madrasa: {
    tagline: 'Part-time or weekend Islamic school',
    features: STANDARD_ACADEMIC_FEATURES,
  },
  markaz: {
    tagline: 'Community learning center',
    features: [...STANDARD_ACADEMIC_FEATURES, 'Quran memorization (Hifz) tracking'],
  },
  regular_school: {
    tagline: 'Full curriculum school',
    features: STANDARD_ACADEMIC_FEATURES,
  },
  orphanage: {
    tagline: 'Orphan care institution - no class-based curriculum',
    features: ['Orphan child profiles & care records', 'Monthly progress reports from teachers & admin', 'Sponsorship & donor management'],
  },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STEP_LABELS = ['Type', 'School', 'Admin', 'Verify', 'Review'];

const PASSWORD_RULES: { key: string; label: string; test: (pw: string) => boolean }[] = [
  { key: 'length', label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
  { key: 'upper', label: 'One uppercase letter (A-Z)', test: (pw) => /[A-Z]/.test(pw) },
  { key: 'lower', label: 'One lowercase letter (a-z)', test: (pw) => /[a-z]/.test(pw) },
  { key: 'number', label: 'One number (0-9)', test: (pw) => /[0-9]/.test(pw) },
  { key: 'special', label: 'One special character (!@#$...)', test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];
const isPasswordStrong = (pw: string) => PASSWORD_RULES.every((rule) => rule.test(pw));

interface PickedPhoto {
  uri: string;
  fileName: string;
  type: string;
}

/* ========================= ICONS ========================= */

function BackIcon() {
  return <ChevronLeft size={22} color={INK} strokeWidth={2.1} />;
}
function SchoolTypeIcon({ color }: { color: string }) {
  return <School size={20} color={color} strokeWidth={2} />;
}
function IdCardIcon({ color = BRAND.emerald, size = 34 }: { color?: string; size?: number }) {
  return <IdCard size={size} color={color} strokeWidth={1.8} />;
}
function FaceIcon({ color = BRAND.emerald, size = 34 }: { color?: string; size?: number }) {
  return <ScanFace size={size} color={color} strokeWidth={1.8} />;
}
function CameraSmallIcon({ color = '#FFFFFF', size = 16 }: { color?: string; size?: number }) {
  return <Camera size={size} color={color} strokeWidth={2} />;
}
function CloseIcon({ color = SUBTLE, size = 16 }: { color?: string; size?: number }) {
  return <X size={size} color={color} strokeWidth={2.2} />;
}
function CameraSourceIcon({ color = BRAND.emerald, size = 20 }: { color?: string; size?: number }) {
  return <Camera size={size} color={color} strokeWidth={1.8} />;
}
function LibrarySourceIcon({ color = BRAND.emerald, size = 20 }: { color?: string; size?: number }) {
  return <Images size={size} color={color} strokeWidth={1.8} />;
}
function FeatureCheckIcon({ color = BRAND.emerald, size = 14 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} fill={color} opacity={0.14} />
      <Path d="M7.5 12.5l3 3 6-6.5" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
// Filled check for "met", plain outline ring for "not yet met" - met/unmet
// need to read apart by shape too, not just color, so it still works for
// colorblind users glancing at the checklist.
function RuleStatusIcon({ met, size = 14 }: { met: boolean; size?: number }) {
  if (met) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={12} r={11} fill={BRAND.emeraldDeep} />
        <Path d="M7.5 12.5l3 3 6-6.5" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10.5} stroke={BORDER} strokeWidth={1.5} fill="none" />
    </Svg>
  );
}

function PasswordStrengthChecklist({ password }: { password: string }) {
  if (!password) return null;
  return (
    <View style={strength.list}>
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password);
        return (
          <View key={rule.key} style={strength.row}>
            <RuleStatusIcon met={met} />
            <Text style={[strength.ruleText, met && strength.ruleTextMet]}>{rule.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

/**
 * Feature-reveal card shown under the institution-type grid - the whole
 * point is to answer "what do I actually get" right where the choice is
 * made, instead of leaving it to be discovered later. Re-plays its
 * fade/slide-in every time `type` changes (not a one-shot animation) so
 * switching between tiles keeps feeling responsive rather than static
 * after the first pick.
 */
function InstitutionFeaturePreview({ type }: { type: InstitutionType | null }) {
  const { t } = useLocale();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    if (!type) return;
    opacity.setValue(0);
    translateY.setValue(10);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 240, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 240, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [type, opacity, translateY]);

  if (!type) {
    return (
      <View style={preview.hintCard}>
        <Text style={preview.hintText}>
          {t('school_registration.type_hint', 'Pick an institution type above to see what it comes with.')}
        </Text>
      </View>
    );
  }

  const meta = INSTITUTION_META[type];

  return (
    <Animated.View style={[preview.card, { opacity, transform: [{ translateY }] }]}>
      <Text style={preview.tagline}>{t(`school_registration.tagline_${type}`, meta.tagline)}</Text>
      <Text style={preview.title}>{t('school_registration.features_title', "What you'll get")}</Text>
      {meta.features.map((feature, i) => (
        <View key={feature} style={preview.row}>
          <FeatureCheckIcon />
          <Text style={preview.rowText}>{t(`school_registration.feature_${type}_${i}`, feature)}</Text>
        </View>
      ))}
    </Animated.View>
  );
}

/* ========================= MAIN SCREEN ========================= */

export default function SchoolRegistrationScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t } = useLocale();
  const theme = useAcademicGlassTheme('emerald');

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [submitted, setSubmitted] = useState(false);

  // Step 1 - Institution type
  const [institutionTypeId, setInstitutionTypeId] = useState<number | null>(null);

  // Step 2 - School info
  const [schoolName, setSchoolName] = useState('');
  const [schoolAddress, setSchoolAddress] = useState('');
  const [schoolEmail, setSchoolEmail] = useState('');
  const [schoolPhone, setSchoolPhone] = useState('');

  // Step 3 - Admin info
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Step 4 - Verification
  const [idDocument, setIdDocument] = useState<PickedPhoto | null>(null);
  const [selfie, setSelfie] = useState<PickedPhoto | null>(null);
  const [pickingId, setPickingId] = useState(false);
  const [pickingSelfie, setPickingSelfie] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [idSourceSheetVisible, setIdSourceSheetVisible] = useState(false);

  const institutionType = INSTITUTION_OPTIONS.find((o) => o.id === institutionTypeId)?.type ?? null;

  const step1Valid = institutionType !== null;
  const step2Valid = schoolName.trim().length > 0;
  const step3Valid =
    adminName.trim().length > 0 &&
    EMAIL_RE.test(adminEmail.trim()) &&
    isPasswordStrong(password) &&
    password === confirmPassword;
  const step4Valid = !!idDocument && !!selfie;

  const pickIdDocument = () => setIdSourceSheetVisible(true);

  const chooseIdSource = (source: 'camera' | 'library') => {
    setIdSourceSheetVisible(false);
    capturePhoto('id', source);
  };

  const capturePhoto = async (target: 'id' | 'selfie', source: 'camera' | 'library') => {
    const setPicking = target === 'id' ? setPickingId : setPickingSelfie;
    setPicking(true);
    try {
      const result =
        source === 'camera'
          ? await launchCamera({ mediaType: 'photo', quality: 0.9, cameraType: target === 'selfie' ? 'front' : 'back', saveToPhotos: false })
          : await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1, quality: 0.9 });
      const asset = result.assets?.[0];
      if (result.didCancel || result.errorCode || !asset?.uri) return;

      const prepared = await preparePostPhoto(asset.uri, asset.fileName, asset.type, asset.fileSize);
      const photo: PickedPhoto = { uri: prepared.uri, fileName: prepared.fileName, type: prepared.type };
      if (target === 'id') setIdDocument(photo);
      else setSelfie(photo);
    } catch (err) {
      if (err instanceof InvalidPhotoTypeError) {
        Alert.alert(t('create_post.unsupported_photo', 'Unsupported photo'), err.message);
      }
    } finally {
      setPicking(false);
    }
  };

  // Face verification is always a fresh camera capture, front-facing, no
  // gallery option - a live photo taken right now is the whole point of
  // this step, not a picture of a picture.
  const captureSelfie = () => capturePhoto('selfie', 'camera');

  const goNext = () => setStep((s) => (Math.min(5, s + 1) as 1 | 2 | 3 | 4 | 5));
  const goBackStep = () => setStep((s) => (Math.max(1, s - 1) as 1 | 2 | 3 | 4 | 5));

  const submit = async () => {
    if (!institutionType || !idDocument || !selfie || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const input: SchoolRegistrationInput = {
        schoolName: schoolName.trim(),
        institutionType,
        schoolAddress: schoolAddress.trim() || undefined,
        schoolEmail: schoolEmail.trim() || undefined,
        schoolPhone: schoolPhone.trim() || undefined,
        adminName: adminName.trim(),
        adminEmail: adminEmail.trim(),
        adminPhone: adminPhone.trim() || undefined,
        password,
        idDocument,
        selfie,
      };
      await submitSchoolRegistration(input);
      setSubmitted(true);
    } catch (err: any) {
      setSubmitError(err?.message ?? t('common.try_again_full', 'Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <View style={styles.flex}>
        <GlassBackground variant="canvas" />
        <View style={[styles.successWrap, { paddingTop: insets.top + 40 }]}>
          <CheckCircleIcon size={80} />
          <Text style={styles.successTitle}>{t('school_registration.pending_title', 'Application submitted')}</Text>
          <Text style={styles.successBody}>
            {t(
              'school_registration.pending_body',
              "Your school and admin account are pending review. You'll be able to sign in once a superadmin approves your application - this is usually quick, but can take a little while.",
            )}
          </Text>
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingBadgeText}>{t('school_registration.pending_badge', 'Status: Pending Approval')}</Text>
          </View>
          <GradientButton label={t('school_registration.back_to_login', 'Back to Login')} onPress={() => navigation.goBack()} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => (step === 1 ? navigation.goBack() : goBackStep())} hitSlop={10}>
          <BackIcon />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t('school_registration.title', 'Register Your School')}</Text>
          <Text style={styles.headerSubtitle}>{t('school_registration.subtitle', 'A few steps to get your institution set up')}</Text>
        </View>
      </View>

      <WizardStepHeader step={step} labels={STEP_LABELS} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={100}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {step === 1 && (
            <>
              <BentoOptionGrid
                label={t('school_registration.institution_type', 'Institution Type') + ' *'}
                options={INSTITUTION_OPTIONS}
                value={institutionTypeId}
                onChange={setInstitutionTypeId}
                icon={(_, color) => <SchoolTypeIcon color={color} />}
                theme={theme}
              />

              <InstitutionFeaturePreview type={institutionType} />
            </>
          )}

          {step === 2 && (
            <>
              <FieldLabel required>{t('school_registration.school_name', 'School Name')}</FieldLabel>
              <TextInput
                style={form.input}
                value={schoolName}
                onChangeText={setSchoolName}
                placeholder={t('school_registration.school_name_placeholder', "e.g. Al-Noor Islamic Academy")}
                placeholderTextColor={SUBTLE}
              />

              <FieldLabel>{t('school_registration.school_address', 'Address')}</FieldLabel>
              <TextInput
                style={[form.input, form.inputMultiline]}
                value={schoolAddress}
                onChangeText={setSchoolAddress}
                placeholder={t('school_registration.school_address_placeholder', 'Street, city, country')}
                placeholderTextColor={SUBTLE}
                multiline
              />

              <FieldLabel>{t('school_registration.school_email', 'School Email')}</FieldLabel>
              <TextInput
                style={form.input}
                value={schoolEmail}
                onChangeText={setSchoolEmail}
                placeholder="school@example.com"
                placeholderTextColor={SUBTLE}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <FieldLabel>{t('school_registration.school_phone', 'School Phone')}</FieldLabel>
              <TextInput
                style={form.input}
                value={schoolPhone}
                onChangeText={setSchoolPhone}
                placeholder="+63 912 345 6789"
                placeholderTextColor={SUBTLE}
                keyboardType="phone-pad"
              />
            </>
          )}

          {step === 3 && (
            <>
              <FieldLabel required>{t('school_registration.admin_name', 'Your Full Name')}</FieldLabel>
              <TextInput
                style={form.input}
                value={adminName}
                onChangeText={setAdminName}
                placeholder={t('school_registration.admin_name_placeholder', 'As it appears on your ID')}
                placeholderTextColor={SUBTLE}
              />

              <FieldLabel required>{t('school_registration.admin_email', 'Your Email')}</FieldLabel>
              <TextInput
                style={form.input}
                value={adminEmail}
                onChangeText={setAdminEmail}
                placeholder="you@example.com"
                placeholderTextColor={SUBTLE}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {adminEmail.trim().length > 0 ? (
                EMAIL_RE.test(adminEmail.trim()) ? (
                  <View style={emailCheck.row}>
                    <RuleStatusIcon met />
                    <Text style={emailCheck.validText}>{t('school_registration.email_valid', 'Looks good')}</Text>
                  </View>
                ) : (
                  <Text style={form.errorText}>
                    {t('school_registration.email_invalid', 'Enter a valid email address, e.g. name@example.com')}
                  </Text>
                )
              ) : null}

              <FieldLabel>{t('school_registration.admin_phone', 'Your Phone')}</FieldLabel>
              <TextInput
                style={form.input}
                value={adminPhone}
                onChangeText={setAdminPhone}
                placeholder="+63 912 345 6789"
                placeholderTextColor={SUBTLE}
                keyboardType="phone-pad"
              />

              <FieldLabel required>{t('school_registration.password', 'Password')}</FieldLabel>
              <TextInput
                style={form.input}
                value={password}
                onChangeText={setPassword}
                placeholder={t('school_registration.password_placeholder', 'Create a strong password')}
                placeholderTextColor={SUBTLE}
                secureTextEntry
              />
              <PasswordStrengthChecklist password={password} />

              <FieldLabel required>{t('school_registration.confirm_password', 'Confirm Password')}</FieldLabel>
              <TextInput
                style={form.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder={t('school_registration.confirm_password_placeholder', 'Re-enter your password')}
                placeholderTextColor={SUBTLE}
                secureTextEntry
              />
              {confirmPassword.length > 0 && password !== confirmPassword ? (
                <Text style={form.errorText}>{t('school_registration.password_mismatch', "Passwords don't match.")}</Text>
              ) : null}
            </>
          )}

          {step === 4 && (
            <>
              <Text style={verify.intro}>
                {t(
                  'school_registration.verify_intro',
                  "Last step - we verify every new admin so schools on MuslimEdu are run by real people. Upload a valid ID, then take a quick selfie to match against it.",
                )}
              </Text>

              <Text style={verify.sectionTitle}>{t('school_registration.id_title', '1. Valid ID')}</Text>
              <TouchableOpacity style={verify.uploadCard} activeOpacity={0.85} onPress={pickIdDocument} disabled={pickingId}>
                {pickingId ? (
                  <ActivityIndicator color={BRAND.emerald} />
                ) : idDocument ? (
                  <>
                    <Image source={{ uri: idDocument.uri }} style={verify.previewImage} resizeMode="cover" />
                    <View style={verify.retakeBadge}>
                      <CameraSmallIcon />
                      <Text style={verify.retakeBadgeText}>{t('school_registration.retake', 'Retake')}</Text>
                    </View>
                  </>
                ) : (
                  <>
                    <IdCardIcon />
                    <Text style={verify.uploadCardTitle}>{t('school_registration.id_upload_title', 'Upload your ID')}</Text>
                    <Text style={verify.uploadCardHint}>{t('school_registration.id_upload_hint', 'Passport, national ID, or driver’s license')}</Text>
                  </>
                )}
              </TouchableOpacity>

              <Text style={verify.sectionTitle}>{t('school_registration.face_title', '2. Face Verification')}</Text>
              <TouchableOpacity style={verify.uploadCard} activeOpacity={0.85} onPress={captureSelfie} disabled={pickingSelfie}>
                {pickingSelfie ? (
                  <ActivityIndicator color={BRAND.emerald} />
                ) : selfie ? (
                  <>
                    <Image source={{ uri: selfie.uri }} style={verify.previewImage} resizeMode="cover" />
                    <View style={verify.retakeBadge}>
                      <CameraSmallIcon />
                      <Text style={verify.retakeBadgeText}>{t('school_registration.retake', 'Retake')}</Text>
                    </View>
                  </>
                ) : (
                  <>
                    <FaceIcon />
                    <Text style={verify.uploadCardTitle}>{t('school_registration.face_capture_title', 'Take a live selfie')}</Text>
                    <Text style={verify.uploadCardHint}>{t('school_registration.face_capture_hint', 'Camera only - look straight ahead in good lighting')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}

          {step === 5 && (
            <>
              <Text style={verify.sectionTitle}>{t('school_registration.review_school', 'School')}</Text>
              <View style={review.card}>
                <ReviewRow label={t('school_registration.school_name', 'School Name')} value={schoolName} />
                <ReviewRow
                  label={t('school_registration.institution_type', 'Institution Type')}
                  value={INSTITUTION_OPTIONS.find((o) => o.id === institutionTypeId)?.name ?? '—'}
                />
                {!!schoolAddress && <ReviewRow label={t('school_registration.school_address', 'Address')} value={schoolAddress} />}
                {!!schoolEmail && <ReviewRow label={t('school_registration.school_email', 'School Email')} value={schoolEmail} />}
                {!!schoolPhone && <ReviewRow label={t('school_registration.school_phone', 'School Phone')} value={schoolPhone} />}
              </View>

              <Text style={verify.sectionTitle}>{t('school_registration.review_admin', 'Admin')}</Text>
              <View style={review.card}>
                <ReviewRow label={t('school_registration.admin_name', 'Your Full Name')} value={adminName} />
                <ReviewRow label={t('school_registration.admin_email', 'Your Email')} value={adminEmail} />
                {!!adminPhone && <ReviewRow label={t('school_registration.admin_phone', 'Your Phone')} value={adminPhone} />}
              </View>

              <Text style={verify.sectionTitle}>{t('school_registration.review_verification', 'Verification')}</Text>
              <View style={review.thumbRow}>
                {idDocument && <Image source={{ uri: idDocument.uri }} style={review.thumb} />}
                {selfie && <Image source={{ uri: selfie.uri }} style={review.thumb} />}
              </View>

              {submitError ? <Text style={form.errorText}>{submitError}</Text> : null}
            </>
          )}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          {step < 5 ? (
            <GradientButton
              label={t('school_registration.next', 'Next')}
              onPress={goNext}
              disabled={step === 1 ? !step1Valid : step === 2 ? !step2Valid : step === 3 ? !step3Valid : !step4Valid}
            />
          ) : (
            <GradientButton label={t('school_registration.submit', 'Submit Application')} onPress={submit} loading={submitting} />
          )}
        </View>
      </KeyboardAvoidingView>

      <KeyboardAwareModal visible={idSourceSheetVisible} transparent animationType="slide" onRequestClose={() => setIdSourceSheetVisible(false)}>
        <View style={sheet.backdrop}>
          <TouchableOpacity style={sheet.backdropTouch} activeOpacity={1} onPress={() => setIdSourceSheetVisible(false)} />
          <View style={[sheet.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={sheet.handle} />
            <View style={sheet.headerRow}>
              <Text style={sheet.title}>{t('school_registration.id_source_title', 'Upload ID')}</Text>
              <TouchableOpacity onPress={() => setIdSourceSheetVisible(false)} hitSlop={12} style={sheet.closeBtn}>
                <CloseIcon />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={sheet.row} activeOpacity={0.7} onPress={() => chooseIdSource('camera')}>
              <View style={sheet.iconWrap}>
                <CameraSourceIcon />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={sheet.rowLabel}>{t('school_registration.take_photo', 'Take Photo')}</Text>
                <Text style={sheet.rowDesc}>{t('school_registration.take_photo_desc', 'Use your camera right now')}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={sheet.row} activeOpacity={0.7} onPress={() => chooseIdSource('library')}>
              <View style={sheet.iconWrap}>
                <LibrarySourceIcon />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={sheet.rowLabel}>{t('school_registration.choose_library', 'Choose from Library')}</Text>
                <Text style={sheet.rowDesc}>{t('school_registration.choose_library_desc', 'Pick an existing photo')}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAwareModal>
    </View>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={review.row}>
      <Text style={review.rowLabel}>{label}</Text>
      <Text style={review.rowValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

/* ========================= STYLES ========================= */

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.canvas },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 8 },
  backBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  headerTitle: { fontSize: 19, fontWeight: '800', color: INK },
  headerSubtitle: { fontSize: 12.5, color: SUBTLE, marginTop: 2 },

  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  footer: { paddingHorizontal: 20, paddingTop: 10, borderTopWidth: 1, borderTopColor: BORDER, backgroundColor: COLORS.surface },

  successWrap: { flex: 1, alignItems: 'center', paddingHorizontal: 32 },
  successTitle: { fontSize: 21, fontWeight: '800', color: INK, marginTop: 20, textAlign: 'center' },
  successBody: { fontSize: 14, color: SUBTLE, textAlign: 'center', marginTop: 12, lineHeight: 21 },
  pendingBadge: { backgroundColor: COLORS.emeraldSoft, borderRadius: RADIUS.pill, paddingHorizontal: 16, paddingVertical: 9, marginTop: 20, marginBottom: 32 },
  pendingBadgeText: { color: BRAND.emeraldDeep, fontWeight: '700', fontSize: 13 },
});

const verify = StyleSheet.create({
  intro: { fontSize: 13.5, color: SUBTLE, lineHeight: 20, marginBottom: 16 },
  sectionTitle: { fontSize: 13.5, fontWeight: '700', color: INK, marginTop: 16, marginBottom: 10 },
  uploadCard: {
    borderWidth: 1.5,
    borderColor: BORDER,
    borderStyle: 'dashed',
    borderRadius: RADIUS.lg,
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
    padding: 16,
  },
  uploadCardTitle: { fontSize: 14.5, fontWeight: '700', color: INK, marginTop: 10 },
  uploadCardHint: { fontSize: 12, color: SUBTLE, marginTop: 4, textAlign: 'center' },
  previewImage: { width: '100%', height: 160 },
  retakeBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: RADIUS.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  retakeBadgeText: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '700' },
});

const strength = StyleSheet.create({
  list: { marginTop: 10, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ruleText: { fontSize: 12.5, color: SUBTLE },
  ruleTextMet: { color: INK, fontWeight: '600' },
});

const emailCheck = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  validText: { fontSize: 12.5, color: BRAND.emeraldDeep, fontWeight: '600' },
});

const preview = StyleSheet.create({
  hintCard: {
    borderWidth: 1.5,
    borderColor: BORDER,
    borderStyle: 'dashed',
    borderRadius: RADIUS.lg,
    padding: 16,
    marginTop: 16,
  },
  hintText: { fontSize: 13, color: SUBTLE, textAlign: 'center', lineHeight: 19 },
  card: {
    backgroundColor: COLORS.emeraldSoft,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(31,174,100,0.25)',
    padding: 16,
    marginTop: 16,
  },
  tagline: { fontSize: 12.5, fontWeight: '600', color: BRAND.emeraldDeep, marginBottom: 8 },
  title: { fontSize: 13.5, fontWeight: '800', color: INK, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  rowText: { flex: 1, fontSize: 13, color: INK, lineHeight: 18 },
});

const sheet = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(17,20,23,0.4)', justifyContent: 'flex-end' },
  backdropTouch: { flex: 1 },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#DADDE1', alignSelf: 'center', marginBottom: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  title: { fontSize: 17, fontWeight: '800', color: INK },
  closeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.canvas, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderTopWidth: 1, borderTopColor: BORDER },
  iconWrap: { width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.emeraldSoft, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 15, fontWeight: '700', color: INK },
  rowDesc: { fontSize: 12, color: SUBTLE, marginTop: 2 },
});

const review = StyleSheet.create({
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: BORDER, padding: 14, ...SHADOW.level1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, gap: 12 },
  rowLabel: { fontSize: 12.5, color: SUBTLE, flexShrink: 0 },
  rowValue: { fontSize: 13, color: INK, fontWeight: '600', flex: 1, textAlign: 'right' },
  thumbRow: { flexDirection: 'row', gap: 12 },
  thumb: { width: 100, height: 100, borderRadius: RADIUS.sm, backgroundColor: '#EDEFF2' },
});
