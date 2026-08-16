import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronLeft, GraduationCap, School, Search } from 'lucide-react-native';
import { useLocale } from '../context/LocaleContext';
import { BRAND, COLORS, RADIUS, SHADOW } from '../theme/glass';
import GlassBackground from '../components/glass/GlassBackground';
import {
  WizardGradientButton as GradientButton,
  WizardStepHeader,
  WizardFieldLabel as FieldLabel,
  CheckCircleIcon,
  form,
} from '../components/wizard/WizardKit';
import {
  SchoolOption,
  fetchSchoolsForRegistration,
  submitAlumniRegistration,
  AlumniRegistrationInput,
} from '../services/alumniRegistrationService';

const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const BORDER = COLORS.border;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STEP_LABELS = ['School', 'Basic Info', 'Graduation', 'Review'];
const CURRENT_YEAR = new Date().getFullYear();

const INSTITUTION_LABELS: Record<string, string> = {
  mahad: 'Mahad',
  madrasa: 'Madrasa',
  markaz: 'Markaz',
  regular_school: 'Regular School',
  orphanage: 'Orphan School',
};

/* ========================= ICONS ========================= */

function BackIcon() {
  return <ChevronLeft size={22} color={INK} strokeWidth={2.1} />;
}
function SearchIcon({ color = SUBTLE, size = 17 }: { color?: string; size?: number }) {
  return <Search size={size} color={color} strokeWidth={2} />;
}
function SchoolFallbackIcon({ color = BRAND.emerald, size = 22 }: { color?: string; size?: number }) {
  return <School size={size} color={color} strokeWidth={2} />;
}
function CapIcon({ color = BRAND.emerald, size = 20 }: { color?: string; size?: number }) {
  return <GraduationCap size={size} color={color} strokeWidth={1.8} />;
}
function CheckSmallIcon({ color = '#FFFFFF', size = 14 }: { color?: string; size?: number }) {
  return <Check size={size} color={color} strokeWidth={2.6} />;
}

/* ========================= MAIN SCREEN ========================= */

