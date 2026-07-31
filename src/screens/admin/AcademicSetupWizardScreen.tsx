import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
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
  SetupStatus,
} from '../../services/academicSetupService';

const EMERALD = BRAND.emerald;
const EMERALD_SOFT = 'rgba(34,197,94,0.14)';
const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const ERROR = '#BA1A1A';

const STEP_LABELS = [
  { key: 'institution', label: 'Institution' },
  { key: 'profile', label: 'Profile' },
  { key: 'academic_year', label: 'Academic Year' },
];

const INSTITUTION_TYPE_LABELS: Record<InstitutionType, string> = {
  mahad: 'Mahad',
  madrasa: 'Madrasa',
  markaz: 'Markaz',
  regular_school: 'Regular School',
  orphanage: 'Orphan School',
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
  const { token, updateUser } = useAuth();
  const { t } = useLocale();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1
  const [institutionType, setInstitutionType] = useState<InstitutionType | null>(null);
  // Step 2
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  // Step 3
  const [yearTitle, setYearTitle] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await fetchSetupStatus(token);
      setStatus(data);
      setInstitutionType(data.school.institution_type);
      setName(data.school.name ?? '');
      setNameAr(data.school.name_ar ?? '');
      setAddress(data.school.address ?? '');
      setPhone(data.school.phone ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('academic_setup_wizard.load_error', 'Could not load setup status.'));
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    load();
  }, [load]);

  const goNext = async () => {
    if (!token) return;
    setError(null);

    if (step === 0) {
      if (!institutionType) {
        setError(t('academic_setup_wizard.choose_institution_type', 'Choose an institution type to continue.'));
        return;
      }
      setSubmitting(true);
      try {
        await saveInstitutionProfile(token, { institution_type: institutionType });
        setStep(1);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('academic_setup_wizard.save_type_error', 'Could not save institution type.'));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (step === 1) {
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
        setStep(2);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('academic_setup_wizard.save_profile_error', 'Could not save institution profile.'));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (step === 2) {
      if (!yearTitle.trim()) {
        setError(t('academic_setup_wizard.year_title_required', 'Enter a title for your first academic year (e.g. "2026-2027").'));
        return;
      }
      setSubmitting(true);
      try {
        await createAcademicYear(token, yearTitle.trim(), true);
        const school = await completeSetup(token);
        updateUser({
          academic_setup_completed: true,
          institution_type: school.institution_type ?? undefined,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : t('academic_setup_wizard.finish_error', 'Could not finish setup.'));
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
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.iconWrap}>
            <BuildingIcon />
          </View>
          <Text style={styles.title}>{t('academic_setup_wizard.title', 'Set up your school')}</Text>
          <Text style={styles.subtitle}>
            {t('academic_setup_wizard.subtitle', 'A few quick steps before your Admin, Teacher, and Student portals go live.')}
          </Text>

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

          <GlassCard surface="light" radius={RADIUS.lg} style={styles.stepCard}>
            {step === 0 && (
              <View>
                <Text style={styles.stepHeading}>{t('academic_setup_wizard.institution_type_heading', 'What type of institution is this?')}</Text>
                <Text style={styles.stepHint}>
                  {t('academic_setup_wizard.institution_type_hint', 'This only picks editable starting defaults - everything can be renamed or changed later.')}
                </Text>
                {status.institution_types.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.optionRow, institutionType === type && styles.optionRowSelected]}
                    onPress={() => setInstitutionType(type)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.radio, institutionType === type && styles.radioSelected]}>
                      {institutionType === type ? <View style={styles.radioDot} /> : null}
                    </View>
                    <Text style={styles.optionLabel}>{t(`academic_setup_wizard.institution_type_${type}`, INSTITUTION_TYPE_LABELS[type])}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {step === 1 && (
              <View>
                <Text style={styles.stepHeading}>{t('academic_setup_wizard.profile_heading', 'Institution profile')}</Text>
                <Text style={styles.label}>{t('academic_setup_wizard.name_label', 'Name')}</Text>
                <GlassInput value={name} onChangeText={setName} placeholder={t('academic_setup_wizard.name_placeholder', 'Institution name')} style={styles.input} />
                <Text style={styles.label}>{t('academic_setup_wizard.name_ar_label', 'Arabic name (optional)')}</Text>
                <GlassInput value={nameAr} onChangeText={setNameAr} placeholder="الاسم بالعربية" style={styles.input} />
                <Text style={styles.label}>{t('academic_setup_wizard.address_label', 'Address (optional)')}</Text>
                <GlassInput value={address} onChangeText={setAddress} placeholder={t('academic_setup_wizard.address_placeholder', 'Address')} style={styles.input} />
                <Text style={styles.label}>{t('academic_setup_wizard.phone_label', 'Phone (optional)')}</Text>
                <GlassInput value={phone} onChangeText={setPhone} placeholder={t('academic_setup_wizard.phone_placeholder', 'Phone number')} keyboardType="phone-pad" style={styles.input} />
              </View>
            )}

            {step === 2 && (
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
          </GlassCard>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.actions}>
            {step > 0 ? (
              <GlassButton label={t('common.back', 'Back')} variant="ghost" onPress={goBack} disabled={submitting} style={styles.backButton} />
            ) : null}
            <GlassButton
              label={step === 2 ? t('academic_setup_wizard.finish_setup', 'Finish Setup') : t('academic_setup_wizard.continue', 'Continue')}
              onPress={goNext}
              loading={submitting}
              style={styles.nextButton}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#EFF7F1' },
  flexInner: { flex: 1 },
  centerLoading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { flexGrow: 1, padding: 24, paddingTop: 70, alignItems: 'stretch' },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: { fontSize: 22, fontWeight: '800', color: INK, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: SUBTLE, textAlign: 'center', lineHeight: 20, marginBottom: 26 },

  stepper: { flexDirection: 'row', justifyContent: 'center', gap: 28, marginBottom: 24 },
  stepperItem: { alignItems: 'center', gap: 6 },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: { backgroundColor: EMERALD },
  stepDotDone: { backgroundColor: BRAND.emeraldDeep },
  stepDotText: { fontSize: 12, fontWeight: '700', color: SUBTLE },
  stepDotTextActive: { color: '#fff' },
  stepLabel: { fontSize: 11, color: SUBTLE, fontWeight: '600' },
  stepLabelActive: { color: EMERALD },

  stepCard: { marginBottom: 20 },
  stepHeading: { fontSize: 16, fontWeight: '700', color: INK, marginBottom: 6 },
  stepHint: { fontSize: 12.5, color: SUBTLE, lineHeight: 18, marginBottom: 14 },

  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EDEEF0',
  },
  optionRowSelected: {},
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: EMERALD },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: EMERALD },
  optionLabel: { fontSize: 15, color: INK, fontWeight: '600' },

  label: { fontSize: 12.5, fontWeight: '600', color: SUBTLE, marginBottom: 6, marginTop: 12 },
  input: {},

  errorText: { color: ERROR, fontSize: 13.5, marginBottom: 14, textAlign: 'center' },

  actions: { flexDirection: 'row', gap: 12 },
  backButton: { flex: 1 },
  nextButton: { flex: 2 },
});
