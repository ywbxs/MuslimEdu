import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Platform,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { useAcademicGlassTheme, AcademicGlassTheme } from './academicGlassTheme';
import { RADIUS } from '../../theme/glass';
import { WizardStepHeader, WizardGradientButton } from '../../components/wizard/WizardKit';
import GlassBackground from '../../components/glass/GlassBackground';
import {
  ClassInput,
  ClassReferenceData,
  ClassShift,
  ClassType,
  ClassStatus,
  ClassSectionOption,
  fetchClassReferenceData,
  fetchClassRecordDetail,
  createClassRecord,
  updateClassRecord,
  fetchSectionsForClass,
} from '../../services/adminService';
import { Room as FacilityRoom, listRooms } from '../../services/academicFacilitiesService';

/**
 * Wizard rebuild of the old single long form - four short steps (Basics,
 * Academic Context, Schedule & Room, Dates & Status) instead of 16 fields
 * and 7 bottom-sheet pickers stacked in one scroll, matching the same
 * WizardStepHeader/glass pattern GradingSystemWizardScreen and the account
 * wizards already use.
 *
 * Also the fix for "Failed to load reference data": every request here used
 * to read its token from `AsyncStorage.getItem('token')`, which the real
 * auth flow never writes to (the session token lives in the device
 * Keychain - see authService.ts's saveToken/getStoredToken). Every request
 * was silently sending `Authorization: Bearer null` and getting rejected.
 * Now reads `token` from useAuth() like every other screen in the app.
 */

const SHIFTS: ClassShift[] = ['morning', 'afternoon', 'evening', 'full_day'];
const CLASS_TYPES: ClassType[] = ['face-to-face', 'online', 'hybrid'];
const STATUSES: ClassStatus[] = ['active', 'pending', 'closed', 'archived'];

const SHIFT_FALLBACKS: Record<ClassShift, string> = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', full_day: 'Full Day' };
const CLASS_TYPE_FALLBACKS: Record<ClassType, string> = { 'face-to-face': 'Face-to-face', online: 'Online', hybrid: 'Hybrid' };
const STATUS_FALLBACKS: Record<ClassStatus, string> = { active: 'Active', pending: 'Pending', closed: 'Closed', archived: 'Archived' };

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}
function oneYearFromTodayIso(): string {
  return new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
}
function parseDateValue(value: string): Date {
  const parsed = value ? new Date(value) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}
function formatDateValue(date: Date): string {
  return date.toISOString().split('T')[0];
}

function IconChevronLeft({ color }: { color: string }) {
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}

interface FormState {
  class_code: string;
  name: string;
  grade_level: string;
  section: string;
  school_year_id: string;
  department_id: string;
  campus_id: string;
  curriculum_id: string;
  semester_term_id: string;
  room_number: string;
  building: string;
  floor: string;
  shift: ClassShift;
  class_type: ClassType;
  max_capacity: string;
  description: string;
  status: ClassStatus;
  start_date: string;
  end_date: string;
}

const emptyForm: FormState = {
  class_code: '',
  name: '',
  grade_level: '',
  section: '',
  school_year_id: '',
  department_id: '',
  campus_id: '',
  curriculum_id: '',
  semester_term_id: '',
  room_number: '',
  building: '',
  floor: '',
  shift: 'morning',
  class_type: 'face-to-face',
  max_capacity: '50',
  description: '',
  status: 'active',
  start_date: todayIso(),
  end_date: oneYearFromTodayIso(),
};

type StepKey = 'basics' | 'academic' | 'schedule' | 'dates';
const STEP_ORDER: StepKey[] = ['basics', 'academic', 'schedule', 'dates'];

