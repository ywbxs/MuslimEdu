import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Svg, { Polyline, Line, Circle, Path } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import {
  AcademicSchedule,
  Day,
  listSchedules,
  saveSchedule,
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
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Polyline points="15 5 8 12 15 19" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconClose({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Line x1={6} y1={6} x2={18} y2={18} stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Line x1={18} y1={6} x2={6} y2={18} stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}
function IconPlus({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Line x1={12} y1={5} x2={12} y2={19} stroke={color} strokeWidth={2.4} strokeLinecap="round" />
      <Line x1={5} y1={12} x2={19} y2={12} stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}
function IconTrash({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m-8 0 1 13a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-13" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconDoor({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path d="M6 21V4a1 1 0 0 1 1-1h8l3 3v15" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1={6} y1={21} x2={20} y2={21} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Circle cx={13} cy={13} r={0.8} stroke={color} strokeWidth={2} />
    </Svg>
  );
}
function IconClock({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} />
      <Path d="M12 7v5l3.5 2" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function RowSkeleton({ styles, theme }: { styles: any; theme: AcademicGlassTheme }) {
  return (
    <View style={styles.card}>
      <Skeleton width="45%" height={15} borderRadius={4} baseColor={theme.skeletonBase} />
      <Skeleton width="60%" height={12} borderRadius={4} style={{ marginTop: 10 }} baseColor={theme.skeletonBase} />
    </View>
  );
}

// --- Chip picker helper: label + list of {id,name} rendered as chips, with an optional "None" chip ---
function ChipPicker<T extends { id: number; name: string }>({
  label,
  options,
  value,
  onChange,
  allowNone,
  noneLabel,
  styles,
}: {
  label: string;
  options: T[];
  value: number | null;
  onChange: (id: number | null) => void;
  allowNone?: boolean;
  noneLabel?: string;
  styles: any;
}) {
  return (
    <>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.chipsWrap}>
        {allowNone ? (
          <TouchableOpacity style={[styles.chip, value === null && styles.chipActive]} onPress={() => onChange(null)} activeOpacity={0.75}>
            <Text style={[styles.chipText, value === null && styles.chipTextActive]}>{noneLabel}</Text>
          </TouchableOpacity>
        ) : null}
        {options.map((opt) => {
          const active = opt.id === value;
          return (
            <TouchableOpacity key={opt.id} style={[styles.chip, active && styles.chipActive]} onPress={() => onChange(opt.id)} activeOpacity={0.75}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.name}</Text>
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

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
            <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
              <Text style={styles.fieldLabel}>{t('admin_class_schedule.code_label', 'Label (optional)')}</Text>
              <TextInput
                style={styles.textInput}
                placeholder={t('admin_class_schedule.code_placeholder', 'e.g. Period 1')}
                placeholderTextColor={theme.textSecondary}
                value={code}
                onChangeText={setCode}
              />

              <ChipPicker
                label={t('admin_class_schedule.section_label', 'Class Section')}
                options={pickers.sections}
                value={sectionId}
                onChange={setSectionId}
                styles={styles}
              />

              <ChipPicker
                label={t('admin_class_schedule.subject_label', 'Subject')}
                options={pickers.subjects}
                value={subjectId}
                onChange={setSubjectId}
                allowNone
                noneLabel={t('common.none', 'None')}
                styles={styles}
              />

              <ChipPicker
                label={t('admin_class_schedule.teacher_label', 'Teacher')}
                options={pickers.teachers}
                value={teacherId}
                onChange={setTeacherId}
                allowNone
                noneLabel={t('admin_class_schedule.unassigned', 'Unassigned')}
                styles={styles}
              />

              <ChipPicker
                label={t('admin_class_schedule.room_label', 'Room')}
                options={pickers.rooms}
                value={roomId}
                onChange={setRoomId}
                allowNone
                noneLabel={t('common.none', 'None')}
                styles={styles}
              />

              <Text style={styles.fieldLabel}>{t('admin_class_schedule.day_label', 'Day')}</Text>
              <View style={styles.chipsWrap}>
                {DAYS.map((d) => {
                  const active = d.key === day;
                  return (
                    <TouchableOpacity key={d.key} style={[styles.chip, active && styles.chipActive]} onPress={() => setDay(d.key)} activeOpacity={0.75}>
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{dayLabel(t, d.key)}</Text>
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

              <TouchableOpacity
                style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
                disabled={!canSave}
                activeOpacity={0.85}
                onPress={() =>
                  sectionId &&
                  onSave({ code: code.trim(), dayOfWeek: day, startTime, endTime, sectionId, teacherId, subjectId, roomId })
                }
              >
                <Text style={styles.saveBtnText}>{t('common.save', 'Save')}</Text>
              </TouchableOpacity>

              {onDelete ? (
                <TouchableOpacity style={styles.deleteBtn} activeOpacity={0.75} onPress={onDelete}>
                  <IconTrash color={theme.danger} />
                  <Text style={styles.deleteBtnText}>{t('admin_class_schedule.remove_schedule', 'Remove this schedule slot')}</Text>
                </TouchableOpacity>
              ) : null}
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
      await saveSchedule(token, {
        code: args.code || `${args.startTime}-${args.endTime}`,
        day_of_week: args.dayOfWeek,
        starts_at: args.startTime,
        ends_at: args.endTime,
        section_id: args.sectionId,
        teacher_id: args.teacherId,
        subject_id: args.subjectId,
        room_id: args.roomId,
      });
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
    saveBtn: { marginTop: 22, backgroundColor: theme.accent, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
    saveBtnDisabled: { opacity: 0.45 },
    saveBtnText: { color: theme.onAccent, fontSize: 14.5, fontWeight: '700' },
    deleteBtn: { marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
    deleteBtnText: { color: theme.danger, fontSize: 13.5, fontWeight: '700' },
  });
