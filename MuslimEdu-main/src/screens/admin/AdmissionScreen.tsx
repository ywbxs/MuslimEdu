import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path, Circle, Rect, Line, Polyline } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { EMERALD, EMERALD_SOFT, INK, SUBTLE } from '../dashboards/DashboardShell';
import {
  admitStudent,
  fetchClasses,
  fetchSections,
  findPossibleDuplicates,
  AdmissionInput,
  ClassOption,
  SectionOption,
} from '../../services/adminService';

const DANGER_SOFT = '#FDECEA';
const BORDER = '#E7ECE9';
const CARD_BG = '#FFFFFF';
const PAGE_BG = '#F6F8F7';

// ---------------------------------------------------------------------------
// Icons - small inline SVGs, matching the style already used across the app
// (see StudentDashboard.tsx) so this screen doesn't need a new icon library.
// ---------------------------------------------------------------------------
type IconProps = { color?: string; size?: number };

function PersonIcon({ color = SUBTLE, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={4} stroke={color} strokeWidth={2} />
      <Path d="M4 20c0-3.3 3.6-5 8-5s8 1.7 8 5" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function MailIcon({ color = SUBTLE, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={5} width={18} height={14} rx={2} stroke={color} strokeWidth={2} />
      <Path d="M4 7l8 6 8-6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function PhoneIcon({ color = SUBTLE, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 3h3l1.5 4.5-2 1.5a11 11 0 0 0 5.5 5.5l1.5-2L20 14v3a2 2 0 0 1-2 2C10.8 19 5 13.2 5 6a2 2 0 0 1 1-3z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
function LockIcon({ color = SUBTLE, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={5} y={11} width={14} height={9} rx={2} stroke={color} strokeWidth={2} />
      <Path d="M8 11V8a4 4 0 0 1 8 0v3" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function EyeIcon({ color = SUBTLE, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={2} />
    </Svg>
  );
}
function EyeOffIcon({ color = SUBTLE, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M6.5 6.7C3.9 8.3 2 12 2 12s3.6 7 10 7c1.8 0 3.4-.4 4.7-1.1M9.9 5.2C10.6 5.1 11.3 5 12 5c6.4 0 10 7 10 7-.5.9-1.4 2.2-2.6 3.4"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
function IdCardIcon({ color = SUBTLE, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={5} width={18} height={14} rx={2} stroke={color} strokeWidth={2} />
      <Circle cx={8.5} cy={11} r={2} stroke={color} strokeWidth={2} />
      <Line x1={13} y1={10} x2={17} y2={10} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={13} y1={14} x2={17} y2={14} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function BookIcon({ color = SUBTLE, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 5.5C4 4.7 4.7 4 5.5 4H12v16H5.5A1.5 1.5 0 0 1 4 18.5v-13z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H12v16h6.5c.8 0 1.5-.7 1.5-1.5v-13z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}
function UsersIcon({ color = SUBTLE, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={9} cy={8} r={3} stroke={color} strokeWidth={1.8} />
      <Path d="M3 20c0-2.8 2.7-4.5 6-4.5s6 1.7 6 4.5" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Circle cx={17} cy={8.5} r={2.3} stroke={color} strokeWidth={1.8} />
      <Path d="M15.3 15.3c2.6.3 4.7 1.8 4.7 4.2" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function HeartIcon({ color = SUBTLE, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 20s-7.5-4.6-9.5-9.1C1.2 7.8 3 4.8 6.2 4.5c1.9-.2 3.6.8 5.8 3 2.2-2.2 3.9-3.2 5.8-3 3.2.3 5 3.3 3.7 6.4C19.5 15.4 12 20 12 20z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
function NoteIcon({ color = SUBTLE, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 20h4L18 10l-4-4L4 16v4z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Line x1={13} y1={7} x2={17} y2={11} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function ShieldIcon({ color = SUBTLE, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3l7 3v5c0 5-3.2 8.4-7 10-3.8-1.6-7-5-7-10V6l7-3z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M9 12l2 2 4-4" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function ChevronLeftIcon({ color = EMERALD, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline points="15 5 8 12 15 19" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function CheckIcon({ color = '#FFFFFF', size = 14 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline points="5 13 10 18 19 6" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------
type StepKey = 'basic' | 'account' | 'class' | 'orphan' | 'review';

type FieldDef = {
  key: keyof AdmissionInput;
  label: string;
  required?: boolean;
  keyboard?: 'default' | 'email-address' | 'phone-pad';
  secure?: boolean;
  helper?: string;
  icon: (props: IconProps) => JSX.Element;
  multiline?: boolean;
};

const BASIC_FIELDS: FieldDef[] = [
  { key: 'name', label: 'Full name', required: true, icon: PersonIcon },
  { key: 'email', label: 'Email', keyboard: 'email-address', icon: MailIcon },
  { key: 'phone', label: 'Phone', keyboard: 'phone-pad', icon: PhoneIcon },
];

const ACCOUNT_FIELDS: FieldDef[] = [
  {
    key: 'password',
    label: 'Password',
    secure: true,
    icon: LockIcon,
    helper: 'Login password for this student. Leave blank to auto-generate one.',
  },
  { key: 'guardian_name', label: 'Guardian name', icon: PersonIcon },
  { key: 'code', label: 'Student code', icon: IdCardIcon },
];

const ORPHAN_FIELDS: FieldDef[] = [
  { key: 'orphan_id_number', label: 'Orphan ID number', icon: IdCardIcon },
  { key: 'guardian_relation', label: 'Guardian relation', icon: UsersIcon, helper: 'e.g. Uncle, Grandmother' },
  { key: 'guardian_phone', label: 'Guardian phone', keyboard: 'phone-pad', icon: PhoneIcon },
  { key: 'health_status', label: 'Health status', icon: HeartIcon },
  { key: 'special_needs', label: 'Special needs', icon: ShieldIcon },
  { key: 'admission_reason', label: 'Admission reason', icon: NoteIcon, multiline: true },
];

export default function AdmissionScreen() {
  const navigation = useNavigation();
  const { token, user } = useAuth();
  const isOrphanSchool = !!user?.is_orphan;

  const steps: StepKey[] = useMemo(
    () => (isOrphanSchool ? ['basic', 'account', 'class', 'orphan', 'review'] : ['basic', 'account', 'class', 'review']),
    [isOrphanSchool],
  );

  const [stepIndex, setStepIndex] = useState(0);
  const step = steps[stepIndex];

  const [form, setForm] = useState<AdmissionInput>({ name: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);

  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [sections, setSections] = useState<SectionOption[]>([]);

  const set = (key: keyof AdmissionInput, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    if (!token) return;
    fetchClasses(token)
      .then(setClasses)
      .catch(() => {
        /* silent - picker just stays empty, admin can still submit name-only */
      });
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetchSections(token, form.class_id)
      .then(setSections)
      .catch(() => setSections([]));
  }, [token, form.class_id]);

  const runSubmit = async () => {
    if (!token) return;
    setSubmitting(true);
    try {
      const student = await admitStudent(token, form);
      Alert.alert('Admitted', `${student.name} has been added.`, [
        { text: 'OK', onPress: () => (navigation as any).goBack() },
      ]);
    } catch (err: any) {
      Alert.alert('Could not admit', err?.message ?? 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  const onFinalSubmit = async () => {
    if (!form.name?.trim()) {
      setStepIndex(0);
      Alert.alert('Missing name', 'A student needs at least a full name.');
      return;
    }
    if (!token) {
      Alert.alert('Not signed in', 'Your session expired. Please log in again.');
      return;
    }

    setCheckingDuplicate(true);
    try {
      const duplicates = await findPossibleDuplicates(token, form.name);
      setCheckingDuplicate(false);
      if (duplicates.length > 0) {
        Alert.alert(
          'Possible duplicate',
          `A student named "${form.name.trim()}" is already in your school. Add another one anyway?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Add anyway', style: 'destructive', onPress: runSubmit },
          ],
        );
        return;
      }
    } catch {
      setCheckingDuplicate(false);
    }

    await runSubmit();
  };

  const goNext = () => {
    if (step === 'basic' && !form.name?.trim()) {
      Alert.alert('Missing name', 'A student needs at least a full name.');
      return;
    }
    if (stepIndex < steps.length - 1) {
      setStepIndex(stepIndex + 1);
    }
  };

  const goBack = () => {
    if (stepIndex > 0) setStepIndex(stepIndex - 1);
    else (navigation as any).goBack();
  };

  const busy = submitting || checkingDuplicate;

  // -------------------------------------------------------------------------
  // Shared field renderer - icon-prefixed rounded input, matches the modern
  // reference design (icon inside a soft rounded box on the left).
  // -------------------------------------------------------------------------
  const renderField = (f: FieldDef) => {
    const Icon = f.icon;
    const isPassword = !!f.secure;
    return (
      <View key={f.key} style={styles.fieldWrap}>
        <Text style={styles.label}>
          {f.label}
          {f.required ? ' *' : ''}
        </Text>
        <View style={[styles.inputRow, f.multiline && styles.inputRowMultiline]}>
          <View style={styles.inputIcon}>
            <Icon color={SUBTLE} size={17} />
          </View>
          <TextInput
            style={[styles.input, f.multiline && styles.inputMultiline]}
            value={(form[f.key] as string) ?? ''}
            onChangeText={(t) => set(f.key, t)}
            keyboardType={f.keyboard ?? 'default'}
            autoCapitalize={f.key === 'email' || isPassword ? 'none' : 'words'}
            secureTextEntry={isPassword && !showPassword}
            multiline={f.multiline}
            numberOfLines={f.multiline ? 3 : 1}
            placeholder={f.label}
            placeholderTextColor="#B7BEC2"
          />
          {isPassword ? (
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {showPassword ? <EyeOffIcon color={SUBTLE} size={18} /> : <EyeIcon color={SUBTLE} size={18} />}
            </TouchableOpacity>
          ) : null}
        </View>
        {f.helper ? <Text style={styles.helper}>{f.helper}</Text> : null}
      </View>
    );
  };

  const renderChips = (
    label: string,
    Icon: (p: IconProps) => JSX.Element,
    options: { id: number; name: string }[],
    selectedId: string | undefined,
    onSelect: (id: string) => void,
    emptyText: string,
  ) => (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      {options.length === 0 ? (
        <View style={styles.emptyChipBox}>
          <Icon color="#B7BEC2" size={16} />
          <Text style={styles.emptyChipText}>{emptyText}</Text>
        </View>
      ) : (
        <View style={styles.chipRow}>
          {options.map((opt) => {
            const active = selectedId === String(opt.id);
            return (
              <TouchableOpacity
                key={opt.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => onSelect(String(opt.id))}
                activeOpacity={0.85}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );

  const stepMeta: Record<StepKey, { title: string; subtitle: string; icon: (p: IconProps) => JSX.Element }> = {
    basic: { title: 'Basic information', subtitle: "Let's start with the student's name and contact details.", icon: PersonIcon },
    account: { title: 'Account & guardian', subtitle: 'Set login access and who to reach for this student.', icon: LockIcon },
    class: { title: 'Class & section', subtitle: 'Place the student into a class and section.', icon: BookIcon },
    orphan: { title: 'Orphan details', subtitle: 'This school is registered as an orphanage, so these details help complete the profile.', icon: ShieldIcon },
    review: { title: 'Review & confirm', subtitle: 'Check everything looks right before admitting.', icon: CheckIconWrap },
  };

  function CheckIconWrap(p: IconProps) {
    return <CheckIcon {...p} color={p.color === SUBTLE ? SUBTLE : EMERALD} />;
  }

  const meta = stepMeta[step];
  const StepIcon = meta.icon;

  const classSelected = classes.find((c) => String(c.id) === form.class_id);
  const sectionSelected = sections.find((s) => String(s.id) === form.section_id);

  const reviewRows: { label: string; value: string }[] = [
    { label: 'Full name', value: form.name || '—' },
    { label: 'Email', value: form.email || '—' },
    { label: 'Phone', value: form.phone || '—' },
    { label: 'Password', value: form.password ? '••••••••' : 'Auto-generated' },
    { label: 'Guardian name', value: form.guardian_name || '—' },
    { label: 'Student code', value: form.code || '—' },
    { label: 'Class', value: classSelected?.name || '—' },
    { label: 'Section', value: sectionSelected?.name || '—' },
    ...(isOrphanSchool
      ? [
          { label: 'Orphan ID number', value: form.orphan_id_number || '—' },
          { label: 'Guardian relation', value: form.guardian_relation || '—' },
          { label: 'Guardian phone', value: form.guardian_phone || '—' },
          { label: 'Health status', value: form.health_status || '—' },
          { label: 'Special needs', value: form.special_needs || '—' },
          { label: 'Admission reason', value: form.admission_reason || '—' },
        ]
      : []),
  ];

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={goBack} style={styles.backRow} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ChevronLeftIcon color={EMERALD} size={20} />
          <Text style={styles.backText}>{stepIndex === 0 ? 'Back' : 'Previous'}</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>New Admission</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Progress indicator */}
      <View style={styles.progressWrap}>
        {steps.map((s, i) => {
          const done = i < stepIndex;
          const current = i === stepIndex;
          return (
            <React.Fragment key={s}>
              <View style={styles.progressStep}>
                <View style={[styles.progressDot, (done || current) && styles.progressDotActive, done && styles.progressDotDone]}>
                  {done ? <CheckIcon size={11} /> : <Text style={[styles.progressDotText, current && styles.progressDotTextActive]}>{i + 1}</Text>}
                </View>
              </View>
              {i < steps.length - 1 ? (
                <View style={[styles.progressLine, done && styles.progressLineDone]} />
              ) : null}
            </React.Fragment>
          );
        })}
      </View>
      <Text style={styles.progressCaption}>
        Step {stepIndex + 1} of {steps.length}
      </Text>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderIcon}>
              <StepIcon color={EMERALD} size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{meta.title}</Text>
              <Text style={styles.cardSubtitle}>{meta.subtitle}</Text>
            </View>
          </View>

          {step === 'basic' ? BASIC_FIELDS.map(renderField) : null}
          {step === 'account' ? ACCOUNT_FIELDS.map(renderField) : null}
          {step === 'class' ? (
            <>
              {renderChips('Class', BookIcon, classes, form.class_id, (id) =>
                setForm((prev) => ({ ...prev, class_id: id, section_id: undefined })), 'No classes yet - you can still continue.')}
              {renderChips('Section', UsersIcon, sections, form.section_id, (id) => set('section_id', id), 'Pick a class first, or continue without one.')}
            </>
          ) : null}
          {step === 'orphan' ? (
            <View style={styles.orphanBanner}>{ORPHAN_FIELDS.map(renderField)}</View>
          ) : null}
          {step === 'review' ? (
            <View>
              {reviewRows.map((r) => (
                <View key={r.label} style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>{r.label}</Text>
                  <Text style={styles.reviewValue} numberOfLines={2}>{r.value}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {stepIndex > 0 ? (
          <TouchableOpacity style={styles.footerBackButton} onPress={goBack} disabled={busy} activeOpacity={0.85}>
            <Text style={styles.footerBackText}>Back</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={[styles.footerNextButton, stepIndex === 0 && { flex: 1 }, busy && styles.buttonDisabled]}
          onPress={step === 'review' ? onFinalSubmit : goNext}
          disabled={busy}
          activeOpacity={0.85}
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.footerNextText}>{step === 'review' ? 'Admit Student' : 'Continue'}</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: PAGE_BG },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingBottom: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  backRow: { flexDirection: 'row', alignItems: 'center', width: 60 },
  backText: { color: EMERALD, fontSize: 15, fontWeight: '600', marginLeft: 2 },
  topTitle: { fontSize: 17, fontWeight: '800', color: INK },

  progressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 18,
    backgroundColor: '#FFFFFF',
  },
  progressStep: { alignItems: 'center' },
  progressDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#EDEFEE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDotActive: { backgroundColor: EMERALD_SOFT, borderWidth: 2, borderColor: EMERALD },
  progressDotDone: { backgroundColor: EMERALD, borderWidth: 0 },
  progressDotText: { fontSize: 11, fontWeight: '700', color: SUBTLE },
  progressDotTextActive: { color: EMERALD },
  progressLine: { flex: 1, height: 2, backgroundColor: '#EDEFEE', marginHorizontal: 4 },
  progressLineDone: { backgroundColor: EMERALD },
  progressCaption: {
    textAlign: 'center',
    fontSize: 12,
    color: SUBTLE,
    fontWeight: '600',
    paddingTop: 8,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
  },

  content: { padding: 16, paddingBottom: 24 },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: BORDER,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  cardHeaderIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardTitle: { fontSize: 17, fontWeight: '800', color: INK },
  cardSubtitle: { fontSize: 12.5, color: SUBTLE, marginTop: 2, lineHeight: 17 },

  fieldWrap: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: INK, marginBottom: 6 },
  helper: { fontSize: 12, color: SUBTLE, marginTop: 6 },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F9F8',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 4,
  },
  inputRowMultiline: { alignItems: 'flex-start', paddingVertical: 4 },
  inputIcon: { width: 38, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, paddingVertical: 14, paddingRight: 14, fontSize: 15, color: INK },
  inputMultiline: { minHeight: 72, textAlignVertical: 'top', paddingTop: 12 },
  eyeButton: { paddingHorizontal: 12, paddingVertical: 10 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: EMERALD_SOFT },
  chipActive: { backgroundColor: EMERALD },
  chipText: { fontSize: 14, fontWeight: '600', color: EMERALD },
  chipTextActive: { color: '#FFFFFF' },
  emptyChipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F7F9F8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    borderStyle: 'dashed',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  emptyChipText: { fontSize: 13, color: SUBTLE },

  orphanBanner: { backgroundColor: DANGER_SOFT, borderRadius: 16, padding: 14, marginTop: -4 },

  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F1',
    gap: 12,
  },
  reviewLabel: { fontSize: 13, color: SUBTLE, fontWeight: '600', flexShrink: 0 },
  reviewValue: { fontSize: 13, color: INK, fontWeight: '600', flex: 1, textAlign: 'right' },

  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  footerBackButton: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#F1F3F2',
  },
  footerBackText: { color: INK, fontSize: 15, fontWeight: '700' },
  footerNextButton: {
    flex: 2,
    backgroundColor: EMERALD,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  footerNextText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  buttonDisabled: { opacity: 0.6 },
});
