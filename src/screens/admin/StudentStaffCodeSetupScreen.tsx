import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronDown } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import {
  fetchStudentNumberConfig,
  saveStudentNumberConfig,
  previewStudentNumber,
  toDraft,
  StudentNumberDraft,
  StudentNumberConfig,
  TargetType,
} from '../../services/studentNumberService';
import { SHADOW, GLASS, COLORS, RADIUS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';

const EMERALD = COLORS.emerald;
const EMERALD_SOFT = COLORS.emeraldSoft;
const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const HAIRLINE = COLORS.border;
const GLASS_SURFACE = GLASS.fillOnLight;
const GLASS_BORDER = GLASS.borderOnLight;
const DANGER = COLORS.danger;

function ChevronLeftIcon({ color }: { color: string }) {
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}
function ChevronDownIcon({ color, up }: { color: string; up?: boolean }) {
  return <ChevronDown size={16} color={color} strokeWidth={2.2} style={{ transform: [{ rotate: up ? '180deg' : '0deg' }] }} />;
}

const DEFAULT_DRAFT: StudentNumberDraft = {
  prefix: '',
  suffix: '',
  separator: '',
  include_campus_code: false,
  include_department_code: false,
  include_academic_type: false,
  include_academic_year: false,
  include_admission_year: false,
  segment_order: ['prefix', 'school_code', 'campus_code', 'department_code', 'academic_type', 'academic_year', 'admission_year', 'running_number', 'suffix'],
  digit_length: 4,
  start_number: 1,
  reset_mode: 'never',
  year_format: 'full',
  uppercase: false,
  is_active: true,
};

/**
 * Replaces the old "Student Numbers" + "Student ID Rules" screens (the
 * second of which never actually did anything - see studentNumberService.ts's
 * own docblock on the backend split). One screen, two tabs (Students /
 * Staff) - each tab is its own independent format + counter on the
 * backend (StudentNumberFormat.target_type), so a student prefix like
 * "STU" and a staff prefix like "STF" count on their own, never colliding.
 *
 * Defaults to the simple fields (prefix, starting number) since that's
 * the mental model most admins actually have - the rest of the existing
 * format power (segments, yearly reset, etc.) is still here, just tucked
 * behind "Advanced".
 */
export default function StudentStaffCodeSetupScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();
  const { t } = useLocale();

  const [tab, setTab] = useState<TargetType>('student');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<StudentNumberConfig | null>(null);
  const [draft, setDraft] = useState<StudentNumberDraft>(DEFAULT_DRAFT);
  const [preview, setPreview] = useState<string>('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (targetType: TargetType) => {
    if (!token) return;
    setError(null);
    setIsLoading(true);
    try {
      const data = await fetchStudentNumberConfig(token, targetType);
      setConfig(data.config);
      setDraft(toDraft(data.config));
      setPreview(data.preview.sample);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('code_setup.load_error', 'Failed to load this setting.'));
    } finally {
      setIsLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  // Debounced live preview against the server - never persisted, safe to
  // call on every edit (see studentNumberService.ts's own note on this).
  useEffect(() => {
    if (!token || isLoading) return;
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(async () => {
      try {
        const result = await previewStudentNumber(token, draft, tab);
        setPreview(result.preview.sample);
      } catch {
        // silent - the preview is a nice-to-have, not required to save
      }
    }, 350);
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, tab, token, isLoading]);

  const set = <K extends keyof StudentNumberDraft>(key: K, value: StudentNumberDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!token) return;
    setIsSaving(true);
    try {
      const result = await saveStudentNumberConfig(token, draft, tab);
      setConfig(result.config);
      setPreview(result.preview.sample);
      Alert.alert(
        t('common.done', 'Done'),
        tab === 'student'
          ? t('code_setup.saved_student', 'Student codes will now follow this format.')
          : t('code_setup.saved_staff', 'Staff codes will now follow this format.'),
      );
    } catch (err) {
      Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('common.try_again_full', 'Please try again.'));
    } finally {
      setIsSaving(false);
    }
  };

  const wasEverIssued = (config?.updated_at ?? null) !== null || preview !== '';

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={10}>
          <ChevronLeftIcon color={INK} />
          <Text style={styles.backText}>{t('common.back', 'Back')}</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>{t('code_setup.header_title', 'Student & Staff Codes')}</Text>
        </View>
        <View style={{ minWidth: 72 }} />
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tab, tab === 'student' && styles.tabActive]} onPress={() => setTab('student')}>
          <Text style={[styles.tabText, tab === 'student' && styles.tabTextActive]}>{t('code_setup.tab_students', 'Students')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'staff' && styles.tabActive]} onPress={() => setTab('staff')}>
          <Text style={[styles.tabText, tab === 'staff' && styles.tabTextActive]}>{t('code_setup.tab_staff', 'Staff')}</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={EMERALD} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => load(tab)} style={styles.retryButton}>
            <Text style={styles.retryText}>{t('common.try_again', 'Try again')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.previewCard}>
            <Text style={styles.previewLabel}>
              {tab === 'student'
                ? t('code_setup.preview_label_student', 'Next student code will look like')
                : t('code_setup.preview_label_staff', 'Next staff code will look like')}
            </Text>
            <Text style={styles.previewValue}>{preview || '—'}</Text>
          </View>

          <Text style={styles.fieldLabel}>{t('code_setup.prefix_label', 'Prefix letters')}</Text>
          <TextInput
            style={styles.fieldInput}
            placeholder={tab === 'student' ? 'STU' : 'STF'}
            placeholderTextColor={SUBTLE}
            value={draft.prefix}
            onChangeText={(v) => set('prefix', v.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            autoCapitalize="characters"
            maxLength={16}
          />

          <Text style={styles.fieldLabel}>{t('code_setup.start_number_label', 'Starting number')}</Text>
          <TextInput
            style={styles.fieldInput}
            placeholder="1"
            placeholderTextColor={SUBTLE}
            value={String(draft.start_number)}
            onChangeText={(v) => set('start_number', Math.max(0, parseInt(v.replace(/\D/g, ''), 10) || 0))}
            keyboardType="number-pad"
          />
          {wasEverIssued ? (
            <Text style={styles.helperText}>
              {t('code_setup.start_number_helper', "Changing this only affects a counter that hasn't issued anything yet - it never rewinds one that has.")}
            </Text>
          ) : null}

          <TouchableOpacity style={styles.advancedToggle} onPress={() => setAdvancedOpen((v) => !v)}>
            <Text style={styles.advancedToggleText}>{t('code_setup.advanced', 'Advanced')}</Text>
            <ChevronDownIcon color={SUBTLE} up={advancedOpen} />
          </TouchableOpacity>

          {advancedOpen ? (
            <View>
              <Text style={styles.fieldLabel}>{t('code_setup.digit_length_label', 'Digits (zero-padded)')}</Text>
              <TextInput
                style={styles.fieldInput}
                value={String(draft.digit_length)}
                onChangeText={(v) => set('digit_length', Math.min(12, Math.max(1, parseInt(v.replace(/\D/g, ''), 10) || 1)))}
                keyboardType="number-pad"
              />

              <Text style={styles.fieldLabel}>{t('code_setup.suffix_label', 'Suffix (optional)')}</Text>
              <TextInput
                style={styles.fieldInput}
                value={draft.suffix}
                onChangeText={(v) => set('suffix', v)}
                maxLength={16}
              />

              <Text style={styles.fieldLabel}>{t('code_setup.separator_label', 'Separator')}</Text>
              <View style={styles.separatorRow}>
                {(['', '-', '/', '.', '_'] as const).map((sep) => (
                  <TouchableOpacity
                    key={sep || 'none'}
                    style={[styles.sepChip, draft.separator === sep && styles.sepChipActive]}
                    onPress={() => set('separator', sep)}
                  >
                    <Text style={[styles.sepChipText, draft.separator === sep && styles.sepChipTextActive]}>
                      {sep === '' ? t('code_setup.separator_none', 'None') : sep}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.switchRow}>
                <View style={styles.flex1}>
                  <Text style={styles.switchLabel}>{t('code_setup.reset_yearly_label', 'Reset counter every year')}</Text>
                  <Text style={styles.switchDesc}>{t('code_setup.reset_yearly_desc', 'Off = the counter never resets (continuous).')}</Text>
                </View>
                <Switch
                  value={draft.reset_mode === 'yearly'}
                  onValueChange={(v) => set('reset_mode', v ? 'yearly' : 'never')}
                  trackColor={{ true: EMERALD, false: HAIRLINE }}
                />
              </View>

              {tab === 'student' ? (
                <View style={styles.switchRow}>
                  <View style={styles.flex1}>
                    <Text style={styles.switchLabel}>{t('code_setup.admission_year_label', 'Include admission year')}</Text>
                  </View>
                  <Switch
                    value={draft.include_admission_year}
                    onValueChange={(v) => set('include_admission_year', v)}
                    trackColor={{ true: EMERALD, false: HAIRLINE }}
                  />
                </View>
              ) : null}

              <View style={styles.switchRow}>
                <View style={styles.flex1}>
                  <Text style={styles.switchLabel}>{t('code_setup.academic_year_label', 'Include current academic year')}</Text>
                </View>
                <Switch
                  value={draft.include_academic_year}
                  onValueChange={(v) => set('include_academic_year', v)}
                  trackColor={{ true: EMERALD, false: HAIRLINE }}
                />
              </View>

              <View style={styles.switchRow}>
                <View style={styles.flex1}>
                  <Text style={styles.switchLabel}>{t('code_setup.campus_code_label', 'Include campus code')}</Text>
                </View>
                <Switch
                  value={draft.include_campus_code}
                  onValueChange={(v) => set('include_campus_code', v)}
                  trackColor={{ true: EMERALD, false: HAIRLINE }}
                />
              </View>

              <View style={styles.switchRow}>
                <View style={styles.flex1}>
                  <Text style={styles.switchLabel}>{t('code_setup.department_code_label', 'Include department code')}</Text>
                </View>
                <Switch
                  value={draft.include_department_code}
                  onValueChange={(v) => set('include_department_code', v)}
                  trackColor={{ true: EMERALD, false: HAIRLINE }}
                />
              </View>
            </View>
          ) : null}

          <TouchableOpacity style={[styles.saveButton, isSaving && { opacity: 0.6 }]} onPress={handleSave} disabled={isSaving}>
            {isSaving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>{t('common.save', 'Save')}</Text>}
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: 'transparent' },
  flex1: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: GLASS_SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: GLASS_BORDER,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', minWidth: 72 },
  backText: { color: EMERALD, fontSize: 16, fontWeight: '600', marginLeft: 2 },
  headerTitleWrap: { alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: INK },

  tabRow: { flexDirection: 'row', marginHorizontal: 16, marginTop: 16, gap: 10 },
  tab: {
    flex: 1,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: EMERALD, borderColor: EMERALD },
  tabText: { fontSize: 14, fontWeight: '700', color: INK },
  tabTextActive: { color: '#FFFFFF' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  errorText: { color: DANGER, textAlign: 'center', marginBottom: 12 },
  retryButton: { backgroundColor: '#EEF0F2', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  retryText: { color: INK, fontWeight: '600' },

  content: { padding: 16, paddingBottom: 60 },
  previewCard: {
    backgroundColor: EMERALD_SOFT,
    borderRadius: RADIUS.lg,
    padding: 18,
    alignItems: 'center',
    marginBottom: 20,
  },
  previewLabel: { fontSize: 12.5, color: EMERALD, fontWeight: '600' },
  previewValue: { fontSize: 24, color: EMERALD, fontWeight: '800', marginTop: 6, letterSpacing: 1 },

  fieldLabel: { fontSize: 13, fontWeight: '600', color: INK, marginBottom: 8, marginTop: 14 },
  fieldInput: {
    backgroundColor: GLASS_SURFACE,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: INK,
    borderWidth: 1,
    borderColor: HAIRLINE,
    ...SHADOW.level1,
  },
  helperText: { fontSize: 12, color: SUBTLE, marginTop: 6, lineHeight: 17 },

  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
  },
  advancedToggleText: { fontSize: 13, fontWeight: '700', color: SUBTLE, textTransform: 'uppercase', letterSpacing: 0.5 },

  separatorRow: { flexDirection: 'row', gap: 8 },
  sepChip: { borderRadius: RADIUS.pill, borderWidth: 1, borderColor: HAIRLINE, paddingHorizontal: 14, paddingVertical: 8 },
  sepChipActive: { backgroundColor: EMERALD, borderColor: EMERALD },
  sepChipText: { fontSize: 14, fontWeight: '600', color: INK },
  sepChipTextActive: { color: '#FFFFFF' },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
  },
  switchLabel: { fontSize: 13.5, fontWeight: '600', color: INK },
  switchDesc: { fontSize: 11.5, color: SUBTLE, marginTop: 2 },

  saveButton: {
    backgroundColor: EMERALD,
    borderRadius: RADIUS.pill,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  saveButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
