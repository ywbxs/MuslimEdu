import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import KeyboardAwareModal from '../../components/KeyboardAwareModal';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ban, BookOpen, Check, ChevronLeft, Clock, DoorOpen, Layers, Plus, Trash2, User, X } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import {
  AcademicSchedule,
  Day,
  listSchedules,
  saveSchedule,
  updateSchedule,
  setScheduleStatus,
  deleteSchedule,
} from '../../services/academicScheduleService';
import { fetchAllSections, fetchClassTeacherAssignments, SectionOption, AssignableTeacher } from '../../services/teacherClassService';
import { fetchSubjectsCatalog, Subject } from '../../services/adminAcademicCatalogService';
import { listRooms, Room } from '../../services/academicFacilitiesService';
import { useAcademicGlassTheme, AcademicGlassTheme } from '../teachers/academicGlassTheme';
import GlassBackground from '../../components/glass/GlassBackground';
import { Skeleton } from '../../components/Skeleton';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Admin: the class/teacher schedule (timetable) builder - rescued from
 * src/screens/teachers/AcademicScheduleScreen.tsx, which was fully built
 * and backend-wired (conflict-checked, day-filterable) but never actually
 * registered as a reachable screen, and never let admins pick a subject
 * or see names instead of raw IDs. See plan notes: this is a fix + polish
 * pass, not a new feature - the backend (AcademicScheduleController) was
 * already complete.
 */

