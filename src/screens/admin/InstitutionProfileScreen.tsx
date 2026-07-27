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
import Svg, { Polyline } from 'react-native-svg';
import { launchImageLibrary } from 'react-native-image-picker';
import { useAuth } from '../../context/AuthContext';
import { useAcademicGlassTheme, AcademicGlassTheme } from '../teachers/academicGlassTheme';
import { RADIUS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';
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
 * Entry point: a "Profile" header button on AcademicYearsScreen, same
 * pattern as EnrollmentStagesScreen's "Students" button — this and
 * years/terms are the same Academic Setup module.
 */

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const INSTITUTION_TYPE_LABELS: Record<InstitutionType, string> = {
  mahad: 'Mahad',
  madrasa: 'Madrasa',
  markaz: 'Markaz',
  regular_school: 'Regular School',
  orphanage: 'Orphan School',
};

const CALENDAR_TYPE_LABELS: Record<CalendarType, string> = {
  gregorian: 'Gregorian',
  hijri: 'Hijri',
  dual: 'Dual (Hijri + Gregorian)',
};

const YEAR_STRUCTURE_LABELS: Record<AcademicYearStructure, string> = {
  semester: 'Semester',
  trimester: 'Trimester',
  quarter: 'Quarter',
  continuous: 'Continuous',
  custom: 'Custom',
};

interface PendingPhoto {
  uri: string;
  fileName: string;
  type: string;
  size: number;
  wasCompressed: boolean;
}

function IconChevronLeft({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Polyline points="15 5 8 12 15 19" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function InstitutionProfileScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const theme = useAcademicGlassTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [pickingField, setPickingField] = useState<'logo' | 'seal' | null>(null);

  // Fields
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [institutionType, setInstitutionType] = useState<InstitutionType | null>(null);
  const [timezone, setTimezone] = useState('');
  const [defaultLanguage, setDefaultLanguage] = useState('');
  const [secondaryLanguage, setSecondaryLanguage] = useState('');
  const [calendarType, setCalendarType] = useState<CalendarType | null>(null);
  const [workingDays, setWorkingDays] = useState<number[]>([]);
  const [hoursStart, setHoursStart] = useState('');
  const [hoursEnd, setHoursEnd] = useState('');
  const [yearStructure, setYearStructure] = useState<AcademicYearStructure | null>(null);

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
      setInstitutionType(s.institution_type);
      setTimezone(s.timezone ?? '');
      setDefaultLanguage(s.default_language ?? '');
      setSecondaryLanguage(s.secondary_language ?? '');
      setCalendarType(s.calendar_type);
      setWorkingDays(s.working_days ?? []);
      setHoursStart(s.school_hours_start ?? '');
      setHoursEnd(s.school_hours_end ?? '');
      setYearStructure(s.academic_year_structure);
      setExistingLogoUrl(s.logo);
      setExistingSealUrl(s.seal);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load institution profile.');
    } finally {
      setLoading(false);
    }
  }, [token]);

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
        setPhotoError('Could not process that image. Please try a different one.');
      }
    } finally {
      setPickingField(null);
    }
  };

  const validateHours = (value: string) => value === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

  const onSave = async () => {
    if (!token) {
      Alert.alert('Error', 'Your session expired. Please log in again.');
      return;
    }
    if (!name.trim()) {
      Alert.alert('Error', 'Institution name is required.');
      return;
    }
    if (!validateHours(hoursStart) || !validateHours(hoursEnd)) {
      Alert.alert('Error', 'School hours must be in 24-hour HH:MM format, e.g. 08:00.');
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
        institution_type: institutionType ?? undefined,
        timezone: timezone.trim() || undefined,
        default_language: defaultLanguage.trim() || undefined,
        secondary_language: secondaryLanguage.trim() || undefined,
        calendar_type: calendarType ?? undefined,
        working_days: workingDays,
        school_hours_start: hoursStart || undefined,
        school_hours_end: hoursEnd || undefined,
        academic_year_structure: yearStructure ?? undefined,
        logo: newLogo ? { uri: newLogo.uri, fileName: newLogo.fileName, type: newLogo.type } : undefined,
        seal: newSeal ? { uri: newSeal.uri, fileName: newSeal.fileName, type: newSeal.type } : undefined,
      });
      Alert.alert('Saved', 'Institution profile updated.');
      setNewLogo(null);
      setNewSeal(null);
      load();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not save the institution profile.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !status) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
            <IconChevronLeft color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, styles.headerTitleFlex]}>Institution Profile</Text>
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
        <Text style={[styles.headerTitle, styles.headerTitleFlex]}>Institution Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView style={styles.flexInner} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{error}</Text>
              <TouchableOpacity onPress={load}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Branding */}
          <Text style={styles.sectionTitle}>Branding</Text>
          <View style={styles.brandingRow}>
            <PhotoSlot
              label="Logo"
              uri={newLogo?.uri ?? existingLogoUrl}
              busy={pickingField === 'logo'}
              onPress={() => pickPhoto('logo')}
              theme={theme}
            />
            <PhotoSlot
              label="Official Seal"
              uri={newSeal?.uri ?? existingSealUrl}
              busy={pickingField === 'seal'}
              onPress={() => pickPhoto('seal')}
              theme={theme}
            />
          </View>
          <Text style={styles.hint}>
            Max {formatBytes(MAX_PHOTO_BYTES)} - larger images are compressed automatically. JPG, JPEG, or PNG.
          </Text>
          {photoError ? <Text style={styles.errorText}>{photoError}</Text> : null}

          {/* Basic info */}
          <Text style={styles.sectionTitle}>Basic Information</Text>
          <Field label="Institution Name" value={name} onChangeText={setName} placeholder="Institution name" theme={theme} styles={styles} />
          <Field label="Arabic Name (optional)" value={nameAr} onChangeText={setNameAr} placeholder="الاسم بالعربية" theme={theme} styles={styles} />
          <Field label="Email (optional)" value={email} onChangeText={setEmail} placeholder="school@example.com" keyboardType="email-address" theme={theme} styles={styles} />
          <Field label="Phone (optional)" value={phone} onChangeText={setPhone} placeholder="Phone number" keyboardType="phone-pad" theme={theme} styles={styles} />
          <Field label="Address (optional)" value={address} onChangeText={setAddress} placeholder="Address" multiline theme={theme} styles={styles} />

          {/* Institution type */}
          <Text style={styles.sectionTitle}>Institution Type</Text>
          <View style={styles.chipRow}>
            {status.institution_types.map((type) => (
              <Chip
                key={type}
                label={INSTITUTION_TYPE_LABELS[type]}
                selected={institutionType === type}
                onPress={() => setInstitutionType(type)}
                styles={styles}
              />
            ))}
          </View>
          <Text style={styles.hint}>Only sets editable starting defaults - nothing here is hardcoded to this choice.</Text>

          {/* Localization & calendar */}
          <Text style={styles.sectionTitle}>Localization &amp; Calendar</Text>
          <Field label="Timezone" value={timezone} onChangeText={setTimezone} placeholder="e.g. Asia/Karachi" theme={theme} styles={styles} />
          <Field label="Default Language" value={defaultLanguage} onChangeText={setDefaultLanguage} placeholder="e.g. en" theme={theme} styles={styles} />
          <Field label="Secondary Language (optional)" value={secondaryLanguage} onChangeText={setSecondaryLanguage} placeholder="e.g. ar" theme={theme} styles={styles} />
          <Text style={styles.label}>Calendar Type</Text>
          <View style={styles.chipRow}>
            {status.calendar_types.map((type) => (
              <Chip key={type} label={CALENDAR_TYPE_LABELS[type]} selected={calendarType === type} onPress={() => setCalendarType(type)} styles={styles} />
            ))}
          </View>

          {/* Schedule */}
          <Text style={styles.sectionTitle}>Working Days &amp; Hours</Text>
          <View style={styles.chipRow}>
            {DAY_LABELS.map((label, i) => (
              <Chip key={label} label={label} selected={workingDays.includes(i)} onPress={() => toggleDay(i)} styles={styles} />
            ))}
          </View>
          <View style={styles.hoursRow}>
            <View style={styles.hoursField}>
              <Text style={styles.label}>Start (24h)</Text>
              <TextInput
                style={styles.input}
                value={hoursStart}
                onChangeText={setHoursStart}
                placeholder="08:00"
                placeholderTextColor={theme.textMuted}
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <View style={styles.hoursField}>
              <Text style={styles.label}>End (24h)</Text>
              <TextInput
                style={styles.input}
                value={hoursEnd}
                onChangeText={setHoursEnd}
                placeholder="15:00"
                placeholderTextColor={theme.textMuted}
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </View>

          {/* Academic year structure */}
          <Text style={styles.sectionTitle}>Academic Year Structure</Text>
          <View style={styles.chipRow}>
            {status.academic_year_structures.map((s) => (
              <Chip key={s} label={YEAR_STRUCTURE_LABELS[s]} selected={yearStructure === s} onPress={() => setYearStructure(s)} styles={styles} />
            ))}
          </View>
          <Text style={styles.hint}>
            Changing this only affects new academic years going forward - existing years and terms keep the structure they were created with.
          </Text>

          <TouchableOpacity
            style={[styles.saveButton, submitting && styles.saveButtonDisabled]}
            disabled={submitting}
            onPress={onSave}
          >
            {submitting ? <ActivityIndicator color={theme.onAccent} /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  theme,
  styles,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  theme: AcademicGlassTheme;
  styles: ReturnType<typeof makeStyles>;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numbers-and-punctuation';
  multiline?: boolean;
}) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
        keyboardType={keyboardType ?? 'default'}
        multiline={multiline}
      />
    </>
  );
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
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

