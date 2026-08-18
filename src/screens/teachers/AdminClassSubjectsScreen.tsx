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
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Check, ChevronLeft, Clock, DoorOpen, Plus, Trash2, User, X } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import {
  fetchClassSubjects,
  assignClassSubject,
  removeClassSubject,
  createSubject,
  ClassSubjectRow,
  SubjectOption,
  AssignableTeacher,
  RoomOption,
  SemesterTermOption,
} from '../../services/teacherClassService';
import { Skeleton } from '../../components/Skeleton';
import { useAcademicGlassTheme, AcademicGlassTheme } from './academicGlassTheme';
import GlassBackground from '../../components/glass/GlassBackground';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
// Colors now come from academicTheme.ts (emerald variant) for light/dark support.

const DAYS: { key: string; label: string }[] = [
  { key: 'sunday', label: 'Sun' },
  { key: 'monday', label: 'Mon' },
  { key: 'tuesday', label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday', label: 'Thu' },
  { key: 'friday', label: 'Fri' },
  { key: 'saturday', label: 'Sat' },
];

const dayShortLabel = (t: (key: string, fallback: string) => string, dayKey: string) =>
  t(`class_subjects.day_short_${dayKey}`, DAYS.find((d) => d.key === dayKey)?.label ?? dayKey);

function IconChevronLeft({ color }: { color: string }) {
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}
function IconClose({ color }: { color: string }) {
  return <X size={18} color={color} strokeWidth={2.2} />;
}
function IconCheck({ color }: { color: string }) {
  return <Check size={16} color={color} strokeWidth={3} />;
}
function IconPerson({ color }: { color: string }) {
  return <User size={16} color={color} strokeWidth={2} />;
}
function IconDoor({ color }: { color: string }) {
  return <DoorOpen size={14} color={color} strokeWidth={2} />;
}
function IconClock({ color }: { color: string }) {
  return <Clock size={14} color={color} strokeWidth={2} />;
}
function IconPlus({ color }: { color: string }) {
  return <Plus size={18} color={color} strokeWidth={2.4} />;
}
function IconTrash({ color }: { color: string }) {
  return <Trash2 size={16} color={color} strokeWidth={2} />;
}

function RowSkeleton({ styles, theme }: { styles: any; theme: AcademicGlassTheme }) {
  return (
    <View style={styles.card}>
      <Skeleton width="45%" height={15} borderRadius={4} baseColor={theme.skeletonBase} />
      <Skeleton width="60%" height={12} borderRadius={4} style={{ marginTop: 10 }} baseColor={theme.skeletonBase} />
    </View>
  );
}

function timeLabel(row: ClassSubjectRow, t: (key: string, fallback: string) => string): string | null {
  if (!row.day_of_week && !row.start_time) return null;
  const dayLabel = row.day_of_week ? dayShortLabel(t, row.day_of_week) : undefined;
  const time = row.start_time && row.end_time ? `${row.start_time}-${row.end_time}` : row.start_time;
  return [dayLabel, time].filter(Boolean).join(' · ');
}

// --- Edit sheet: pick/create subject, pick teacher, pick day + time ---

function SubjectEditSheet({
  visible,
  onClose,
  onSave,
  onDelete,
  isSaving,
  editingRow,
  subjects,
  teachers,
  rooms,
  semesterTerms,
  onCreateSubject,
  styles,
  theme,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (args: {
    subjectId: number;
    teacherId: number | null;
    dayOfWeek: string | null;
    startTime: string | null;
    endTime: string | null;
    roomId: number | null;
    semesterTermId: number | null;
  }) => void;
  onDelete: (() => void) | null;
  isSaving: boolean;
  editingRow: ClassSubjectRow | null;
  subjects: SubjectOption[];
  teachers: AssignableTeacher[];
  rooms: RoomOption[];
  semesterTerms: SemesterTermOption[];
  onCreateSubject: (name: string) => Promise<SubjectOption | null>;
  styles: any;
  theme: AcademicGlassTheme;
}) {
  const { t } = useLocale();
  const [subjectId, setSubjectId] = useState<number | null>(editingRow?.subject_id ?? null);
  const [teacherId, setTeacherId] = useState<number | null>(editingRow?.teacher_id ?? null);
  const [day, setDay] = useState<string | null>(editingRow?.day_of_week ?? null);
  const [startTime, setStartTime] = useState(editingRow?.start_time ?? '');
  const [endTime, setEndTime] = useState(editingRow?.end_time ?? '');
  const [roomId, setRoomId] = useState<number | null>(editingRow?.room_id ?? null);
  const [semesterTermId, setSemesterTermId] = useState<number | null>(editingRow?.semester_term_id ?? null);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [isCreatingSubject, setIsCreatingSubject] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setSubjectId(editingRow?.subject_id ?? null);
      setTeacherId(editingRow?.teacher_id ?? null);
      setDay(editingRow?.day_of_week ?? null);
      setStartTime(editingRow?.start_time ?? '');
      setEndTime(editingRow?.end_time ?? '');
      setRoomId(editingRow?.room_id ?? null);
      setSemesterTermId(editingRow?.semester_term_id ?? null);
      setNewSubjectName('');
    }
  }, [visible, editingRow]);

  const timeValid =
    (!startTime && !endTime) ||
    (/^\d{2}:\d{2}$/.test(startTime) && /^\d{2}:\d{2}$/.test(endTime));

  const canSave = !!subjectId && timeValid;

  const handleCreateSubject = async () => {
    if (!newSubjectName.trim()) return;
    setIsCreatingSubject(true);
    const created = await onCreateSubject(newSubjectName.trim());
    setIsCreatingSubject(false);
    if (created) {
      setSubjectId(created.id);
      setNewSubjectName('');
    }
  };

  return (
    <KeyboardAwareModal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{editingRow ? t('class_subjects.edit_title', 'Edit Subject') : t('class_subjects.add_title', 'Add Subject')}</Text>
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
              <Text style={styles.fieldLabel}>{t('class_subjects.subject_label', 'Subject')}</Text>
              <View style={styles.chipsWrap}>
                {subjects.map((s) => {
                  const active = s.id === subjectId;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setSubjectId(s.id)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{s.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.newSubjectRow}>
                <TextInput
                  style={styles.newSubjectInput}
                  placeholder={t('class_subjects.new_subject_placeholder', 'New subject name')}
                  placeholderTextColor={theme.textSecondary}
                  value={newSubjectName}
                  onChangeText={setNewSubjectName}
                />
                <TouchableOpacity
                  style={styles.newSubjectBtn}
                  onPress={handleCreateSubject}
                  disabled={!newSubjectName.trim() || isCreatingSubject}
                  activeOpacity={0.75}
                >
                  {isCreatingSubject ? (
                    <ActivityIndicator size="small" color={theme.onAccent} />
                  ) : (
                    <IconPlus color={theme.onAccent} />
                  )}
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>{t('class_subjects.teacher_label', 'Teacher')}</Text>
              <View style={styles.chipsWrap}>
                <TouchableOpacity
                  style={[styles.chip, teacherId === null && styles.chipActive]}
                  onPress={() => setTeacherId(null)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.chipText, teacherId === null && styles.chipTextActive]}>{t('class_subjects.unassigned', 'Unassigned')}</Text>
                </TouchableOpacity>
                {teachers.map((teacher) => {
                  const active = teacher.id === teacherId;
                  return (
                    <TouchableOpacity
                      key={teacher.id}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setTeacherId(teacher.id)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{teacher.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>{t('class_subjects.day_label', 'Day')}</Text>
              <View style={styles.chipsWrap}>
                <TouchableOpacity
                  style={[styles.chip, day === null && styles.chipActive]}
                  onPress={() => setDay(null)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.chipText, day === null && styles.chipTextActive]}>{t('common.none', 'None')}</Text>
                </TouchableOpacity>
                {DAYS.map((d) => {
                  const active = d.key === day;
                  return (
                    <TouchableOpacity
                      key={d.key}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setDay(d.key)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{dayShortLabel(t, d.key)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>{t('class_subjects.time_label', 'Time (24h, e.g. 09:00)')}</Text>
              <View style={styles.timeRow}>
                <TextInput
                  style={styles.timeInput}
                  placeholder={t('class_subjects.start_placeholder', 'Start')}
                  placeholderTextColor={theme.textSecondary}
                  value={startTime}
                  onChangeText={setStartTime}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                />
                <Text style={styles.timeDash}>-</Text>
                <TextInput
                  style={styles.timeInput}
                  placeholder={t('class_subjects.end_placeholder', 'End')}
                  placeholderTextColor={theme.textSecondary}
                  value={endTime}
                  onChangeText={setEndTime}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                />
              </View>
              {!timeValid ? (
                <Text style={styles.timeError}>{t('class_subjects.time_error', 'Use HH:MM for both start and end, e.g. 09:00 and 09:45.')}</Text>
              ) : null}

              <Text style={styles.fieldLabel}>{t('class_subjects.room_label', 'Room')}</Text>
              <View style={styles.chipsWrap}>
                <TouchableOpacity
                  style={[styles.chip, roomId === null && styles.chipActive]}
                  onPress={() => setRoomId(null)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.chipText, roomId === null && styles.chipTextActive]}>{t('common.none', 'None')}</Text>
                </TouchableOpacity>
                {rooms.map((r) => {
                  const active = r.id === roomId;
                  return (
                    <TouchableOpacity
                      key={r.id}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setRoomId(r.id)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{r.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>{t('class_subjects.semester_term_label', 'Semester Term')}</Text>
              <View style={styles.chipsWrap}>
                <TouchableOpacity
                  style={[styles.chip, semesterTermId === null && styles.chipActive]}
                  onPress={() => setSemesterTermId(null)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.chipText, semesterTermId === null && styles.chipTextActive]}>{t('common.none', 'None')}</Text>
                </TouchableOpacity>
                {semesterTerms.map((term) => {
                  const active = term.id === semesterTermId;
                  return (
                    <TouchableOpacity
                      key={term.id}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setSemesterTermId(term.id)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{term.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
                disabled={!canSave}
                activeOpacity={0.85}
                onPress={() =>
                  subjectId &&
                  onSave({
                    subjectId,
                    teacherId,
                    dayOfWeek: day,
                    startTime: startTime || null,
                    endTime: endTime || null,
                    roomId,
                    semesterTermId,
                  })
                }
              >
                <Text style={styles.saveBtnText}>{t('common.save', 'Save')}</Text>
              </TouchableOpacity>

              {onDelete ? (
                <TouchableOpacity style={styles.deleteBtn} activeOpacity={0.75} onPress={onDelete}>
                  <IconTrash color={theme.danger} />
                  <Text style={styles.deleteBtnText}>{t('class_subjects.remove_subject', 'Remove subject from class')}</Text>
                </TouchableOpacity>
              ) : null}
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </KeyboardAwareModal>
  );
}

export default function AdminClassSubjectsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { sectionId, classLabel } = route.params ?? {};
  const { token } = useAuth();
  const { t } = useLocale();
  const theme = useAcademicGlassTheme('emerald');
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [sectionName, setSectionName] = useState<string | null>(classLabel ?? null);
  const [rows, setRows] = useState<ClassSubjectRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [teachers, setTeachers] = useState<AssignableTeacher[]>([]);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [semesterTerms, setSemesterTerms] = useState<SemesterTermOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingRow, setEditingRow] = useState<ClassSubjectRow | null | 'new'>(null);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!token || !sectionId) return;
      if (!opts.silent) setIsLoading(true);
      setError(null);
      try {
        const data = await fetchClassSubjects(token, sectionId);
        setSectionName(data.sectionName ?? classLabel ?? null);
        setRows(data.classSubjects);
        setSubjects(data.subjects);
        setTeachers(data.teachers);
        setRooms(data.rooms);
        setSemesterTerms(data.semesterTerms);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('class_subjects.load_error', 'Could not load subjects.'));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [token, sectionId, classLabel]
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

  const handleCreateSubject = async (name: string): Promise<SubjectOption | null> => {
    if (!token || !sectionId) return null;
    try {
      const created = await createSubject(token, sectionId, name);
      setSubjects((prev) => (prev.some((s) => s.id === created.id) ? prev : [...prev, created]));
      return created;
    } catch (err) {
      Alert.alert(t('class_subjects.add_subject_error', 'Could not add subject'), err instanceof Error ? err.message : t('common.try_again_full', 'Please try again.'));
      return null;
    }
  };

  const handleSave = async (args: {
    subjectId: number;
    teacherId: number | null;
    dayOfWeek: string | null;
    startTime: string | null;
    endTime: string | null;
    roomId: number | null;
    semesterTermId: number | null;
  }) => {
    if (!token || !sectionId) return;
    setIsSaving(true);
    try {
      await assignClassSubject(token, {
        sectionId,
        subjectId: args.subjectId,
        teacherId: args.teacherId,
        dayOfWeek: args.dayOfWeek,
        startTime: args.startTime,
        endTime: args.endTime,
        roomId: args.roomId,
        semesterTermId: args.semesterTermId,
      });
      setEditingRow(null);
      await load({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('class_subjects.save_error', 'Could not save this subject.'));
      setEditingRow(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (row: ClassSubjectRow) => {
    if (!token || !sectionId) return;
    setIsSaving(true);
    try {
      await removeClassSubject(token, sectionId, row.subject_id);
      setEditingRow(null);
      await load({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('class_subjects.remove_error', 'Could not remove this subject.'));
      setEditingRow(null);
    } finally {
      setIsSaving(false);
    }
  };

  const sheetVisible = editingRow !== null;
  const sheetRow = editingRow === 'new' ? null : editingRow;

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
          <IconChevronLeft color={theme.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {t('class_subjects.header_title', 'Subjects & Schedule')}
          </Text>
          {sectionName ? (
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {sectionName}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity onPress={() => setEditingRow('new')} hitSlop={10} style={styles.addButton}>
          <IconPlus color={theme.accent} />
        </TouchableOpacity>
      </View>

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
                <Text style={styles.emptyTitle}>{t('class_subjects.empty_title', 'No subjects yet')}</Text>
                <Text style={styles.emptyDesc}>
                  {t('class_subjects.empty_desc', 'Tap the + button to add a subject, assign a teacher, and set its weekly time slot.')}
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const assigned = !!item.teacher_id;
            const schedule = timeLabel(item, t);
            return (
              <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => setEditingRow(item)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.subject_name ?? t('class_subjects.subject_fallback', 'Subject')}</Text>
                  <View style={styles.metaRow}>
                    <View style={[styles.badge, assigned ? styles.badgeAssigned : styles.badgeUnassigned]}>
                      <IconPerson color={assigned ? theme.accent : theme.warning} />
                      <Text style={[styles.badgeText, assigned ? styles.badgeTextAssigned : styles.badgeTextUnassigned]}>
                        {assigned ? item.teacher_name : t('class_subjects.no_teacher', 'No teacher')}
                      </Text>
                    </View>
                    {schedule ? (
                      <View style={[styles.badge, styles.badgeSchedule]}>
                        <IconClock color={theme.textSecondary} />
                        <Text style={[styles.badgeText, styles.badgeTextSchedule]}>{schedule}</Text>
                      </View>
                    ) : null}
                    {item.room_name ? (
                      <View style={[styles.badge, styles.badgeSchedule]}>
                        <IconDoor color={theme.textSecondary} />
                        <Text style={[styles.badgeText, styles.badgeTextSchedule]}>{item.room_name}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <Text style={styles.changeText}>{t('common.edit', 'Edit')}</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <SubjectEditSheet
        visible={sheetVisible}
        onClose={() => setEditingRow(null)}
        onSave={handleSave}
        onDelete={sheetRow ? () => handleDelete(sheetRow) : null}
        isSaving={isSaving}
        editingRow={sheetRow}
        subjects={subjects}
        teachers={teachers}
        rooms={rooms}
        semesterTerms={semesterTerms}
        onCreateSubject={handleCreateSubject}
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
  listContent: { padding: 16 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
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
  badgeUnassigned: { backgroundColor: theme.warningSoft },
  badgeSchedule: { backgroundColor: theme.background },
  badgeText: { fontSize: 12, fontWeight: '600' },
  badgeTextAssigned: { color: theme.accent },
  badgeTextUnassigned: { color: theme.warning },
  badgeTextSchedule: { color: theme.textSecondary },
  changeText: { fontSize: 13, fontWeight: '700', color: theme.accent },
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
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
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
  newSubjectRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  newSubjectInput: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.textPrimary,
  },
  newSubjectBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
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
  saveBtn: {
    marginTop: 22,
    backgroundColor: theme.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnText: { color: theme.onAccent, fontSize: 14.5, fontWeight: '700' },
  deleteBtn: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  deleteBtnText: { color: theme.danger, fontSize: 13.5, fontWeight: '700' },
});
