import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Pencil, Check, Landmark } from 'lucide-react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { useAcademicGlassTheme, AcademicGlassTheme } from '../teachers/academicGlassTheme';
import { RADIUS, BRAND } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';
import { WizardStepHeader } from '../../components/wizard/WizardKit';
import {
  prepareProfilePhoto,
  InvalidPhotoTypeError,
  formatBytes,
  MAX_PHOTO_BYTES,
} from '../../utils/imagePrep';
import {
  fetchSetupStatus,
  saveInstitutionProfile,
  SetupStatus,
  InstitutionType,
  CalendarType,
  AcademicYearStructure,
  ProgramDuration,
} from '../../services/academicSetupService';

/**
 * Admin: spec §3 "Institution profile" — the screen the wizard's own hint
 * text implies should exist ("you can add more academic years and terms
 * later from Academic Setup") but for the profile fields themselves rather
 * than years/terms. The wizard (AcademicSetupWizardScreen) only ever runs
 * once, on first login, and only collects a subset of fields (type, name,
 * Arabic name, address, phone). Everything else — email, timezone,
 * languages, calendar type, working days/hours, academic year structure,
 * logo, seal — has been settable on the backend since session 4
 * (admin_school_profile_update accepts all of it) but had no screen calling
 * it with the rest of the fields, or with files. This is that screen.
 *
 * Reuses fetchSetupStatus/saveInstitutionProfile exactly as the wizard
 * does — same endpoint, same partial-update semantics (every field is
 * optional server-side, so re-saving the full form here is safe and never
 * clobbers a field the form doesn't show).
 *
 * Entry point: a "Profile" header button on AcademicYearsScreen, plus the
 * edit pencil on the admin dashboard's AnalyticsCard school-identity strip.
 *
 * Visual language (redesign): a numbered step-by-step wizard, matching the
 * same stepper/step-card/Back-Continue convention AcademicSetupWizardScreen
 * already uses for first-run onboarding — one focused card per group of
 * fields instead of one long scroll through six stacked sections. Unlike
 * the onboarding wizard, this edits an EXISTING profile, so nothing saves
 * per step; the whole accumulated form only hits the network once, on the
 * final step's "Save Changes" (same onSave/saveInstitutionProfile call as
 * before — layout changed, not the save semantics).
 */

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const DAY_FALLBACKS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const INSTITUTION_TYPE_FALLBACKS: Record<InstitutionType, string> = {
  mahad: 'Mahad',
  madrasa: 'Madrasa',
  markaz: 'Markaz',
  regular_school: 'Regular School',
  orphanage: 'Orphan School',
};

const CALENDAR_TYPE_FALLBACKS: Record<CalendarType, string> = {
  gregorian: 'Gregorian',
  hijri: 'Hijri',
  dual: 'Dual (Hijri + Gregorian)',
};

const YEAR_STRUCTURE_FALLBACKS: Record<AcademicYearStructure, string> = {
  semester: 'Semester',
  trimester: 'Trimester',
  quarter: 'Quarter',
  continuous: 'Continuous',
  custom: 'Custom',
};

const PROGRAM_DURATION_FALLBACKS: Record<ProgramDuration, string> = {
  one_year: 'One Year',
  three_year: 'Three Years',
};

const STEP_KEYS = ['branding', 'basic', 'type', 'localization', 'schedule', 'structure'] as const;
type StepKey = (typeof STEP_KEYS)[number];
const STEP_FALLBACK_LABELS: Record<StepKey, string> = {
  branding: 'Branding',
  basic: 'Basic Info',
  type: 'Type',
  localization: 'Localization',
  schedule: 'Schedule',
  structure: 'Structure',
};

interface PendingPhoto {
  uri: string;
  fileName: string;
  type: string;
  size: number;
  wasCompressed: boolean;
}

function IconChevronLeft({ color }: { color: string }) {
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}
function IconPencil({ color, size = 14 }: { color: string; size?: number }) {
  return <Pencil size={size} color={color} strokeWidth={2.2} />;
}
function IconCheck({ color, size = 13 }: { color: string; size?: number }) {
  return <Check size={size} color={color} strokeWidth={3} />;
}
function IconLandmark({ color }: { color: string }) {
  return <Landmark size={26} color={color} strokeWidth={1.8} />;
}