function PhotoSlot({
  label,
  uri,
  busy,
  onPress,
  theme,
}: {
  label: string;
  uri: string | null;
  busy: boolean;
  onPress: () => void;
  theme: AcademicGlassTheme;
}) {
  return (
    <TouchableOpacity style={slotStyles.wrap} onPress={onPress} activeOpacity={0.85} disabled={busy}>
      <View style={[slotStyles.box, { borderColor: theme.border, backgroundColor: theme.surface }]}>
        {uri ? (
          <Image source={{ uri }} style={slotStyles.image} resizeMode="contain" />
        ) : (
          <Text style={[slotStyles.plus, { color: theme.textMuted }]}>+</Text>
        )}
        {busy ? (
          <View style={slotStyles.busyOverlay}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : null}
      </View>
      <Text style={[slotStyles.label, { color: theme.textSecondary }]}>{uri ? `Change ${label}` : `Add ${label}`}</Text>
    </TouchableOpacity>
  );
}

const slotStyles = StyleSheet.create({
  wrap: { alignItems: 'center', flex: 1 },
  box: {
    width: 96,
    height: 96,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  plus: { fontSize: 30, fontWeight: '300' },
  busyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 12, fontWeight: '600', marginTop: 8, textAlign: 'center' },
});

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
    headerTitle: { fontSize: 20, fontWeight: '700', color: theme.textPrimary },
    headerTitleFlex: { flex: 1, marginLeft: 8 },
    backButton: { width: 32 },
    headerSpacer: { width: 32 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    content: { padding: 20, paddingBottom: 48 },

    errorBanner: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: theme.dangerSoft,
      padding: 12,
      borderRadius: RADIUS.md ?? 10,
      marginBottom: 16,
    },
    errorBannerText: { color: theme.danger, fontSize: 13, flex: 1, marginRight: 8 },
    retryText: { color: theme.danger, fontWeight: '700', fontSize: 13 },
    errorText: { color: theme.danger, fontSize: 12.5, marginTop: 8, textAlign: 'center' },

    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.textPrimary,
      marginTop: 26,
      marginBottom: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },

    brandingRow: { flexDirection: 'row', gap: 20, justifyContent: 'center' },
    hint: { fontSize: 12, color: theme.textSecondary, lineHeight: 17, marginTop: 8, textAlign: 'center' },

    label: { fontSize: 12.5, fontWeight: '600', color: theme.textSecondary, marginBottom: 6, marginTop: 14 },
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
    inputMultiline: { height: 88, paddingTop: 12, textAlignVertical: 'top' },

    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
    },
    chipSelected: { backgroundColor: theme.accent, borderColor: theme.accent },
    chipText: { fontSize: 13, fontWeight: '600', color: theme.textPrimary },
    chipTextSelected: { color: theme.onAccent },

    hoursRow: { flexDirection: 'row', gap: 14, marginTop: 4 },
    hoursField: { flex: 1 },

    saveButton: {
      backgroundColor: theme.accent,
      borderRadius: RADIUS.sm,
      height: 50,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 36,
    },
    saveButtonDisabled: { opacity: 0.5 },
    saveButtonText: { color: theme.onAccent, fontSize: 15.5, fontWeight: '700' },
  });