export default function AlumniRegistrationScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t } = useLocale();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [submitted, setSubmitted] = useState(false);

  // Step 1 - School
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [loadingSchools, setLoadingSchools] = useState(true);
  const [schoolsError, setSchoolsError] = useState<string | null>(null);
  const [schoolQuery, setSchoolQuery] = useState('');
  const [selectedSchool, setSelectedSchool] = useState<SchoolOption | null>(null);

  // Step 2 - Basic info
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Step 3 - Graduation details
  const [graduationYear, setGraduationYear] = useState('');
  const [program, setProgram] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loadSchools = useCallback(() => {
    setLoadingSchools(true);
    setSchoolsError(null);
    fetchSchoolsForRegistration()
      .then(setSchools)
      .catch((err) => setSchoolsError(err instanceof Error ? err.message : 'Could not load schools.'))
      .finally(() => setLoadingSchools(false));
  }, []);

  useEffect(loadSchools, [loadSchools]);

  const filteredSchools = useMemo(() => {
    const q = schoolQuery.trim().toLowerCase();
    if (!q) return schools;
    return schools.filter((s) => s.name.toLowerCase().includes(q));
  }, [schools, schoolQuery]);

  const step1Valid = !!selectedSchool;
  const step2Valid =
    name.trim().length > 0 && EMAIL_RE.test(email.trim()) && password.length >= 8 && password === confirmPassword;
  const gradYearNum = parseInt(graduationYear, 10);
  const step3Valid = !!graduationYear && gradYearNum >= 1950 && gradYearNum <= CURRENT_YEAR + 1;

  const goNext = () => setStep((s) => (Math.min(4, s + 1) as 1 | 2 | 3 | 4));
  const goBackStep = () => setStep((s) => (Math.max(1, s - 1) as 1 | 2 | 3 | 4));

  const submit = async () => {
    if (!selectedSchool || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const input: AlumniRegistrationInput = {
        schoolId: selectedSchool.id,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        password,
        graduationYear: gradYearNum,
        program: program.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      await submitAlumniRegistration(input);
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
          <Text style={styles.successTitle}>{t('alumni_registration.pending_title', 'Application submitted')}</Text>
          <Text style={styles.successBody}>
            {t(
              'alumni_registration.pending_body',
              "Your alumni account is pending review by {school}'s admin. You'll be able to sign in once it's approved.",
            ).replace('{school}', selectedSchool?.name ?? 'your school')}
          </Text>
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingBadgeText}>{t('alumni_registration.pending_badge', 'Status: Pending Approval')}</Text>
          </View>
          <GradientButton label={t('alumni_registration.back_to_login', 'Back to Login')} onPress={() => navigation.goBack()} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => (step === 1 ? navigation.goBack() : goBackStep())} hitSlop={10}>
          <BackIcon />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t('alumni_registration.title', 'Create Alumni Account')}</Text>
          <Text style={styles.headerSubtitle}>{t('alumni_registration.subtitle', 'Reconnect with your school community')}</Text>
        </View>
      </View>

      <WizardStepHeader step={step} labels={STEP_LABELS} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
        {step === 1 ? (
          <>
            <View style={school.searchWrap}>
              <SearchIcon />
              <TextInput
                style={school.searchInput}
                value={schoolQuery}
                onChangeText={setSchoolQuery}
                placeholder={t('alumni_registration.school_search_placeholder', 'Search for your school')}
                placeholderTextColor={SUBTLE}
              />
            </View>

            {loadingSchools ? (
              <ActivityIndicator style={{ marginTop: 30 }} color={BRAND.emerald} />
            ) : schoolsError ? (
              <View style={{ padding: 20 }}>
                <Text style={form.errorText}>{schoolsError}</Text>
                <TouchableOpacity onPress={loadSchools} style={{ marginTop: 10 }}>
                  <Text style={{ color: BRAND.emerald, fontWeight: '700' }}>{t('common.try_again', 'Try again')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={filteredSchools}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <Text style={school.emptyText}>{t('alumni_registration.no_schools', 'No schools found.')}</Text>
                }
                renderItem={({ item }) => {
                  const active = selectedSchool?.id === item.id;
                  return (
                    <TouchableOpacity
                      style={[school.row, active && school.rowActive]}
                      activeOpacity={0.85}
                      onPress={() => setSelectedSchool(item)}
                    >
                      <View style={school.logoWrap}>
                        {item.logo ? (
                          <Image source={{ uri: item.logo }} style={school.logo} resizeMode="cover" />
                        ) : (
                          <SchoolFallbackIcon />
                        )}
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={school.name} numberOfLines={1}>{item.name}</Text>
                        <Text style={school.type}>{INSTITUTION_LABELS[item.institutionType] ?? item.institutionType}</Text>
                      </View>
                      {active ? (
                        <View style={school.checkCircle}>
                          <CheckSmallIcon />
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </>
        ) : (
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {step === 2 && (
              <>
                <View style={school.selectedBanner}>
                  <CapIcon size={16} />
                  <Text style={school.selectedBannerText} numberOfLines={1}>{selectedSchool?.name}</Text>
                </View>

                <FieldLabel required>{t('alumni_registration.name', 'Full Name')}</FieldLabel>
                <TextInput
                  style={form.input}
                  value={name}
                  onChangeText={setName}
                  placeholder={t('alumni_registration.name_placeholder', 'As it appears on your records')}
                  placeholderTextColor={SUBTLE}
                />

                <FieldLabel required>{t('alumni_registration.email', 'Email')}</FieldLabel>
                <TextInput
                  style={form.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={SUBTLE}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <FieldLabel>{t('alumni_registration.phone', 'Phone')}</FieldLabel>
                <TextInput
                  style={form.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+63 912 345 6789"
                  placeholderTextColor={SUBTLE}
                  keyboardType="phone-pad"
                />

                <FieldLabel required>{t('alumni_registration.password', 'Password')}</FieldLabel>
                <TextInput
                  style={form.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t('alumni_registration.password_placeholder', 'At least 8 characters')}
                  placeholderTextColor={SUBTLE}
                  secureTextEntry
                />

                <FieldLabel required>{t('alumni_registration.confirm_password', 'Confirm Password')}</FieldLabel>
                <TextInput
                  style={form.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder={t('alumni_registration.confirm_password_placeholder', 'Re-enter your password')}
                  placeholderTextColor={SUBTLE}
                  secureTextEntry
                />
                {confirmPassword.length > 0 && password !== confirmPassword ? (
                  <Text style={form.errorText}>{t('alumni_registration.password_mismatch', "Passwords don't match.")}</Text>
                ) : null}
              </>
            )}

            {step === 3 && (
              <>
                <FieldLabel required>{t('alumni_registration.graduation_year', 'Graduation Year')}</FieldLabel>
                <TextInput
                  style={form.input}
                  value={graduationYear}
                  onChangeText={(v) => setGraduationYear(v.replace(/[^0-9]/g, '').slice(0, 4))}
                  placeholder={String(CURRENT_YEAR)}
                  placeholderTextColor={SUBTLE}
                  keyboardType="number-pad"
                  maxLength={4}
                />

                <FieldLabel>{t('alumni_registration.program', 'Program / Degree')}</FieldLabel>
                <TextInput
                  style={form.input}
                  value={program}
                  onChangeText={setProgram}
                  placeholder={t('alumni_registration.program_placeholder', 'e.g. Hifz Program, High School Diploma')}
                  placeholderTextColor={SUBTLE}
                />

                <FieldLabel>{t('alumni_registration.notes', 'Anything else?')}</FieldLabel>
                <TextInput
                  style={[form.input, form.inputMultiline]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder={t('alumni_registration.notes_placeholder', 'Optional note for the school admin reviewing your application')}
                  placeholderTextColor={SUBTLE}
                  multiline
                />
              </>
            )}

            {step === 4 && (
              <>
                <Text style={review.sectionTitle}>{t('alumni_registration.review_school', 'School')}</Text>
                <View style={review.card}>
                  <ReviewRow label={t('alumni_registration.school', 'School')} value={selectedSchool?.name ?? '—'} />
                </View>

                <Text style={review.sectionTitle}>{t('alumni_registration.review_basic', 'Your Info')}</Text>
                <View style={review.card}>
                  <ReviewRow label={t('alumni_registration.name', 'Full Name')} value={name} />
                  <ReviewRow label={t('alumni_registration.email', 'Email')} value={email} />
                  {!!phone && <ReviewRow label={t('alumni_registration.phone', 'Phone')} value={phone} />}
                </View>

                <Text style={review.sectionTitle}>{t('alumni_registration.review_graduation', 'Graduation')}</Text>
                <View style={review.card}>
                  <ReviewRow label={t('alumni_registration.graduation_year', 'Graduation Year')} value={graduationYear} />
                  {!!program && <ReviewRow label={t('alumni_registration.program', 'Program / Degree')} value={program} />}
                  {!!notes && <ReviewRow label={t('alumni_registration.notes', 'Notes')} value={notes} />}
                </View>

                {submitError ? <Text style={form.errorText}>{submitError}</Text> : null}
              </>
            )}
          </ScrollView>
        )}

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          {step < 4 ? (
            <GradientButton
              label={t('alumni_registration.next', 'Next')}
              onPress={goNext}
              disabled={step === 1 ? !step1Valid : step === 2 ? !step2Valid : !step3Valid}
            />
          ) : (
            <GradientButton label={t('alumni_registration.submit', 'Submit Application')} onPress={submit} loading={submitting} />
          )}
        </View>
      </KeyboardAvoidingView>
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

const school = StyleSheet.create({
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 14,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14.5, color: INK },
  emptyText: { fontSize: 13.5, color: SUBTLE, textAlign: 'center', marginTop: 30 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: BORDER,
    padding: 12,
    marginBottom: 10,
  },
  rowActive: { borderColor: BRAND.emerald, backgroundColor: COLORS.emeraldSoft },
  logoWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: COLORS.emeraldSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logo: { width: '100%', height: '100%' },
  name: { fontSize: 14.5, fontWeight: '700', color: INK },
  type: { fontSize: 12, color: SUBTLE, marginTop: 2 },
  checkCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: BRAND.emerald, alignItems: 'center', justifyContent: 'center' },
  selectedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.emeraldSoft,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  selectedBannerText: { flex: 1, fontSize: 13.5, fontWeight: '700', color: BRAND.emeraldDeep },
});

const review = StyleSheet.create({
  sectionTitle: { fontSize: 13.5, fontWeight: '700', color: INK, marginTop: 16, marginBottom: 10 },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: BORDER, padding: 14, ...SHADOW.level1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, gap: 12 },
  rowLabel: { fontSize: 12.5, color: SUBTLE, flexShrink: 0 },
  rowValue: { fontSize: 13, color: INK, fontWeight: '600', flex: 1, textAlign: 'right' },
});