export default function InstitutionProfileScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const theme = useAcademicGlassTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { token } = useAuth();
  const { t } = useLocale();
  const institutionTypeLabel = (type: InstitutionType) => t(`institution_profile.type_${type}`, INSTITUTION_TYPE_FALLBACKS[type]);
  const calendarTypeLabel = (type: CalendarType) => t(`institution_profile.calendar_${type}`, CALENDAR_TYPE_FALLBACKS[type]);
  const yearStructureLabel = (s: AcademicYearStructure) => t(`institution_profile.year_structure_${s}`, YEAR_STRUCTURE_FALLBACKS[s]);
  const programDurationLabel = (d: ProgramDuration) => t(`institution_profile.program_duration_${d}`, PROGRAM_DURATION_FALLBACKS[d]);
  const dayLabel = (i: number) => t(`institution_profile.day_${DAY_KEYS[i]}`, DAY_FALLBACKS[i]);
  const stepLabel = (key: StepKey) => t(`institution_profile.step_${key}`, STEP_FALLBACK_LABELS[key]);

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [pickingField, setPickingField] = useState<'logo' | 'seal' | null>(null);
  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);

  // Fields
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [institutionType, setInstitutionType] = useState<InstitutionType | null>(null);
  const [timezone, setTimezone] = useState('');
  const [defaultLanguage, setDefaultLanguage] = useState('');
  const [secondaryLanguage, setSecondaryLanguage] = useState('');
  const [calendarType, setCalendarType] = useState<CalendarType | null>(null);
  const [workingDays, setWorkingDays] = useState<number[]>([]);
  const [hoursStart, setHoursStart] = useState('');
  const [hoursEnd, setHoursEnd] = useState('');
  const [yearStructure, setYearStructure] = useState<AcademicYearStructure | null>(null);
  const [programDuration, setProgramDuration] = useState<ProgramDuration | null>(null);

  // Branding — existing (already-uploaded) URLs vs a newly-picked local file
  const [existingLogoUrl, setExistingLogoUrl] = useState<string | null>(null);
  const [existingSealUrl, setExistingSealUrl] = useState<string | null>(null);
  const [newLogo, setNewLogo] = useState<PendingPhoto | null>(null);
  const [newSeal, setNewSeal] = useState<PendingPhoto | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      const data = await fetchSetupStatus(token);
      setStatus(data);
      const s = data.school;
      setName(s.name ?? '');
      setNameAr(s.name_ar ?? '');
      setEmail(s.email ?? '');
      setPhone(s.phone ?? '');
      setAddress(s.address ?? '');
      setDescription(s.description ?? '');
      setInstitutionType(s.institution_type);
      setTimezone(s.timezone ?? '');
      setDefaultLanguage(s.default_language ?? '');
      setSecondaryLanguage(s.secondary_language ?? '');
      setCalendarType(s.calendar_type);
      setWorkingDays(s.working_days ?? []);
      setHoursStart(s.school_hours_start ?? '');
      setHoursEnd(s.school_hours_end ?? '');
      setYearStructure(s.academic_year_structure);
      setProgramDuration(s.program_duration);
      setExistingLogoUrl(s.logo);
      setExistingSealUrl(s.seal);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('institution_profile.load_error', 'Failed to load institution profile.'));
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const toggleDay = (day: number) => {
    setWorkingDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  };

  const pickPhoto = async (field: 'logo' | 'seal') => {
    setPhotoError(null);
    const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1, quality: 1 });
    if (result.didCancel || result.errorCode || !result.assets?.[0]?.uri) return;

    const asset = result.assets[0];
    setPickingField(field);
    try {
      const prepared = await prepareProfilePhoto(asset.uri as string, asset.fileName ?? undefined, asset.type ?? undefined);
      if (field === 'logo') setNewLogo(prepared);
      else setNewSeal(prepared);
    } catch (err) {
      if (err instanceof InvalidPhotoTypeError) {
        setPhotoError(err.message);
      } else {
        setPhotoError(t('institution_profile.photo_process_error', 'Could not process that image. Please try a different one.'));
      }
    } finally {
      setPickingField(null);
    }
  };

  const validateHours = (value: string) => value === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

  const onSave = async () => {
    if (!token) {
      Alert.alert(t('common.error', 'Error'), t('institution_profile.session_expired', 'Your session expired. Please log in again.'));
      return;
    }
    if (!name.trim()) {
      Alert.alert(t('common.error', 'Error'), t('institution_profile.name_required', 'Institution name is required.'));
      return;
    }
    if (!validateHours(hoursStart) || !validateHours(hoursEnd)) {
      Alert.alert(t('common.error', 'Error'), t('institution_profile.hours_format_error', 'School hours must be in 24-hour HH:MM format, e.g. 08:00.'));
      return;
    }

    setSubmitting(true);
    try {
      await saveInstitutionProfile(token, {
        name: name.trim(),
        name_ar: nameAr.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        description: description.trim() || undefined,
        institution_type: institutionType ?? undefined,
        timezone: timezone.trim() || undefined,
        default_language: defaultLanguage.trim() || undefined,
        secondary_language: secondaryLanguage.trim() || undefined,
        calendar_type: calendarType ?? undefined,
        working_days: workingDays,
        school_hours_start: hoursStart || undefined,
        school_hours_end: hoursEnd || undefined,
        academic_year_structure: yearStructure ?? undefined,
        program_duration: institutionType === 'markaz' ? programDuration ?? undefined : undefined,
        logo: newLogo ? { uri: newLogo.uri, fileName: newLogo.fileName, type: newLogo.type } : undefined,
        seal: newSeal ? { uri: newSeal.uri, fileName: newSeal.fileName, type: newSeal.type } : undefined,
      });
      Alert.alert(
        t('institution_profile.saved', 'Saved'),
        t('institution_profile.saved_message', 'Institution profile updated.'),
        [{ text: t('common.ok', 'OK'), onPress: () => navigation.goBack() }],
      );
      setNewLogo(null);
      setNewSeal(null);
    } catch (err) {
      Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('institution_profile.save_error', 'Could not save the institution profile.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Orphan schools skip two steps entirely: Type, because the institution
  // type is a one-time choice made at registration/onboarding (changing it
  // here would be re-founding the school as something else, not editing a
  // profile field) - and Structure, because "academic year structure"
  // describes a class-based curriculum orphan schools don't have (same
  // boundary orphanSchool.ts already draws for the rest of the academic
  // tile set). Both stay available for every other institution type.
  const isOrphanSchool = institutionType === 'orphanage';
  const visibleStepKeys = useMemo(
    () => STEP_KEYS.filter((k) => !(isOrphanSchool && (k === 'type' || k === 'structure'))),
    [isOrphanSchool],
  );

  const isLastStep = step === visibleStepKeys.length - 1;
  const currentStepKey = visibleStepKeys[step];

  const goNext = () => {
    setStepError(null);
    if (currentStepKey === 'basic' && !name.trim()) {
      setStepError(t('institution_profile.name_required', 'Institution name is required.'));
      return;
    }
    if (currentStepKey === 'schedule' && (!validateHours(hoursStart) || !validateHours(hoursEnd))) {
      setStepError(t('institution_profile.hours_format_error', 'School hours must be in 24-hour HH:MM format, e.g. 08:00.'));
      return;
    }
    if (isLastStep) {
      onSave();
    } else {
      setStep((s) => Math.min(visibleStepKeys.length - 1, s + 1));
    }
  };

  const goBack = () => {
    setStepError(null);
    setStep((s) => Math.max(0, s - 1));
  };

  if (loading || !status) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
            <IconChevronLeft color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, styles.headerTitleFlex]}>{t('institution_profile.title', 'Institution Profile')}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator color={theme.accent} />
        </View>
      </View>
    );
  }

  const logoUri = newLogo?.uri ?? existingLogoUrl;
  const sealUri = newSeal?.uri ?? existingSealUrl;
  const changeText = t('institution_profile.change', 'Change');
  const addText = t('institution_profile.add', 'Add');

  return (
    <View style={styles.container}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
          <IconChevronLeft color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, styles.headerTitleFlex]}>{t('institution_profile.title', 'Institution Profile')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView style={styles.flexInner} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <WizardStepHeader step={step + 1} labels={visibleStepKeys.map(stepLabel)} />

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
            <TouchableOpacity onPress={load}>
              <Text style={styles.retryText}>{t('common.retry', 'Retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <ScrollView
          style={styles.stepScroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {currentStepKey === 'branding' && (
            <>
              <View style={styles.hero}>
                <TouchableOpacity
                  onPress={() => pickPhoto('logo')}
                  activeOpacity={0.85}
                  disabled={pickingField === 'logo'}
                  style={styles.avatarWrap}
                >
                  <View style={styles.avatarCircle}>
                    {logoUri ? (
                      <Image source={{ uri: logoUri }} style={styles.avatarImage} resizeMode="cover" />
                    ) : (
                      <IconLandmark color={theme.textMuted} />
                    )}
                    {pickingField === 'logo' ? (
                      <View style={styles.avatarBusy}>
                        <ActivityIndicator color="#fff" />
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.avatarEditBadge}>
                    <IconPencil color={theme.onAccent} />
                  </View>
                </TouchableOpacity>
                <Text style={styles.heroName} numberOfLines={1}>
                  {name || t('institution_profile.institution_name', 'Institution Name')}
                </Text>
                <Text style={styles.heroHint}>{t('institution_profile.logo_hint', 'Tap the logo to change it')}</Text>
              </View>

              <Text style={styles.sectionTitle}>{t('institution_profile.branding', 'Branding')}</Text>
              <View style={styles.card}>
                <TouchableOpacity
                  style={styles.sealRow}
                  activeOpacity={0.75}
                  onPress={() => pickPhoto('seal')}
                  disabled={pickingField === 'seal'}
                >
                  <View style={styles.sealThumb}>
                    {sealUri ? (
                      <Image source={{ uri: sealUri }} style={styles.sealImage} resizeMode="contain" />
                    ) : (
                      <Text style={styles.sealPlus}>+</Text>
                    )}
                    {pickingField === 'seal' ? (
                      <View style={styles.avatarBusy}>
                        <ActivityIndicator size="small" color="#fff" />
                      </View>
                    ) : null}
                  </View>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={styles.sealTitle}>{t('institution_profile.official_seal', 'Official Seal')}</Text>
                    <Text style={styles.sealSubtitle}>
                      {sealUri
                        ? t('institution_profile.seal_uploaded', 'Uploaded')
                        : t('institution_profile.seal_not_added', 'Not added yet')}
                    </Text>
                  </View>
                  <Text style={styles.sealAction}>{sealUri ? changeText : addText}</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.hint}>
                {t('institution_profile.photo_hint', 'Max {size} - larger images are compressed automatically. JPG, JPEG, or PNG.').replace('{size}', formatBytes(MAX_PHOTO_BYTES))}
              </Text>
              {photoError ? <Text style={styles.errorText}>{photoError}</Text> : null}
            </>
          )}

          {currentStepKey === 'basic' && (
            <>
              <Text style={styles.stepHeading}>{t('institution_profile.basic_information', 'Basic Information')}</Text>
              <View style={styles.card}>
                <FieldRow label={t('institution_profile.institution_name', 'Institution Name')} value={name} onChangeText={setName} placeholder={t('institution_profile.institution_name_placeholder', 'Institution name')} theme={theme} styles={styles} />
                <RowDivider theme={theme} />
                <FieldRow label={t('institution_profile.arabic_name', 'Arabic Name (optional)')} value={nameAr} onChangeText={setNameAr} placeholder="الاسم بالعربية" theme={theme} styles={styles} />
                <RowDivider theme={theme} />
                <FieldRow label={t('institution_profile.email', 'Email (optional)')} value={email} onChangeText={setEmail} placeholder="school@example.com" keyboardType="email-address" theme={theme} styles={styles} />
                <RowDivider theme={theme} />
                <FieldRow label={t('institution_profile.phone', 'Phone (optional)')} value={phone} onChangeText={setPhone} placeholder={t('institution_profile.phone_placeholder', 'Phone number')} keyboardType="phone-pad" theme={theme} styles={styles} />
                <RowDivider theme={theme} />
                <FieldRow label={t('institution_profile.address', 'Address (optional)')} value={address} onChangeText={setAddress} placeholder={t('institution_profile.address_placeholder', 'Address')} multiline theme={theme} styles={styles} />
                <RowDivider theme={theme} />
                <FieldRow label={t('institution_profile.description', 'Description (optional)')} value={description} onChangeText={setDescription} placeholder={t('institution_profile.description_placeholder', 'Institution description')} multiline theme={theme} styles={styles} isLast />
              </View>
            </>
          )}

          {currentStepKey === 'type' && (
            <>
              <Text style={styles.stepHeading}>{t('institution_profile.institution_type', 'Institution Type')}</Text>
              <View style={styles.card}>
                <View style={styles.chipRow}>
                  {status.institution_types.map((type) => (
                    <Chip
                      key={type}
                      label={institutionTypeLabel(type)}
                      selected={institutionType === type}
                      onPress={() => setInstitutionType(type)}
                      styles={styles}
                    />
                  ))}
                </View>
                {institutionType === 'markaz' ? (
                  <>
                    <RowDivider theme={theme} />
                    <Text style={styles.label}>{t('institution_profile.program_duration', 'Program Duration')}</Text>
                    <View style={styles.chipRow}>
                      {status.program_durations.map((d) => (
                        <Chip key={d} label={programDurationLabel(d)} selected={programDuration === d} onPress={() => setProgramDuration(d)} styles={styles} />
                      ))}
                    </View>
                  </>
                ) : null}
              </View>
              <Text style={styles.hint}>{t('institution_profile.institution_type_hint', 'Only sets editable starting defaults - nothing here is hardcoded to this choice.')}</Text>
            </>
          )}

          {currentStepKey === 'localization' && (
            <>
              <Text style={styles.stepHeading}>{t('institution_profile.localization_calendar', 'Localization & Calendar')}</Text>
              <View style={styles.card}>
                <FieldRow label={t('institution_profile.timezone', 'Timezone')} value={timezone} onChangeText={setTimezone} placeholder="e.g. Asia/Karachi" theme={theme} styles={styles} />
                <RowDivider theme={theme} />
                <FieldRow label={t('institution_profile.default_language', 'Default Language')} value={defaultLanguage} onChangeText={setDefaultLanguage} placeholder="e.g. en" theme={theme} styles={styles} />
                <RowDivider theme={theme} />
                <FieldRow label={t('institution_profile.secondary_language', 'Secondary Language (optional)')} value={secondaryLanguage} onChangeText={setSecondaryLanguage} placeholder="e.g. ar" theme={theme} styles={styles} isLast />
              </View>
              <View style={[styles.card, { marginTop: 12 }]}>
                <Text style={styles.label}>{t('institution_profile.calendar_type', 'Calendar Type')}</Text>
                <View style={styles.chipRow}>
                  {status.calendar_types.map((type) => (
                    <Chip key={type} label={calendarTypeLabel(type)} selected={calendarType === type} onPress={() => setCalendarType(type)} styles={styles} />
                  ))}
                </View>
              </View>
            </>
          )}

          {currentStepKey === 'schedule' && (
            <>
              <Text style={styles.stepHeading}>{t('institution_profile.working_days_hours', 'Working Days & Hours')}</Text>
              <View style={styles.card}>
                <View style={styles.chipRow}>
                  {DAY_KEYS.map((key, i) => (
                    <Chip key={key} label={dayLabel(i)} selected={workingDays.includes(i)} onPress={() => toggleDay(i)} styles={styles} />
                  ))}
                </View>
                <RowDivider theme={theme} />
                <View style={styles.hoursRow}>
                  <View style={styles.hoursField}>
                    <Text style={styles.label}>{t('institution_profile.start_24h', 'Start (24h)')}</Text>
                    <TextInput
                      style={styles.hoursInput}
                      value={hoursStart}
                      onChangeText={setHoursStart}
                      placeholder="08:00"
                      placeholderTextColor={theme.textMuted}
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>
                  <View style={styles.hoursDivider} />
                  <View style={styles.hoursField}>
                    <Text style={styles.label}>{t('institution_profile.end_24h', 'End (24h)')}</Text>
                    <TextInput
                      style={styles.hoursInput}
                      value={hoursEnd}
                      onChangeText={setHoursEnd}
                      placeholder="15:00"
                      placeholderTextColor={theme.textMuted}
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>
                </View>
              </View>
            </>
          )}

          {currentStepKey === 'structure' && (
            <>
              <Text style={styles.stepHeading}>{t('institution_profile.academic_year_structure', 'Academic Year Structure')}</Text>
              <View style={styles.card}>
                <View style={styles.chipRow}>
                  {status.academic_year_structures.map((s) => (
                    <Chip key={s} label={yearStructureLabel(s)} selected={yearStructure === s} onPress={() => setYearStructure(s)} styles={styles} />
                  ))}
                </View>
              </View>
              <Text style={styles.hint}>
                {t(
                  'institution_profile.year_structure_hint',
                  'Changing this only affects new academic years going forward - existing years and terms keep the structure they were created with.',
                )}
              </Text>
            </>
          )}
        </ScrollView>

        {stepError ? <Text style={styles.stepErrorText}>{stepError}</Text> : null}

        <View style={[styles.actions, { paddingBottom: insets.bottom + 14 }]}>
          {step > 0 ? (
            <TouchableOpacity style={styles.backStepButton} onPress={goBack} disabled={submitting} activeOpacity={0.85}>
              <Text style={styles.backStepButtonText}>{t('common.back', 'Back')}</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[styles.continueButton, submitting && styles.continueButtonDisabled]}
            disabled={submitting}
            onPress={goNext}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color={theme.onAccent} />
            ) : (
              <Text style={styles.continueButtonText}>
                {isLastStep ? t('institution_profile.save_changes', 'Save Changes') : t('institution_profile.continue', 'Continue')}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function FieldRow({
  label,
  value,
  onChangeText,
  placeholder,
  theme,
  styles,
  keyboardType,
  multiline,
  isLast,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  theme: AcademicGlassTheme;
  styles: ReturnType<typeof makeStyles>;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numbers-and-punctuation';
  multiline?: boolean;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.fieldRow, isLast && styles.fieldRowLast]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && styles.fieldInputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
        keyboardType={keyboardType ?? 'default'}
        multiline={multiline}
      />
    </View>
  );
}

function RowDivider({ theme }: { theme: AcademicGlassTheme }) {
  return <View style={{ height: 1, backgroundColor: theme.border, marginLeft: 16 }} />;
}

function Chip({
  label,
  selected,
  onPress,
  styles,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <TouchableOpacity style={[styles.chip, selected && styles.chipSelected]} onPress={onPress} activeOpacity={0.8}>
      {selected ? (
        <View style={styles.chipCheck}>
          <IconCheck color={styles.chipTextSelected.color as string} />
        </View>
      ) : null}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

const makeStyles = (theme: AcademicGlassTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    flexInner: { flex: 1 },
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
    headerTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary, textAlign: 'center' },
    headerTitleFlex: { flex: 1, marginLeft: 8 },
    backButton: { width: 32 },
    headerSpacer: { width: 32 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    stepScroll: { flex: 1 },
    content: { padding: 20, paddingTop: 4 },
    stepHeading: { fontSize: 17, fontWeight: '700', color: theme.textPrimary, marginBottom: 12 },

    errorBanner: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: theme.dangerSoft,
      padding: 12,
      borderRadius: RADIUS.sm,
      marginHorizontal: 20,
      marginBottom: 12,
    },
    errorBannerText: { color: theme.danger, fontSize: 13, flex: 1, marginRight: 8 },
    retryText: { color: theme.danger, fontWeight: '700', fontSize: 13 },
    errorText: { color: theme.danger, fontSize: 12.5, marginTop: 8, textAlign: 'center' },
    stepErrorText: { color: theme.danger, fontSize: 12.5, textAlign: 'center', paddingHorizontal: 20, marginBottom: 8 },

    // Hero avatar
    hero: { alignItems: 'center', marginBottom: 28 },
    avatarWrap: { alignItems: 'center' },
    avatarCircle: {
      width: 108,
      height: 108,
      borderRadius: 54,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImage: { width: '100%', height: '100%' },
    avatarBusy: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.4)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarEditBadge: {
      position: 'absolute',
      right: -2,
      bottom: -2,
      width: 32,
      height: 32,
      borderRadius: 16,
      // Deeper emerald than theme.accent (#1FAE64) - white-on-accent only
      // measures 2.88:1, below WCAG AA's 4.5:1 minimum for the pencil icon
      // to read reliably. BRAND.emeraldDeep measures 5.42:1.
      backgroundColor: BRAND.emeraldDeep,
      borderWidth: 3,
      borderColor: theme.background === 'transparent' ? theme.surface : theme.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroName: { fontSize: 18, fontWeight: '700', color: theme.textPrimary, marginTop: 14, maxWidth: 280 },
    heroHint: { fontSize: 12.5, color: theme.textSecondary, marginTop: 4 },

    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.textSecondary,
      marginBottom: 8,
      marginLeft: 4,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    hint: { fontSize: 12, color: theme.textSecondary, lineHeight: 17, marginTop: 8, paddingHorizontal: 4 },

    // Grouped card (Settings-style)
    card: {
      backgroundColor: theme.surface,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
      padding: 4,
    },

    // Seal row
    sealRow: { flexDirection: 'row', alignItems: 'center', padding: 12 },
    sealThumb: {
      width: 52,
      height: 52,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.background === 'transparent' ? 'rgba(0,0,0,0.02)' : theme.background,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    sealImage: { width: '80%', height: '80%' },
    sealPlus: { fontSize: 22, fontWeight: '300', color: theme.textMuted },
    sealTitle: { fontSize: 14.5, fontWeight: '700', color: theme.textPrimary },
    sealSubtitle: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
    sealAction: { fontSize: 13.5, fontWeight: '700', color: BRAND.emeraldDeep, marginLeft: 10 },

    // Grouped field row (label above, input below, card supplies the border)
    fieldRow: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 10 },
    fieldRowLast: { paddingBottom: 12 },
    fieldLabel: { fontSize: 12, fontWeight: '600', color: theme.textSecondary, marginBottom: 5 },
    fieldInput: { fontSize: 15.5, color: theme.textPrimary, padding: 0 },
    fieldInputMultiline: { minHeight: 44, textAlignVertical: 'top' },

    label: { fontSize: 12.5, fontWeight: '600', color: theme.textSecondary, marginBottom: 8, marginTop: 4, marginLeft: 8 },

    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 8 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.background === 'transparent' ? 'rgba(0,0,0,0.02)' : theme.background,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: RADIUS.pill,
    },
    chipSelected: { backgroundColor: BRAND.emeraldDeep, borderColor: BRAND.emeraldDeep },
    chipCheck: { marginRight: 5 },
    chipText: { fontSize: 13, fontWeight: '600', color: theme.textPrimary },
    chipTextSelected: { color: theme.onAccent },

    hoursRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12 },
    hoursField: { flex: 1 },
    hoursDivider: { width: 1, height: 40, backgroundColor: theme.border, marginHorizontal: 16 },
    hoursInput: { fontSize: 15.5, color: theme.textPrimary, padding: 0 },

    actions: {
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 20,
      paddingTop: 12,
      backgroundColor: theme.surface,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    backStepButton: {
      flex: 1,
      height: 52,
      borderRadius: RADIUS.pill,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backStepButtonText: { color: theme.textPrimary, fontSize: 15.5, fontWeight: '700' },
    continueButton: {
      flex: 2,
      backgroundColor: BRAND.emeraldDeep,
      borderRadius: RADIUS.pill,
      height: 52,
      alignItems: 'center',
      justifyContent: 'center',
    },
    continueButtonDisabled: { opacity: 0.5 },
    continueButtonText: { color: theme.onAccent, fontSize: 15.5, fontWeight: '700' },
  });
