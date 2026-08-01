import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Svg, { Path, Polyline, Line, Circle } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import {
  fetchAttendanceRoster,
  submitAttendance,
  RosterStudent,
  AttendanceStatus,
  ATTENDANCE_STATUSES,
} from '../../services/teacherAttendanceService';
import { Skeleton, SkeletonCircle } from '../../components/Skeleton';
import SwipeableAttendanceCard, { SwipeDirection } from '../../components/SwipeableAttendanceCard';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHADOW, GLASS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';
const EMERALD = '#0F9D58';
const EMERALD_SOFT = '#E7F5EC';
const INK = '#1C1C1E';
const SUBTLE = '#8A9099';
const HAIRLINE = '#EDEEF0';
const CANVAS = '#F6F7F9';
const GLASS_SURFACE = GLASS.fillOnLight;
const GLASS_SURFACE_STRONG = GLASS.fillOnLightStrong;
const GLASS_BORDER = GLASS.borderOnLight;

const STATUS_META: Record<AttendanceStatus, { label: string; short: string; color: string; soft: string }> = {
  present: { label: 'Present', short: 'P', color: '#0F9D58', soft: '#E7F5EC' },
  late: { label: 'Late', short: 'L', color: '#B8860B', soft: '#FBF2DE' },
  absent: { label: 'Absent', short: 'A', color: '#E5484D', soft: '#FCEDED' },
  excused: { label: 'Excused', short: 'E', color: '#4C6EF5', soft: '#EAEDFC' },
  leave: { label: 'Leave', short: 'Lv', color: '#8A5CF6', soft: '#F0EAFC' },
};

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fromISO(s: string) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function formatDateLabel(iso: string, t: (key: string, fallback?: string) => string) {
  const d = fromISO(iso);
  const today = toISO(new Date());
  const yestDate = new Date();
  yestDate.setDate(yestDate.getDate() - 1);
  if (iso === today) return t('teacher_attendance_roster.today', 'Today');
  if (iso === toISO(yestDate)) return t('teacher_attendance_roster.yesterday', 'Yesterday');
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function IconChevronLeft({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline points="15 5 8 12 15 19" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconChevronRight({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline points="9 5 16 12 9 19" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconHistory({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={13} r={8} stroke={color} strokeWidth={2} />
      <Polyline points="12 9 12 13 15 15" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M5 5L3 7" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function IconCheckCircle({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} />
      <Polyline points="8.5 12 11 14.5 15.5 9.5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function StudentRowSkeleton() {
  return (
    <View style={styles.row}>
      <SkeletonCircle size={40} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Skeleton width="55%" height={14} borderRadius={4} />
      </View>
      <Skeleton width={150} height={30} borderRadius={8} />
    </View>
  );
}

// right=Present, left=Absent, up=Excused, down=Late - the 4 quick swipe
// directions on SwipeableAttendanceCard. Leave (and remarks) don't get a
// swipe direction; they're set from the detail sheet opened by tapping a
// card instead - see StudentDetailSheet below.
const SWIPE_TO_STATUS: Record<SwipeDirection, AttendanceStatus> = {
  right: 'present',
  left: 'absent',
  up: 'excused',
  down: 'late',
};

// Opened by tapping (not swiping) a card - lets a teacher pick any of the 5
// statuses explicitly (covers Leave, which has no swipe direction) and add
// a remark, without needing a 5th/6th gesture.
function StudentDetailSheet({
  visible,
  studentName,
  status,
  remarks,
  onChangeStatus,
  onChangeRemarks,
  onClose,
}: {
  visible: boolean;
  studentName: string;
  status: AttendanceStatus | null;
  remarks: string;
  onChangeStatus: (status: AttendanceStatus) => void;
  onChangeRemarks: (text: string) => void;
  onClose: () => void;
}) {
  const { t } = useLocale();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <TouchableOpacity style={styles.flex1} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle} numberOfLines={1}>{studentName}</Text>
          <View style={styles.sheetStatusRow}>
            {ATTENDANCE_STATUSES.map((s) => {
              const meta = STATUS_META[s];
              const active = status === s;
              return (
                <TouchableOpacity
                  key={s}
                  style={[styles.sheetStatusChip, { backgroundColor: active ? meta.color : meta.soft }]}
                  activeOpacity={0.8}
                  onPress={() => onChangeStatus(s)}
                >
                  <Text style={[styles.sheetStatusChipText, { color: active ? '#FFFFFF' : meta.color }]}>
                    {t(`teacher_attendance_roster.status_${s}`, meta.label)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.sheetLabel}>{t('teacher_attendance_roster.remarks_label', 'Remarks (optional)')}</Text>
          <TextInput
            style={styles.sheetInput}
            value={remarks}
            onChangeText={onChangeRemarks}
            placeholder={t('teacher_attendance_roster.remarks_placeholder', 'e.g. reason for excuse')}
            placeholderTextColor={SUBTLE}
            multiline
          />
          <TouchableOpacity style={styles.sheetDoneBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.sheetDoneText}>{t('common.done', 'Done')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function TeacherAttendanceRosterScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { sectionId, subjectId, classLabel, subjectLabel, date: initialDate } = route.params ?? {};
  const { token } = useAuth();
  const { t } = useLocale();
  const statusLabel = (status: AttendanceStatus) => t(`teacher_attendance_roster.status_${status}`, STATUS_META[status].label);

  const [date, setDate] = useState<string>(initialDate ?? toISO(new Date()));
  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [statuses, setStatuses] = useState<Record<number, AttendanceStatus>>({});
  const [remarksMap, setRemarksMap] = useState<Record<number, string>>({});
  const [detailStudentId, setDetailStudentId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const isFuture = fromISO(date).getTime() > fromISO(toISO(new Date())).getTime();

  const load = useCallback(async () => {
    if (!token || !sectionId) return;
    setIsLoading(true);
    setError(null);
    setSaveMessage(null);
    try {
      const data = await fetchAttendanceRoster(token, sectionId, subjectId, date);
      setStudents(data.students);
      const initial: Record<number, AttendanceStatus> = {};
      const initialRemarks: Record<number, string> = {};
      data.students.forEach((s) => {
        if (s.status) initial[s.student_id] = s.status;
        if (s.remarks) initialRemarks[s.student_id] = s.remarks;
      });
      setStatuses(initial);
      setRemarksMap(initialRemarks);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('teacher_attendance_roster.load_error', 'Could not load the roster.'));
    } finally {
      setIsLoading(false);
    }
  }, [token, sectionId, subjectId, date, t]);

  useEffect(() => {
    load();
  }, [load]);

  const shiftDate = (deltaDays: number) => {
    const d = fromISO(date);
    d.setDate(d.getDate() + deltaDays);
    const next = toISO(d);
    if (fromISO(next).getTime() > fromISO(toISO(new Date())).getTime()) return; // no future dates
    setDate(next);
  };

  const markAll = (status: AttendanceStatus) => {
    const next: Record<number, AttendanceStatus> = {};
    students.forEach((s) => {
      next[s.student_id] = status;
    });
    setStatuses(next);
  };

  const markedCount = Object.keys(statuses).length;
  const summaryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(statuses).forEach((s) => {
      counts[s] = (counts[s] ?? 0) + 1;
    });
    return counts;
  }, [statuses]);

  const handleSave = async () => {
    if (!token || !sectionId) return;
    if (markedCount < students.length) {
      setError(
        t('teacher_attendance_roster.mark_all_first', 'Mark all {total} students before saving ({done} done).')
          .replace('{total}', String(students.length))
          .replace('{done}', String(markedCount)),
      );
      return;
    }
    setIsSaving(true);
    setError(null);
    setSaveMessage(null);
    try {
      const records = students.map((s) => ({
        student_id: s.student_id,
        status: statuses[s.student_id],
        remarks: remarksMap[s.student_id] || undefined,
      }));
      const result = await submitAttendance(token, sectionId, subjectId, date, records);
      setSaveMessage(result.message ?? t('teacher_attendance_roster.saved', 'Attendance saved.'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('teacher_attendance_roster.save_error', 'Could not save attendance.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
          <IconChevronLeft color={INK} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{classLabel ?? t('teacher_attendance_roster.title', 'Attendance')}</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>{subjectLabel ?? ''}</Text>
        </View>
        <TouchableOpacity
          onPress={() =>
            (navigation as any).navigate('TeacherAttendanceHistory', { sectionId, subjectId, classLabel, subjectLabel })
          }
          hitSlop={10}
          style={styles.historyButton}
        >
          <IconHistory color={INK} />
        </TouchableOpacity>
      </View>

      <View style={styles.dateBar}>
        <TouchableOpacity onPress={() => shiftDate(-1)} hitSlop={10} style={styles.dateArrow}>
          <IconChevronLeft color={INK} size={18} />
        </TouchableOpacity>
        <Text style={styles.dateLabel}>{formatDateLabel(date, t)}</Text>
        <TouchableOpacity onPress={() => shiftDate(1)} hitSlop={10} style={styles.dateArrow} disabled={isFuture}>
          <IconChevronRight color={isFuture ? '#D5D8DC' : INK} size={18} />
        </TouchableOpacity>
      </View>

      {!isLoading && students.length > 0 ? (
        <View style={styles.quickBar}>
          <Text style={styles.quickBarLabel}>{t('teacher_attendance_roster.quick_mark', 'Quick mark:')}</Text>
          {ATTENDANCE_STATUSES.map((status) => (
            <TouchableOpacity key={status} style={styles.quickBarBtn} onPress={() => markAll(status)}>
              <Text style={[styles.quickBarBtnText, { color: STATUS_META[status].color }]}>
                {t('teacher_attendance_roster.all_status', 'All {status}').replace('{status}', statusLabel(status))}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {!isLoading && students.length > 0 ? (
        <View style={styles.legendBar}>
          <Text style={styles.legendText}>
            {t(
              'teacher_attendance_roster.swipe_legend',
              'Swipe right: Present  ·  left: Absent  ·  up: Excused  ·  down: Late  ·  tap for Leave/remarks',
            )}
          </Text>
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.listContent}>
          <StudentRowSkeleton />
          <StudentRowSkeleton />
          <StudentRowSkeleton />
          <StudentRowSkeleton />
        </View>
      ) : (
        <FlatList
          data={students}
          keyExtractor={(item) => String(item.student_id)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            !error ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>{t('teacher_attendance_roster.empty_title', 'No students enrolled')}</Text>
                <Text style={styles.emptyDesc}>{t('teacher_attendance_roster.empty_desc', 'This section has no enrolled students for the running session.')}</Text>
              </View>
            ) : null
          }
          ListHeaderComponent={
            <>
              {error ? (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}
              {saveMessage ? (
                <View style={styles.successBanner}>
                  <IconCheckCircle color={EMERALD} />
                  <Text style={styles.successText}>{saveMessage}</Text>
                </View>
              ) : null}
              {students.length > 0 ? (
                <Text style={styles.progressText}>
                  {t('teacher_attendance_roster.marked_progress', '{marked} of {total} marked')
                    .replace('{marked}', String(markedCount))
                    .replace('{total}', String(students.length))}
                  {Object.entries(summaryCounts).length > 0
                    ? '  ·  ' +
                      Object.entries(summaryCounts)
                        .map(([s, c]) => `${STATUS_META[s as AttendanceStatus].short} ${c}`)
                        .join('  ')
                    : ''}
                </Text>
              ) : null}
            </>
          }
          renderItem={({ item }) => {
            const currentStatus = statuses[item.student_id] ?? null;
            const meta = currentStatus ? STATUS_META[currentStatus] : null;
            return (
              <SwipeableAttendanceCard
                name={item.student_name}
                photo={item.photo}
                statusLabel={currentStatus ? statusLabel(currentStatus) : null}
                statusColor={meta?.color}
                statusSoft={meta?.soft}
                onSwipe={(direction) =>
                  setStatuses((prev) => ({ ...prev, [item.student_id]: SWIPE_TO_STATUS[direction] }))
                }
                onPress={() => setDetailStudentId(item.student_id)}
              />
            );
          }}
        />
      )}

      {!isLoading && students.length > 0 ? (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.saveButton} activeOpacity={0.85} onPress={handleSave} disabled={isSaving}>
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>{t('teacher_attendance_roster.save_attendance', 'Save Attendance')}</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      <StudentDetailSheet
        visible={detailStudentId !== null}
        studentName={students.find((s) => s.student_id === detailStudentId)?.student_name ?? ''}
        status={detailStudentId !== null ? statuses[detailStudentId] ?? null : null}
        remarks={detailStudentId !== null ? remarksMap[detailStudentId] ?? '' : ''}
        onChangeStatus={(status) => {
          if (detailStudentId === null) return;
          setStatuses((prev) => ({ ...prev, [detailStudentId]: status }));
        }}
        onChangeRemarks={(text) => {
          if (detailStudentId === null) return;
          setRemarksMap((prev) => ({ ...prev, [detailStudentId]: text }));
        }}
        onClose={() => setDetailStudentId(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: GLASS_SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: GLASS_BORDER,
  },
  backButton: { width: 32 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: INK, textAlign: 'center' },
  historyButton: { width: 32, alignItems: 'flex-end' },
  headerSubtitle: { fontSize: 12, color: SUBTLE, textAlign: 'center', marginTop: 2 },

  dateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GLASS_SURFACE,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: GLASS_BORDER,
  },
  dateArrow: { paddingHorizontal: 18 },
  dateLabel: { fontSize: 14.5, fontWeight: '700', color: INK, minWidth: 140, textAlign: 'center' },

  quickBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    backgroundColor: GLASS_SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: GLASS_BORDER,
  },
  quickBarLabel: { fontSize: 12, color: SUBTLE, fontWeight: '600' },
  quickBarBtn: { paddingVertical: 4 },
  quickBarBtnText: { fontSize: 12, fontWeight: '700' },

  legendBar: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: GLASS_SURFACE, borderBottomWidth: 1, borderBottomColor: GLASS_BORDER },
  legendText: { fontSize: 11, color: SUBTLE, textAlign: 'center' },

  listContent: { padding: 16, paddingBottom: 100 },
  progressText: { fontSize: 12.5, color: SUBTLE, marginBottom: 10, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GLASS_SURFACE,
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
  ...SHADOW.level1,
  },
  flex1: { flex: 1 },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(17,20,23,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
  },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: INK, marginBottom: 16, textAlign: 'center' },
  sheetStatusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  sheetStatusChip: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
  sheetStatusChipText: { fontSize: 13.5, fontWeight: '700' },
  sheetLabel: { fontSize: 12.5, fontWeight: '700', color: SUBTLE, marginBottom: 8, textTransform: 'uppercase' },
  sheetInput: {
    borderWidth: 1,
    borderColor: HAIRLINE,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: INK,
    minHeight: 70,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  sheetDoneBtn: { backgroundColor: EMERALD, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  sheetDoneText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  emptyWrap: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: INK, marginBottom: 8 },
  emptyDesc: { fontSize: 13.5, color: SUBTLE, textAlign: 'center', lineHeight: 19 },
  errorBanner: { backgroundColor: '#FCEDED', borderRadius: 12, padding: 14, marginBottom: 12 },
  errorText: { color: '#E5484D', fontSize: 13.5, textAlign: 'center' },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: EMERALD_SOFT,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  successText: { color: EMERALD, fontSize: 13.5, fontWeight: '700' },

  footer: {
    padding: 16,
    paddingBottom: 28,
    backgroundColor: GLASS_SURFACE,
    borderTopWidth: 1,
    borderTopColor: GLASS_BORDER,
  },
  saveButton: {
    backgroundColor: EMERALD,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