export default function CreateClassScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const theme = useAcademicGlassTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { token } = useAuth();
  const { t } = useLocale();

  const shiftLabel = (key: ClassShift) => t(`create_class.shift_${key}`, SHIFT_FALLBACKS[key]);
  const classTypeLabel = (key: ClassType) => t(`create_class.class_type_${key}`, CLASS_TYPE_FALLBACKS[key]);
  const statusLabel = (key: ClassStatus) => t(`create_class.status_${key}`, STATUS_FALLBACKS[key]);

  const classId: number | undefined = route.params?.classId;
  const isEditing = !!classId;

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [datePickerField, setDatePickerField] = useState<'start_date' | 'end_date' | null>(null);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [reference, setReference] = useState<ClassReferenceData>({
    departments: [], campuses: [], curricula: [], school_years: [], semester_terms: [],
  });
  // Rooms actually set up under Academic Facilities (Building > Room, with
  // floor already attached) - picking one fills room_number/building/floor
  // together instead of the admin retyping a building name/floor that may
  // not match what Facilities has, or duplicate-with-a-typo. classes.
  // room_number/building/floor stay plain strings on the backend (no
  // room_id FK there yet), so this is a fill-in shortcut, not a hard link -
  // manual entry still works for schools that haven't set up Facilities.
  const [rooms, setRooms] = useState<FacilityRoom[]>([]);
  // Real Section records (SectionListScreen/SectionForm) belong to a class,
  // so they can only be fetched/created once the class itself exists. For a
  // brand-new class this stays empty and the field falls back to free text.
  const [classSections, setClassSections] = useState<ClassSectionOption[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);

  const loadClassSections = async () => {
    if (!token || !classId) return;
    try {
      setSectionsLoading(true);
      setClassSections(await fetchSectionsForClass(token, classId));
    } catch {
      // Silent - falls back to the free-text field.
    } finally {
      setSectionsLoading(false);
    }
  };

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const pickRoom = (room: FacilityRoom) => {
    setForm((prev) => ({
      ...prev,
      room_number: room.code || room.name,
      building: room.building?.name ?? prev.building,
      floor: room.floor_number != null ? String(room.floor_number) : prev.floor,
    }));
  };

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        setLoading(true);
        const [ref, roomList] = await Promise.all([
          fetchClassReferenceData(token),
          listRooms(token).catch(() => []),
        ]);
        setReference(ref);
        setRooms(roomList);

        if (isEditing && classId) {
          const [record] = await Promise.all([fetchClassRecordDetail(token, classId), loadClassSections()]);
          setForm({
            class_code: record.class_code ?? '',
            name: record.name ?? '',
            grade_level: record.grade_level != null ? String(record.grade_level) : '',
            section: record.section ?? '',
            school_year_id: record.school_year_id != null ? String(record.school_year_id) : '',
            department_id: record.department_id != null ? String(record.department_id) : '',
            campus_id: record.campus_id != null ? String(record.campus_id) : '',
            curriculum_id: record.curriculum_id != null ? String(record.curriculum_id) : '',
            semester_term_id: record.semester_term_id != null ? String(record.semester_term_id) : '',
            room_number: record.room_number ?? '',
            building: record.building ?? '',
            floor: record.floor ?? '',
            shift: record.shift ?? 'morning',
            class_type: record.class_type ?? 'face-to-face',
            max_capacity: record.max_capacity != null ? String(record.max_capacity) : '50',
            description: record.description ?? '',
            status: record.status ?? 'active',
            start_date: record.start_date ?? todayIso(),
            end_date: record.end_date ?? oneYearFromTodayIso(),
          });
        }
      } catch (err) {
        setLoadError(
          err instanceof Error
            ? err.message
            : isEditing
            ? t('create_class.load_detail_error', 'Failed to load class details')
            : t('create_class.load_reference_error', 'Failed to load reference data')
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [token, isEditing, classId, t]);

  // Refresh the real Section list when coming back from SectionForm (e.g.
  // after adding one via the "+ Add Section" button below).
  useFocusEffect(
    React.useCallback(() => {
      if (isEditing && classId) loadClassSections();
    }, [isEditing, classId, token])
  );

  const stepKey = STEP_ORDER[step];
  const isLastStep = step === STEP_ORDER.length - 1;

  const validateStep = (key: StepKey): string | null => {
    if (key === 'basics') {
      if (!form.class_code.trim()) return t('create_class.error_class_code', 'Class code is required');
      if (!form.name.trim()) return t('create_class.error_class_name', 'Class name is required');
      if (!form.grade_level.trim()) return t('create_class.error_grade_level', 'Grade level is required');
    }
    if (key === 'academic') {
      if (!form.school_year_id) return t('create_class.error_school_year', 'School year is required');
    }
    if (key === 'schedule') {
      if (!form.max_capacity || parseInt(form.max_capacity, 10) < 1) {
        return t('create_class.error_max_capacity', 'Max capacity must be greater than 0');
      }
    }
    if (key === 'dates') {
      if (form.start_date > form.end_date) return t('create_class.error_date_order', 'Start date cannot be after end date');
    }
    return null;
  };

  const goNext = () => {
    const err = validateStep(stepKey);
    if (err) {
      setStepError(err);
      return;
    }
    setStepError(null);
    if (isLastStep) {
      onSave();
    } else {
      setStep((s) => Math.min(STEP_ORDER.length - 1, s + 1));
    }
  };

  const goBackStep = () => {
    setStepError(null);
    if (step === 0) {
      navigation.goBack();
      return;
    }
    setStep((s) => Math.max(0, s - 1));
  };

  const onSave = async () => {
    if (!token) {
      Alert.alert(t('common.error', 'Error'), t('create_class.session_expired', 'Your session expired. Please log in again.'));
      return;
    }
    setSubmitting(true);
    try {
      const input: ClassInput = {
        class_code: form.class_code.trim(),
        name: form.name.trim(),
        grade_level: parseInt(form.grade_level, 10),
        section: form.section.trim() || null,
        school_year_id: parseInt(form.school_year_id, 10),
        department_id: form.department_id ? parseInt(form.department_id, 10) : null,
        campus_id: form.campus_id ? parseInt(form.campus_id, 10) : null,
        curriculum_id: form.curriculum_id ? parseInt(form.curriculum_id, 10) : null,
        semester_term_id: form.semester_term_id ? parseInt(form.semester_term_id, 10) : null,
        room_number: form.room_number.trim() || null,
        building: form.building.trim() || null,
        floor: form.floor.trim() || null,
        shift: form.shift,
        class_type: form.class_type,
        max_capacity: parseInt(form.max_capacity, 10),
        description: form.description.trim() || null,
        status: form.status,
        start_date: form.start_date,
        end_date: form.end_date,
      };

      if (isEditing && classId) {
        await updateClassRecord(token, classId, input);
        Alert.alert(t('common.success', 'Success'), t('create_class.update_success', 'Class updated successfully'), [
          { text: t('common.ok', 'OK'), onPress: () => (navigation as any).navigate('ClassDetail', { classId }) },
        ]);
      } else {
        const created = await createClassRecord(token, input);
        Alert.alert(t('common.success', 'Success'), t('create_class.create_success', 'Class created successfully'), [
          { text: t('common.ok', 'OK'), onPress: () => (navigation as any).navigate('ClassDetail', { classId: created.id }) },
        ]);
      }
    } catch (err) {
      Alert.alert(
        t('common.error', 'Error'),
        err instanceof Error ? err.message : isEditing ? t('create_class.update_error', 'Failed to update class') : t('create_class.create_error', 'Failed to create class')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const onChangeDate = (event: DateTimePickerEvent, selectedDate?: Date) => {
    const field = datePickerField;
    if (Platform.OS === 'android') {
      setDatePickerField(null);
      if (event.type === 'set' && selectedDate && field) set(field, formatDateValue(selectedDate));
      return;
    }
    if (selectedDate && field) set(field, formatDateValue(selectedDate));
  };

  const stepLabels = [
    t('create_class.step_basics', 'Basics'),
    t('create_class.step_academic', 'Academic'),
    t('create_class.step_schedule', 'Schedule'),
    t('create_class.step_dates', 'Dates'),
  ];

  if (loading) {
    return (
      <View style={styles.container}>
        <GlassBackground variant="canvas" />
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
            <IconChevronLeft color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, styles.headerTitleFlex]}>
            {isEditing ? t('create_class.edit_title', 'Edit Class') : t('create_class.create_title', 'Create New Class')}
          </Text>
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
        <TouchableOpacity onPress={goBackStep} hitSlop={10} style={styles.backButton}>
          <IconChevronLeft color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, styles.headerTitleFlex]}>
          {isEditing ? t('create_class.edit_title', 'Edit Class') : t('create_class.create_title', 'Create New Class')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <WizardStepHeader step={step + 1} labels={stepLabels} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {loadError ? <Text style={styles.errorText}>{loadError}</Text> : null}

        {stepKey === 'basics' ? (
          <>
            <Text style={styles.stepTitle}>{t('create_class.basics_title', "Let's set up the class")}</Text>
            <Text style={styles.stepSubtitle}>
              {t('create_class.basics_subtitle', 'A code, a name, and the grade it belongs to.')}
            </Text>

            <Text style={styles.label}>{t('create_class.class_code_label', 'Class Code')} *</Text>
            <TextInput
              style={styles.input}
              placeholder={t('create_class.class_code_placeholder', 'e.g., 9-A-2024')}
              value={form.class_code}
              onChangeText={(v) => set('class_code', v.toUpperCase())}
              placeholderTextColor={theme.textMuted}
              autoCapitalize="characters"
            />

            <Text style={styles.label}>{t('create_class.class_name_label', 'Class Name')} *</Text>
            <TextInput
              style={styles.input}
              placeholder={t('create_class.class_name_placeholder', 'e.g., Class 9-A')}
              value={form.name}
              onChangeText={(v) => set('name', v)}
              placeholderTextColor={theme.textMuted}
            />

            <View style={styles.row}>
              <View style={styles.rowField}>
                <Text style={styles.label}>{t('create_class.grade_level_label', 'Grade Level')} *</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('create_class.grade_level_placeholder', '1-12')}
                  value={form.grade_level}
                  onChangeText={(v) => set('grade_level', v)}
                  keyboardType="number-pad"
                  placeholderTextColor={theme.textMuted}
                />
              </View>
              <View style={styles.rowField}>
                <Text style={styles.label}>{t('create_class.section_label', 'Section')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('create_class.section_placeholder', 'e.g., A')}
                  value={form.section}
                  onChangeText={(v) => set('section', v)}
                  placeholderTextColor={theme.textMuted}
                />
              </View>
            </View>

            {isEditing && classId ? (
              classSections.length > 0 ? (
                <>
                  <Text style={styles.label}>{t('create_class.pick_section_label', 'Or pick an existing section')}</Text>
                  <View style={styles.chipGrid}>
                    {classSections.map((sec) => {
                      const selected = form.section === sec.name;
                      return (
                        <TouchableOpacity
                          key={sec.id}
                          style={[styles.chip, selected && styles.chipSelected]}
                          onPress={() => set('section', sec.name)}
                        >
                          <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{sec.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                    <TouchableOpacity
                      style={styles.addSectionChip}
                      onPress={() => (navigation as any).navigate('SectionForm', { classId })}
                    >
                      <Text style={styles.addSectionChipText}>{t('create_class.add_section', '+ Add Section')}</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : !sectionsLoading ? (
                <View style={styles.emptySectionBox}>
                  <Text style={styles.emptySectionText}>
                    {t('create_class.no_sections_yet', "This class doesn't have any sections yet.")}
                  </Text>
                  <TouchableOpacity
                    style={styles.emptySectionButton}
                    onPress={() => (navigation as any).navigate('SectionForm', { classId })}
                  >
                    <Text style={styles.emptySectionButtonText}>{t('create_class.add_section', '+ Add Section')}</Text>
                  </TouchableOpacity>
                </View>
              ) : null
            ) : (
              <Text style={styles.emptyOptionsText}>
                {t('create_class.sections_after_create', 'Sections can be added once this class is created.')}
              </Text>
            )}
          </>
        ) : null}

        {stepKey === 'academic' ? (
          <>
            <Text style={styles.stepTitle}>{t('create_class.academic_title', 'Academic context')}</Text>
            <Text style={styles.stepSubtitle}>
              {t('create_class.academic_subtitle', 'Which school year this class runs in - the rest are optional.')}
            </Text>

            <ChipField
              label={t('create_class.school_year_label', 'School Year') + ' *'}
              options={reference.school_years.map((sy) => ({ id: sy.id, name: sy.session_title || sy.title || sy.name || String(sy.id) }))}
              value={form.school_year_id}
              onChange={(v) => set('school_year_id', v)}
              theme={theme}
              emptyLabel={t('create_class.no_school_years', 'No school years set up yet.')}
            />
            <ChipField
              label={t('create_class.department_label', 'Department (optional)')}
              options={reference.departments}
              value={form.department_id}
              onChange={(v) => set('department_id', v)}
              theme={theme}
              clearable
            />
            <ChipField
              label={t('create_class.campus_label', 'Campus (optional)')}
              options={reference.campuses}
              value={form.campus_id}
              onChange={(v) => set('campus_id', v)}
              theme={theme}
              clearable
            />
            <ChipField
              label={t('create_class.curriculum_label', 'Curriculum (optional)')}
              options={reference.curricula}
              value={form.curriculum_id}
              onChange={(v) => set('curriculum_id', v)}
              theme={theme}
              clearable
            />
            <ChipField
              label={t('create_class.semester_term_label', 'Semester/Term (optional)')}
              options={reference.semester_terms}
              value={form.semester_term_id}
              onChange={(v) => set('semester_term_id', v)}
              theme={theme}
              clearable
            />
          </>
        ) : null}

        {stepKey === 'schedule' ? (
          <>
            <Text style={styles.stepTitle}>{t('create_class.schedule_title', 'Schedule & room')}</Text>
            <Text style={styles.stepSubtitle}>
              {t('create_class.schedule_subtitle', 'When it meets and how many students it holds.')}
            </Text>

            <Text style={styles.label}>{t('create_class.shift_label', 'Shift')} *</Text>
            <View style={styles.chipGrid}>
              {SHIFTS.map((s) => {
                const selected = form.shift === s;
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => set('shift', s)}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{shiftLabel(s)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>{t('create_class.class_type_label', 'Class Type')} *</Text>
            <View style={styles.chipGrid}>
              {CLASS_TYPES.map((ctype) => {
                const selected = form.class_type === ctype;
                return (
                  <TouchableOpacity
                    key={ctype}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => set('class_type', ctype)}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{classTypeLabel(ctype)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>{t('create_class.max_capacity_label', 'Max Capacity')} *</Text>
            <TextInput
              style={styles.input}
              placeholder="50"
              value={form.max_capacity}
              onChangeText={(v) => set('max_capacity', v)}
              keyboardType="number-pad"
              placeholderTextColor={theme.textMuted}
            />

            {rooms.length > 0 ? (
              <>
                <Text style={styles.label}>
                  {t('create_class.pick_room_label', 'Pick a room from Facilities (optional)')}
                </Text>
                <View style={styles.chipGrid}>
                  {rooms.map((room) => {
                    const selected = form.room_number === (room.code || room.name);
                    return (
                      <TouchableOpacity
                        key={room.id}
                        style={[styles.chip, selected && styles.chipSelected]}
                        onPress={() => pickRoom(room)}
                      >
                        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                          {room.name}{room.building?.name ? ` · ${room.building.name}` : ''}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            ) : null}

            <Text style={styles.label}>{t('create_class.room_number_label', 'Room Number (optional)')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('create_class.room_number_placeholder', 'e.g., A101')}
              value={form.room_number}
              onChangeText={(v) => set('room_number', v)}
              placeholderTextColor={theme.textMuted}
            />

            <View style={styles.row}>
              <View style={styles.rowField}>
                <Text style={styles.label}>{t('create_class.building_label', 'Building (optional)')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('create_class.building_placeholder', 'e.g., Building A')}
                  value={form.building}
                  onChangeText={(v) => set('building', v)}
                  placeholderTextColor={theme.textMuted}
                />
              </View>
              <View style={styles.rowField}>
                <Text style={styles.label}>{t('create_class.floor_label', 'Floor (optional)')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('create_class.floor_placeholder', 'e.g., 1st Floor')}
                  value={form.floor}
                  onChangeText={(v) => set('floor', v)}
                  placeholderTextColor={theme.textMuted}
                />
              </View>
            </View>
          </>
        ) : null}

        {stepKey === 'dates' ? (
          <>
            <Text style={styles.stepTitle}>{t('create_class.dates_title', 'Dates & status')}</Text>
            <Text style={styles.stepSubtitle}>
              {t('create_class.dates_subtitle', 'When this class runs, and whether it should be visible yet.')}
            </Text>

            <View style={styles.row}>
              <View style={styles.rowField}>
                <Text style={styles.label}>{t('create_class.start_date_label', 'Start Date')} *</Text>
                <TouchableOpacity style={styles.input} onPress={() => setDatePickerField('start_date')}>
                  <Text style={styles.dateValueText}>{form.start_date}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.rowField}>
                <Text style={styles.label}>{t('create_class.end_date_label', 'End Date')} *</Text>
                <TouchableOpacity style={styles.input} onPress={() => setDatePickerField('end_date')}>
                  <Text style={styles.dateValueText}>{form.end_date}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {datePickerField ? (
              <View style={Platform.OS === 'ios' ? styles.iosPickerWrap : undefined}>
                <DateTimePicker
                  value={parseDateValue(form[datePickerField])}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onChangeDate}
                />
                {Platform.OS === 'ios' ? (
                  <TouchableOpacity style={styles.iosPickerDone} onPress={() => setDatePickerField(null)}>
                    <Text style={styles.iosPickerDoneText}>{t('common.done', 'Done')}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}

            <Text style={styles.label}>{t('create_class.status_label', 'Status')} *</Text>
            <View style={styles.chipGrid}>
              {STATUSES.map((s) => {
                const selected = form.status === s;
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => set('status', s)}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{statusLabel(s)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>{t('create_class.description_label', 'Description (optional)')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t('create_class.description_placeholder', 'Add notes or description')}
              value={form.description}
              onChangeText={(v) => set('description', v)}
              multiline
              numberOfLines={4}
              placeholderTextColor={theme.textMuted}
            />
          </>
        ) : null}

        {stepError ? <Text style={styles.errorText}>{stepError}</Text> : null}

        <View style={styles.navRow}>
          {step > 0 ? (
            <TouchableOpacity style={styles.backStepButton} onPress={goBackStep} disabled={submitting}>
              <Text style={styles.backStepButtonText}>{t('common.back', 'Back')}</Text>
            </TouchableOpacity>
          ) : null}
          <View style={{ flex: 1 }}>
            <WizardGradientButton
              label={
                !isLastStep
                  ? t('create_class.next', 'Next')
                  : isEditing
                  ? t('common.save_changes', 'Save Changes')
                  : t('create_class.create_class', 'Create Class')
              }
              onPress={goNext}
              loading={submitting}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function ChipField({
  label,
  options,
  value,
  onChange,
  theme,
  clearable,
  emptyLabel,
}: {
  label: string;
  options: { id: number; name: string }[];
  value: string;
  onChange: (v: string) => void;
  theme: AcademicGlassTheme;
  clearable?: boolean;
  emptyLabel?: string;
}) {
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      {options.length === 0 ? (
        <Text style={styles.emptyOptionsText}>{emptyLabel ?? '—'}</Text>
      ) : (
        <View style={styles.chipGrid}>
          {clearable ? (
            <TouchableOpacity
              style={[styles.chip, !value && styles.chipSelected]}
              onPress={() => onChange('')}
            >
              <Text style={[styles.chipText, !value && styles.chipTextSelected]}>None</Text>
            </TouchableOpacity>
          ) : null}
          {options.map((opt) => {
            const selected = value === String(opt.id);
            return (
              <TouchableOpacity
                key={opt.id}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => onChange(String(opt.id))}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{opt.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </>
  );
}

const makeStyles = (theme: AcademicGlassTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
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
    headerTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
    headerTitleFlex: { flex: 1, marginLeft: 8 },
    backButton: { width: 32 },
    headerSpacer: { width: 32 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    content: { padding: 20, paddingBottom: 48 },
    errorText: { color: theme.danger, fontSize: 13.5, marginBottom: 16, textAlign: 'center' },

    stepTitle: { fontSize: 19, fontWeight: '800', color: theme.textPrimary },
    stepSubtitle: { fontSize: 13, color: theme.textSecondary, marginTop: 6, lineHeight: 18 },

    label: { fontSize: 12.5, fontWeight: '600', color: theme.textSecondary, marginBottom: 6, marginTop: 16 },
    input: {
      height: 48,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: RADIUS.sm,
      paddingHorizontal: 16,
      fontSize: 15,
      backgroundColor: theme.surface,
      color: theme.textPrimary,
      justifyContent: 'center',
    },
    dateValueText: { fontSize: 15, color: theme.textPrimary },
    textArea: { height: 84, paddingTop: 12, textAlignVertical: 'top' },

    row: { flexDirection: 'row', gap: 12 },
    rowField: { flex: 1 },

    chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: RADIUS.pill ?? 999,
    },
    chipSelected: { backgroundColor: theme.accentSoft, borderColor: theme.accent },
    chipText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
    chipTextSelected: { color: theme.accentSoftText ?? theme.accent },
    emptyOptionsText: { fontSize: 12.5, color: theme.textMuted, lineHeight: 18, marginTop: 16 },

    addSectionChip: {
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: theme.accent,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: RADIUS.pill ?? 999,
    },
    addSectionChipText: { fontSize: 13, fontWeight: '700', color: theme.accent },

    emptySectionBox: {
      marginTop: 16,
      padding: 16,
      borderRadius: RADIUS.md ?? 14,
      backgroundColor: theme.surfaceVariant,
      borderWidth: 1,
      borderColor: theme.border,
    },
    emptySectionText: { fontSize: 12.5, color: theme.textSecondary, lineHeight: 18, marginBottom: 12 },
    emptySectionButton: {
      alignSelf: 'flex-start',
      backgroundColor: theme.accent,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: RADIUS.pill ?? 999,
    },
    emptySectionButtonText: { color: theme.onAccent, fontSize: 13, fontWeight: '700' },

    iosPickerWrap: { backgroundColor: theme.surface, borderRadius: RADIUS.sm, marginTop: 4 },
    iosPickerDone: { alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 6 },
    iosPickerDoneText: { color: theme.accent, fontWeight: '700', fontSize: 14 },

    navRow: { flexDirection: 'row', gap: 10, marginTop: 32, alignItems: 'center' },
    backStepButton: {
      height: 54,
      paddingHorizontal: 18,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backStepButtonText: { color: theme.textPrimary, fontWeight: '700', fontSize: 15 },
  });