const DAYS: { key: Day; label: string }[] = [
  { key: 'sunday', label: 'Sun' },
  { key: 'monday', label: 'Mon' },
  { key: 'tuesday', label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday', label: 'Thu' },
  { key: 'friday', label: 'Fri' },
  { key: 'saturday', label: 'Sat' },
];

function dayLabel(t: (key: string, fallback: string) => string, day: Day): string {
  return t(`admin_class_schedule.day_${day}`, DAYS.find((d) => d.key === day)?.label ?? day);
}

function IconChevronLeft({ color }: { color: string }) {
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}
function IconClose({ color }: { color: string }) {
  return <X size={18} color={color} strokeWidth={2.2} />;
}
function IconPlus({ color }: { color: string }) {
  return <Plus size={18} color={color} strokeWidth={2.4} />;
}
function IconTrash({ color }: { color: string }) {
  return <Trash2 size={16} color={color} strokeWidth={2} />;
}
function IconDoor({ color }: { color: string }) {
  return <DoorOpen size={14} color={color} strokeWidth={2} />;
}
function IconClock({ color }: { color: string }) {
  return <Clock size={14} color={color} strokeWidth={2} />;
}
function IconLayers({ color }: { color: string }) {
  return <Layers size={20} color={color} strokeWidth={2} />;
}
function IconBook({ color }: { color: string }) {
  return <BookOpen size={20} color={color} strokeWidth={2} />;
}
function IconUser({ color }: { color: string }) {
  return <User size={20} color={color} strokeWidth={2} />;
}
function IconSlash({ color }: { color: string }) {
  return <Ban size={20} color={color} strokeWidth={2} />;
}
function IconCheckSmall({ color }: { color: string }) {
  return <Check size={12} color={color} strokeWidth={3} />;
}

function RowSkeleton({ styles, theme }: { styles: any; theme: AcademicGlassTheme }) {
  return (
    <View style={styles.card}>
      <Skeleton width="45%" height={15} borderRadius={4} baseColor={theme.skeletonBase} />
      <Skeleton width="60%" height={12} borderRadius={4} style={{ marginTop: 10 }} baseColor={theme.skeletonBase} />
    </View>
  );
}

/**
 * Bento tile picker: each option is a spatial card (icon + name, elevated,
 * selected state gets a filled accent tile + check badge) laid out in a
 * wrapping grid, rather than a flat row of small text chips - same bento
 * visual language as the attendance feature's swipe cards and method
 * chooser tiles, applied here to Section/Subject/Teacher/Room selection.
 */
function BentoOptionGrid<T extends { id: number; name: string }>({
  label,
  options,
  value,
  onChange,
  allowNone,
  noneLabel,
  icon,
  styles,
  theme,
  emptyState,
}: {
  label: string;
  options: T[];
  value: number | null;
  onChange: (id: number | null) => void;
  allowNone?: boolean;
  noneLabel?: string;
  icon: (color: string) => React.ReactNode;
  styles: any;
  theme: AcademicGlassTheme;
  /** Shown instead of an empty grid when there's nothing to pick from yet -
      a bare empty grid gave no clue why the step's Next button stayed
      disabled. */
  emptyState?: React.ReactNode;
}) {
  if (options.length === 0 && !allowNone && emptyState) {
    return (
      <>
        <Text style={styles.fieldLabel}>{label}</Text>
        {emptyState}
      </>
    );
  }
  return (
    <>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.bentoGrid}>
        {allowNone ? (
          <TouchableOpacity
            style={[styles.bentoTile, value === null && styles.bentoTileActive]}
            onPress={() => onChange(null)}
            activeOpacity={0.85}
          >
            <View style={[styles.bentoIconWrap, value === null && styles.bentoIconWrapActive]}>
              <IconSlash color={value === null ? theme.onAccent : theme.textSecondary} />
            </View>
            <Text style={[styles.bentoTileText, value === null && styles.bentoTileTextActive]} numberOfLines={2}>
              {noneLabel}
            </Text>
            {value === null ? (
              <View style={styles.bentoCheck}>
                <IconCheckSmall color={theme.onAccent} />
              </View>
            ) : null}
          </TouchableOpacity>
        ) : null}
        {options.map((opt) => {
          const active = opt.id === value;
          return (
            <TouchableOpacity
              key={opt.id}
              style={[styles.bentoTile, active && styles.bentoTileActive]}
              onPress={() => onChange(opt.id)}
              activeOpacity={0.85}
            >
              <View style={[styles.bentoIconWrap, active && styles.bentoIconWrapActive]}>{icon(active ? theme.onAccent : theme.accent)}</View>
              <Text style={[styles.bentoTileText, active && styles.bentoTileTextActive]} numberOfLines={2}>
                {opt.name}
              </Text>
              {active ? (
                <View style={styles.bentoCheck}>
                  <IconCheckSmall color={theme.onAccent} />
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );
}

interface PickerData {
  sections: SectionOption[];
  teachers: AssignableTeacher[];
  subjects: Subject[];
  rooms: Room[];
}

function findOptionName<T extends { id: number; name: string }>(options: T[], id: number | null): string | null {
  if (id == null) return null;
  return options.find((o) => o.id === id)?.name ?? null;
}

function SummaryRow({ label, value, styles }: { label: string; value: string; styles: any }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

/**
 * Step wizard for adding/editing one schedule slot - was a single long
 * scrolling form (7 fields at once); broken into focused steps (class,
 * teacher/room, day/time, review) with a progress indicator, same visual
 * language as the report-submission wizards elsewhere in the app.
 */
function ScheduleEditSheet({
  visible,
  onClose,
  onSave,
  onDelete,
  isSaving,
  editingRow,
  pickers,
  styles,
  theme,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (args: {
    code: string;
    dayOfWeek: Day;
    startTime: string;
    endTime: string;
    sectionId: number | null;
    teacherId: number | null;
    subjectId: number | null;
    roomId: number | null;
  }) => void;
  onDelete: (() => void) | null;
  isSaving: boolean;
  editingRow: AcademicSchedule | null;
  pickers: PickerData;
  styles: any;
  theme: AcademicGlassTheme;
}) {
  const { t } = useLocale();
  const navigation = useNavigation();
  const [stepIndex, setStepIndex] = useState(0);
  const [code, setCode] = useState(editingRow?.code ?? '');
  const [day, setDay] = useState<Day>(editingRow?.day_of_week ?? 'monday');
  const [startTime, setStartTime] = useState(editingRow?.starts_at?.slice(0, 5) ?? '08:00');
  const [endTime, setEndTime] = useState(editingRow?.ends_at?.slice(0, 5) ?? '09:00');
  const [sectionId, setSectionId] = useState<number | null>(editingRow?.section_id ?? null);
  const [teacherId, setTeacherId] = useState<number | null>(editingRow?.teacher_id ?? null);
  const [subjectId, setSubjectId] = useState<number | null>(editingRow?.subject_id ?? null);
  const [roomId, setRoomId] = useState<number | null>(editingRow?.room_id ?? null);

  React.useEffect(() => {
    if (visible) {
      setStepIndex(0);
      setCode(editingRow?.code ?? '');
      setDay(editingRow?.day_of_week ?? 'monday');
      setStartTime(editingRow?.starts_at?.slice(0, 5) ?? '08:00');
      setEndTime(editingRow?.ends_at?.slice(0, 5) ?? '09:00');
      setSectionId(editingRow?.section_id ?? null);
      setTeacherId(editingRow?.teacher_id ?? null);
      setSubjectId(editingRow?.subject_id ?? null);
      setRoomId(editingRow?.room_id ?? null);
    }
  }, [visible, editingRow]);

  const timeValid = /^\d{2}:\d{2}$/.test(startTime) && /^\d{2}:\d{2}$/.test(endTime);
  const canSave = !!sectionId && timeValid;

  const steps = [
    {
      id: 'class_subject',
      title: t('admin_class_schedule.step_class_title', 'Class & Subject'),
      subtitle: t('admin_class_schedule.step_class_subtitle', 'Which section and subject is this slot for?'),
      isValid: !!sectionId,
      content: (
        <>
          <BentoOptionGrid
            label={t('admin_class_schedule.section_label', 'Class Section')}
            options={pickers.sections}
            value={sectionId}
            onChange={setSectionId}
            icon={(color) => <IconLayers color={color} />}
            styles={styles}
            theme={theme}
            emptyState={
              <View style={styles.emptyPickerWrap}>
                <Text style={styles.emptyPickerText}>
                  {t('admin_class_schedule.no_sections', 'No class sections yet - create a class and section first.')}
                </Text>
                <TouchableOpacity
                  style={styles.emptyPickerButton}
                  onPress={() => {
                    onClose();
                    (navigation as any).navigate('ClassList');
                  }}
                >
                  <Text style={styles.emptyPickerButtonText}>{t('admin_class_schedule.add_class_section', '+ Add Class & Section')}</Text>
                </TouchableOpacity>
              </View>
            }
          />
          <BentoOptionGrid
            label={t('admin_class_schedule.subject_label', 'Subject')}
            options={pickers.subjects}
            value={subjectId}
            onChange={setSubjectId}
            allowNone
            noneLabel={t('common.none', 'None')}
            icon={(color) => <IconBook color={color} />}
            styles={styles}
            theme={theme}
          />
        </>
      ),
    },
    {
      id: 'teacher_room',
      title: t('admin_class_schedule.step_teacher_title', 'Teacher & Room'),
      subtitle: t('admin_class_schedule.step_teacher_subtitle', 'Assign a teacher and a room - both optional, can be set later.'),
      isValid: true,
      content: (
        <>
          <BentoOptionGrid
            label={t('admin_class_schedule.teacher_label', 'Teacher')}
            options={pickers.teachers}
            value={teacherId}
            onChange={setTeacherId}
            allowNone
            noneLabel={t('admin_class_schedule.unassigned', 'Unassigned')}
            icon={(color) => <IconUser color={color} />}
            styles={styles}
            theme={theme}
          />
          <BentoOptionGrid
            label={t('admin_class_schedule.room_label', 'Room')}
            options={pickers.rooms}
            value={roomId}
            onChange={setRoomId}
            allowNone
            noneLabel={t('common.none', 'None')}
            icon={(color) => <IconDoor color={color} />}
            styles={styles}
            theme={theme}
          />
        </>
      ),
    },
    {
      id: 'day_time',
      title: t('admin_class_schedule.step_time_title', 'Day & Time'),
      subtitle: t('admin_class_schedule.step_time_subtitle', 'When does this class meet each week?'),
      isValid: timeValid,
      content: (
        <>
          <Text style={styles.fieldLabel}>{t('admin_class_schedule.code_label', 'Label (optional)')}</Text>
          <TextInput
            style={styles.textInput}
            placeholder={t('admin_class_schedule.code_placeholder', 'e.g. Period 1')}
            placeholderTextColor={theme.textSecondary}
            value={code}
            onChangeText={setCode}
          />

          <Text style={styles.fieldLabel}>{t('admin_class_schedule.day_label', 'Day')}</Text>
          <View style={styles.bentoDayGrid}>
            {DAYS.map((d) => {
              const active = d.key === day;
              return (
                <TouchableOpacity
                  key={d.key}
                  style={[styles.bentoDayTile, active && styles.bentoDayTileActive]}
                  onPress={() => setDay(d.key)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.bentoDayTileText, active && styles.bentoDayTileTextActive]}>{dayLabel(t, d.key)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.fieldLabel}>{t('admin_class_schedule.time_label', 'Time (24h, e.g. 09:00)')}</Text>
          <View style={styles.timeRow}>
            <TextInput
              style={styles.timeInput}
              placeholder={t('admin_class_schedule.start_placeholder', 'Start')}
              placeholderTextColor={theme.textSecondary}
              value={startTime}
              onChangeText={setStartTime}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
            />
            <Text style={styles.timeDash}>-</Text>
            <TextInput
              style={styles.timeInput}
              placeholder={t('admin_class_schedule.end_placeholder', 'End')}
              placeholderTextColor={theme.textSecondary}
              value={endTime}
              onChangeText={setEndTime}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
            />
          </View>
          {!timeValid ? <Text style={styles.timeError}>{t('admin_class_schedule.time_error', 'Use HH:MM for both start and end, e.g. 09:00 and 09:45.')}</Text> : null}
        </>
      ),
    },
    {
      id: 'review',
      title: t('admin_class_schedule.step_review_title', 'Review & Save'),
      subtitle: t('admin_class_schedule.step_review_subtitle', 'Double-check the details before saving this slot.'),
      isValid: canSave,
      content: (
        <View>
          <SummaryRow label={t('admin_class_schedule.section_label', 'Class Section')} value={findOptionName(pickers.sections, sectionId) ?? '—'} styles={styles} />
          <SummaryRow label={t('admin_class_schedule.subject_label', 'Subject')} value={findOptionName(pickers.subjects, subjectId) ?? t('common.none', 'None')} styles={styles} />
          <SummaryRow label={t('admin_class_schedule.teacher_label', 'Teacher')} value={findOptionName(pickers.teachers, teacherId) ?? t('admin_class_schedule.unassigned', 'Unassigned')} styles={styles} />
          <SummaryRow label={t('admin_class_schedule.room_label', 'Room')} value={findOptionName(pickers.rooms, roomId) ?? t('common.none', 'None')} styles={styles} />
          <SummaryRow label={t('admin_class_schedule.day_label', 'Day')} value={dayLabel(t, day)} styles={styles} />
          <SummaryRow label={t('admin_class_schedule.time_label', 'Time')} value={`${startTime} - ${endTime}`} styles={styles} />
          {code.trim() ? <SummaryRow label={t('admin_class_schedule.code_label', 'Label (optional)')} value={code.trim()} styles={styles} /> : null}

          {onDelete ? (
            <TouchableOpacity style={styles.deleteBtn} activeOpacity={0.75} onPress={onDelete}>
              <IconTrash color={theme.danger} />
              <Text style={styles.deleteBtnText}>{t('admin_class_schedule.remove_schedule', 'Remove this schedule slot')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ),
    },
  ];

  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === steps.length - 1;
  const step = steps[stepIndex];

  const goNext = () => {
    if (!step.isValid) return;
    if (isLastStep) {
      if (sectionId) onSave({ code: code.trim(), dayOfWeek: day, startTime, endTime, sectionId, teacherId, subjectId, roomId });
    } else {
      setStepIndex(stepIndex + 1);
    }
  };
  const goBack = () => {
    if (isFirstStep) onClose();
    else setStepIndex(stepIndex - 1);
  };

  return (
    <KeyboardAwareModal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{editingRow ? t('admin_class_schedule.edit_title', 'Edit Schedule') : t('admin_class_schedule.add_title', 'Add Schedule')}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <IconClose color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {isSaving ? (
            <View style={styles.savingWrap}>
              <ActivityIndicator color={theme.accent} />
            </View>
          ) : (
            <>
              <View style={styles.progressRow}>
                {steps.map((s, idx) => {
                  const done = idx < stepIndex;
                  const active = idx === stepIndex;
                  return (
                    <React.Fragment key={s.id}>
                      <View style={[styles.progressDot, active && styles.progressDotActive, done && styles.progressDotDone]}>
                        <Text style={[styles.progressDotText, (active || done) && styles.progressDotTextActive]}>{idx + 1}</Text>
                      </View>
                      {idx < steps.length - 1 && <View style={[styles.progressLine, done && styles.progressLineDone]} />}
                    </React.Fragment>
                  );
                })}
              </View>
              <Text style={styles.progressCaption}>
                {t('admin_class_schedule.step_caption', 'Step {current} of {total}')
                  .replace('{current}', String(stepIndex + 1))
                  .replace('{total}', String(steps.length))}
                {' · '}
                {step.title}
              </Text>

              <ScrollView contentContainerStyle={{ paddingBottom: 28 }} keyboardShouldPersistTaps="handled">
                <Text style={styles.stepSubtitle}>{step.subtitle}</Text>
                {step.content}

                <View style={styles.wizardNavRow}>
                  <TouchableOpacity style={styles.navBackBtn} onPress={goBack} activeOpacity={0.85}>
                    <Text style={styles.navBackText}>{isFirstStep ? t('common.cancel', 'Cancel') : t('common.back', 'Back')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.navNextBtn, !step.isValid && styles.navNextBtnDisabled]}
                    onPress={goNext}
                    activeOpacity={0.85}
                    disabled={!step.isValid}
                  >
                    <Text style={styles.navNextText}>{isLastStep ? t('common.save', 'Save') : t('common.next', 'Next')}</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </KeyboardAwareModal>
  );
}

export default function AdminClassScheduleScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();
  const { t } = useLocale();
  const theme = useAcademicGlassTheme('emerald');
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [rows, setRows] = useState<AcademicSchedule[]>([]);
  const [pickers, setPickers] = useState<PickerData>({ sections: [], teachers: [], subjects: [], rooms: [] });
  const [dayFilter, setDayFilter] = useState<Day | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingRow, setEditingRow] = useState<AcademicSchedule | null | 'new'>(null);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!token) return;
      if (!opts.silent) setIsLoading(true);
      setError(null);
      try {
        const [schedules, sections, teacherData, subjects, rooms] = await Promise.all([
          listSchedules(token, dayFilter),
          fetchAllSections(token),
          fetchClassTeacherAssignments(token),
          fetchSubjectsCatalog(token),
          listRooms(token),
        ]);
        setRows(schedules);
        setPickers({ sections, teachers: teacherData.teachers, subjects, rooms });
      } catch (err) {
        setError(err instanceof Error ? err.message : t('admin_class_schedule.load_error', 'Could not load the schedule.'));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [token, dayFilter, t]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = () => {
    setIsRefreshing(true);
    load({ silent: true });
  };

  const handleSave = async (args: {
    code: string;
    dayOfWeek: Day;
    startTime: string;
    endTime: string;
    sectionId: number | null;
    teacherId: number | null;
    subjectId: number | null;
    roomId: number | null;
  }) => {
    if (!token || !args.sectionId) return;
    setIsSaving(true);
    try {
      const input = {
        code: args.code || `${args.startTime}-${args.endTime}`,
        day_of_week: args.dayOfWeek,
        starts_at: args.startTime,
        ends_at: args.endTime,
        section_id: args.sectionId,
        teacher_id: args.teacherId,
        subject_id: args.subjectId,
        room_id: args.roomId,
      };
      const saved =
        editingRow && editingRow !== 'new' ? await updateSchedule(token, editingRow.id, input) : await saveSchedule(token, input);
      // Publish immediately - every row is created as 'draft' server-side
      // and "my schedule" (teacher/student) only ever shows published
      // rows, so without this an assigned slot would never actually
      // reach the teacher/student screens.
      await setScheduleStatus(token, saved.id, 'published');
      setEditingRow(null);
      await load({ silent: true });
    } catch (err) {
      setEditingRow(null);
      Alert.alert(
        t('admin_class_schedule.conflict_title', 'Schedule conflict'),
        err instanceof Error ? err.message : t('admin_class_schedule.save_error', 'Could not save this schedule.'),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (row: AcademicSchedule) => {
    Alert.alert(
      t('admin_class_schedule.cancel_confirm_title', 'Remove schedule?'),
      undefined,
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('admin_class_schedule.remove_schedule', 'Remove this schedule slot'),
          style: 'destructive',
          onPress: async () => {
            if (!token) return;
            setEditingRow(null);
            try {
              await deleteSchedule(token, row.id);
              await load({ silent: true });
            } catch (err) {
              setError(err instanceof Error ? err.message : t('admin_class_schedule.remove_error', 'Could not remove this schedule.'));
            }
          },
        },
      ],
    );
  };

  const sheetVisible = editingRow !== null;
  const sheetRow = editingRow === 'new' ? null : editingRow;

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
          <IconChevronLeft color={theme.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {t('admin_class_schedule.header_title', 'Class Schedule')}
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {t('admin_class_schedule.header_subtitle', 'Conflict-checked timetable')}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setEditingRow('new')} hitSlop={10} style={styles.addButton}>
          <IconPlus color={theme.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayBar} contentContainerStyle={styles.dayBarContent}>
        <TouchableOpacity onPress={() => setDayFilter(undefined)} style={[styles.chip, !dayFilter && styles.chipActive]}>
          <Text style={[styles.chipText, !dayFilter && styles.chipTextActive]}>{t('common.filter_all', 'All')}</Text>
        </TouchableOpacity>
        {DAYS.map((d) => (
          <TouchableOpacity key={d.key} onPress={() => setDayFilter(d.key)} style={[styles.chip, dayFilter === d.key && styles.chipActive]}>
            <Text style={[styles.chipText, dayFilter === d.key && styles.chipTextActive]}>{dayLabel(t, d.key)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {isLoading ? (
        <View style={styles.listContent}>
          <RowSkeleton styles={styles} theme={theme} />
          <RowSkeleton styles={styles} theme={theme} />
          <RowSkeleton styles={styles} theme={theme} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
          ListHeaderComponent={
            error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            !error ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>{t('admin_class_schedule.empty_title', 'No schedules yet')}</Text>
                <Text style={styles.emptyDesc}>
                  {t('admin_class_schedule.empty_desc', 'Tap the + button to add a class, teacher, subject and time slot.')}
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => setEditingRow(item)}>
              <View style={styles.time}>
                <Text style={styles.timeText}>{item.starts_at.slice(0, 5)}</Text>
                <Text style={styles.to}>{t('admin_class_schedule.to', 'to')}</Text>
                <Text style={styles.timeText}>{item.ends_at.slice(0, 5)}</Text>
              </View>
              <View style={styles.line} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.subject_name ?? item.code}</Text>
                <View style={styles.metaRow}>
                  <View style={[styles.badge, styles.badgeSchedule]}>
                    <Text style={[styles.badgeText, styles.badgeTextSchedule]}>{item.section_name ?? t('admin_class_schedule.tbd', 'TBD')}</Text>
                  </View>
                  {item.teacher_name ? (
                    <View style={[styles.badge, styles.badgeAssigned]}>
                      <Text style={[styles.badgeText, styles.badgeTextAssigned]}>{item.teacher_name}</Text>
                    </View>
                  ) : null}
                  {item.room_name ? (
                    <View style={[styles.badge, styles.badgeSchedule]}>
                      <IconDoor color={theme.textSecondary} />
                      <Text style={[styles.badgeText, styles.badgeTextSchedule]}>{item.room_name}</Text>
                    </View>
                  ) : null}
                  <View style={[styles.badge, styles.badgeSchedule]}>
                    <IconClock color={theme.textSecondary} />
                    <Text style={[styles.badgeText, styles.badgeTextSchedule]}>{dayLabel(t, item.day_of_week)}</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      <ScheduleEditSheet
        visible={sheetVisible}
        onClose={() => setEditingRow(null)}
        onSave={handleSave}
        onDelete={sheetRow ? () => handleDelete(sheetRow) : null}
        isSaving={isSaving}
        editingRow={sheetRow}
        pickers={pickers}
        styles={styles}
        theme={theme}
      />
    </View>
  );
}

const makeStyles = (theme: AcademicGlassTheme) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingBottom: 16,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    backButton: { width: 32 },
    addButton: { width: 32, alignItems: 'flex-end' },
    headerTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary, textAlign: 'center' },
    headerSubtitle: { fontSize: 12.5, color: theme.textSecondary, textAlign: 'center', marginTop: 2 },
    dayBar: { flexGrow: 0, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
    dayBarContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: 'row' },
    listContent: { padding: 16 },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.border,
    },
    time: { width: 62 },
    timeText: { fontSize: 14, fontWeight: '800', color: theme.textPrimary },
    to: { fontSize: 10, color: theme.textSecondary, marginVertical: 2 },
    line: { width: 1, height: 48, backgroundColor: theme.accent, marginHorizontal: 12 },
    cardTitle: { fontSize: 15, fontWeight: '700', color: theme.textPrimary, marginBottom: 8 },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      alignSelf: 'flex-start',
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    badgeAssigned: { backgroundColor: theme.accentSoft },
    badgeSchedule: { backgroundColor: theme.background },
    badgeText: { fontSize: 12, fontWeight: '600' },
    badgeTextAssigned: { color: theme.accent },
    badgeTextSchedule: { color: theme.textSecondary },
    emptyWrap: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, marginBottom: 8 },
    emptyDesc: { fontSize: 13.5, color: theme.textSecondary, textAlign: 'center', lineHeight: 19 },
    errorBanner: { backgroundColor: theme.dangerSoft, borderRadius: 12, padding: 14, marginBottom: 12 },
    errorText: { color: theme.danger, fontSize: 13.5, textAlign: 'center' },

    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '85%',
      paddingTop: 18,
      paddingHorizontal: 20,
    },
    sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
    sheetTitle: { fontSize: 16.5, fontWeight: '700', color: theme.textPrimary },
    savingWrap: { paddingVertical: 40, alignItems: 'center' },
    fieldLabel: { fontSize: 12.5, fontWeight: '700', color: theme.textSecondary, marginTop: 14, marginBottom: 8, textTransform: 'uppercase' },
    chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
    },
    chipActive: { backgroundColor: theme.accentSoft, borderColor: theme.accent },
    chipText: { fontSize: 13, fontWeight: '600', color: theme.textPrimary },
    chipTextActive: { color: theme.accent },

    emptyPickerWrap: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 14,
      padding: 16,
      alignItems: 'center',
      gap: 12,
    },
    emptyPickerText: { fontSize: 13, color: theme.textSecondary, textAlign: 'center', lineHeight: 18 },
    emptyPickerButton: { backgroundColor: theme.accent, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
    emptyPickerButtonText: { color: theme.onAccent, fontWeight: '700', fontSize: 13.5 },

    // Bento tile picker (Section/Subject/Teacher/Room) - spatial cards
    // instead of flat text chips, matching the attendance feature's card
    // language.
    bentoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    bentoTile: {
      width: '30%',
      minHeight: 92,
      borderRadius: 16,
      backgroundColor: theme.surface,
      borderWidth: 1.5,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 6,
      ...theme.elevation1,
    },
    bentoTileActive: { backgroundColor: theme.accent, borderColor: theme.accent, ...theme.elevation2 },
    bentoIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    bentoIconWrapActive: { backgroundColor: 'rgba(255,255,255,0.22)' },
    bentoTileText: { fontSize: 12, fontWeight: '700', color: theme.textPrimary, textAlign: 'center' },
    bentoTileTextActive: { color: theme.onAccent },
    bentoCheck: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: 'rgba(255,255,255,0.28)',
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Bento day-of-week grid - a compact row of 7 equal spatial tiles.
    bentoDayGrid: { flexDirection: 'row', gap: 6 },
    bentoDayTile: {
      flex: 1,
      height: 52,
      borderRadius: 14,
      backgroundColor: theme.surface,
      borderWidth: 1.5,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
      ...theme.elevation1,
    },
    bentoDayTileActive: { backgroundColor: theme.accent, borderColor: theme.accent, ...theme.elevation2 },
    bentoDayTileText: { fontSize: 12, fontWeight: '700', color: theme.textPrimary },
    bentoDayTileTextActive: { color: theme.onAccent },
    textInput: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 14,
      color: theme.textPrimary,
    },
    timeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    timeInput: {
      flex: 1,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 14,
      color: theme.textPrimary,
      textAlign: 'center',
    },
    timeDash: { color: theme.textSecondary, fontSize: 14 },
    timeError: { color: theme.danger, fontSize: 12, marginTop: 8 },
    deleteBtn: { marginTop: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
    deleteBtnText: { color: theme.danger, fontSize: 13.5, fontWeight: '700' },

    progressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    progressDot: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: theme.background,
      borderWidth: 1.5,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    progressDotActive: { borderColor: theme.accent, backgroundColor: theme.accentSoft },
    progressDotDone: { borderColor: theme.accent, backgroundColor: theme.accent },
    progressDotText: { fontSize: 11.5, fontWeight: '700', color: theme.textSecondary },
    progressDotTextActive: { color: theme.onAccent },
    progressLine: { flex: 1, height: 2, backgroundColor: theme.border, marginHorizontal: 2 },
    progressLineDone: { backgroundColor: theme.accent },
    progressCaption: { color: theme.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 16 },
    stepSubtitle: { color: theme.textSecondary, fontSize: 13, lineHeight: 18, marginBottom: 4 },

    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    summaryLabel: { fontSize: 13, color: theme.textSecondary, fontWeight: '600' },
    summaryValue: { fontSize: 14, color: theme.textPrimary, fontWeight: '700', flexShrink: 1, textAlign: 'right', marginLeft: 12 },

    wizardNavRow: { flexDirection: 'row', gap: 10, marginTop: 26 },
    navBackBtn: {
      flex: 1,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
    },
    navBackText: { color: theme.textPrimary, fontWeight: '700', fontSize: 14.5 },
    navNextBtn: {
      flex: 2,
      borderRadius: 14,
      backgroundColor: theme.accent,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
    },
    navNextBtnDisabled: { opacity: 0.45 },
    navNextText: { color: theme.onAccent, fontWeight: '700', fontSize: 14.5 },
  });
