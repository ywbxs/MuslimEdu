import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import KeyboardAwareModal from '../../components/KeyboardAwareModal';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { ChevronLeft, ChevronRight, CircleCheck, RotateCcwClock } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { useOfflineQueue } from '../../context/OfflineQueueContext';
import {
  fetchAttendanceRoster,
  submitAttendance,
  applyRecordsToCachedRoster,
  fetchTeacherAttendanceStatuses,
  RosterStudent,
  AttendanceStatus,
  DynamicAttendanceStatus,
  ATTENDANCE_STATUSES,
} from '../../services/teacherAttendanceService';
import { enqueueAttendanceSubmit } from '../../services/offlineQueue';
import { Skeleton, SkeletonCircle } from '../../components/Skeleton';
import BigAttendanceCard, { SwipeDirection, DirectionMeta } from '../../components/BigAttendanceCard';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHADOW, GLASS, RADIUS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';
const EMERALD = '#1FAE64';
const EMERALD_SOFT = '#E5F8F5';
const INK = '#1C1C1E';
const SUBTLE = '#8A9099';
const HAIRLINE = '#EDEEF0';
const CANVAS = '#F6F7F9';
const GLASS_SURFACE = GLASS.fillOnLight;
const GLASS_SURFACE_STRONG = GLASS.fillOnLightStrong;
const GLASS_BORDER = GLASS.borderOnLight;

interface StatusMeta {
  label: string;
  short: string;
  color: string;
  soft: string;
}

// Fallback for the brief window before fetchTeacherAttendanceStatuses()
// resolves (and for a school with no configured statuses at all, though the
// backend already returns these same 5 defaults in that case too).
const DEFAULT_STATUS_META: Record<string, StatusMeta> = {
  present: { label: 'Present', short: 'P', color: '#1FAE64', soft: '#E5F8F5' },
  late: { label: 'Late', short: 'L', color: '#B8860B', soft: '#FBF2DE' },
  absent: { label: 'Absent', short: 'A', color: '#E5484D', soft: '#FCEDED' },
  excused: { label: 'Excused', short: 'E', color: '#4C6EF5', soft: '#EAEDFC' },
  leave: { label: 'Leave', short: 'Lv', color: '#8A5CF6', soft: '#F0EAFC' },
};

// Lightens a "#RRGGBB" color into a soft translucent fill, so a dynamically
// configured status color always has a matching soft background without
// needing a second color stored per status.
function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function buildStatusMeta(statuses: DynamicAttendanceStatus[]): Record<string, StatusMeta> {
  if (statuses.length === 0) return DEFAULT_STATUS_META;
  const meta: Record<string, StatusMeta> = {};
  statuses.forEach((s) => {
    const color = s.color ?? '#8A9099';
    meta[s.code] = { label: s.label, short: s.label.slice(0, 2), color, soft: withAlpha(color, 0.12) };
  });
  return meta;
}

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
  return <ChevronLeft size={size} color={color} strokeWidth={2.4} />;
}
function IconChevronRight({ color, size = 22 }: { color: string; size?: number }) {
  return <ChevronRight size={size} color={color} strokeWidth={2.4} />;
}
function IconHistory({ color }: { color: string }) {
  return <RotateCcwClock size={20} color={color} strokeWidth={2} />;
}
function IconCheckCircle({ color }: { color: string }) {
  return <CircleCheck size={16} color={color} strokeWidth={2} />;
}

// The first 4 configured statuses (by sort_order) map to the 4 swipe
// directions on BigAttendanceCard, in this fixed position order. Any
// statuses beyond the first 4 don't get a swipe direction; they're only
// reachable from the detail sheet opened by tapping a card instead - see
// StudentDetailSheet below (mirrors how "leave" was the 5th, sheet-only
// status before statuses became school-configurable).
const SWIPE_DIRECTION_ORDER: SwipeDirection[] = ['right', 'left', 'up', 'down'];

// Opened by tapping (not swiping) a card - lets a teacher pick any of the 5
// statuses explicitly (covers Leave, which has no swipe direction) and add
// a remark, without needing a 5th/6th gesture.
function StudentDetailSheet({
  visible,
  studentName,
  status,
  remarks,
  statuses,
  statusMeta,
  onChangeStatus,
  onChangeRemarks,
  onClose,
}: {
  visible: boolean;
  studentName: string;
  status: AttendanceStatus | null;
  remarks: string;
  statuses: DynamicAttendanceStatus[];
  statusMeta: Record<string, StatusMeta>;
  onChangeStatus: (status: AttendanceStatus) => void;
  onChangeRemarks: (text: string) => void;
  onClose: () => void;
}) {
  const { t } = useLocale();
  return (
    <KeyboardAwareModal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <TouchableOpacity style={styles.flex1} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle} numberOfLines={1}>{studentName}</Text>
          <View style={styles.sheetStatusRow}>
            {statuses.map((s) => {
              const meta = statusMeta[s.code] ?? DEFAULT_STATUS_META.present;
              const active = status === s.code;
              return (
                <TouchableOpacity
                  key={s.code}
                  style={[styles.sheetStatusChip, { backgroundColor: active ? meta.color : meta.soft }]}
                  activeOpacity={0.8}
                  onPress={() => onChangeStatus(s.code)}
                >
                  <Text style={[styles.sheetStatusChipText, { color: active ? '#FFFFFF' : meta.color }]}>
                    {t(`teacher_attendance_roster.status_${s.code}`, meta.label)}
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
    </KeyboardAwareModal>
  );
}

export default function TeacherAttendanceRosterScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { sectionId, subjectId, classLabel, subjectLabel, date: initialDate } = route.params ?? {};
  const { token } = useAuth();
  const { t } = useLocale();
  const { isOnline } = useOfflineQueue();

  const [configuredStatuses, setConfiguredStatuses] = useState<DynamicAttendanceStatus[]>([]);
  const statusMeta = useMemo(() => buildStatusMeta(configuredStatuses), [configuredStatuses]);
  const statusLabel = (status: AttendanceStatus) =>
    t(`teacher_attendance_roster.status_${status}`, (statusMeta[status] ?? DEFAULT_STATUS_META.present).label);

  const effectiveStatuses: DynamicAttendanceStatus[] = useMemo(
    () =>
      configuredStatuses.length > 0
        ? configuredStatuses
        : ATTENDANCE_STATUSES.map((code) => ({
            id: 0,
            code,
            label: DEFAULT_STATUS_META[code]?.label ?? code,
            color: DEFAULT_STATUS_META[code]?.color ?? null,
            counts_as_present: false,
            requires_remark: false,
            sort_order: 0,
          })),
    [configuredStatuses],
  );

  const directionMeta: Partial<Record<SwipeDirection, DirectionMeta>> = useMemo(() => {
    const result: Partial<Record<SwipeDirection, DirectionMeta>> = {};
    effectiveStatuses.slice(0, 4).forEach((s, i) => {
      const meta = statusMeta[s.code] ?? DEFAULT_STATUS_META.present;
      result[SWIPE_DIRECTION_ORDER[i]] = { code: s.code, label: meta.label, color: meta.color };
    });
    return result;
  }, [effectiveStatuses, statusMeta]);

  useEffect(() => {
    if (!token) return;
    fetchTeacherAttendanceStatuses(token)
      .then(setConfiguredStatuses)
      .catch(() => {
        // Falls back to DEFAULT_STATUS_META - the swipe card still works
        // with the original 5 statuses.
      });
  }, [token]);

  const [date, setDate] = useState<string>(initialDate ?? toISO(new Date()));
  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [statuses, setStatuses] = useState<Record<number, AttendanceStatus>>({});
  const [remarksMap, setRemarksMap] = useState<Record<number, string>>({});
  const [detailStudentId, setDetailStudentId] = useState<number | null>(null);
  // Which student's big card is on top of the deck - one at a time, like a
  // photo gallery, instead of the old scrolling list of small rows.
  const [cardIndex, setCardIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [lockedAt, setLockedAt] = useState<string | null>(null);
  const [lockedByName, setLockedByName] = useState<string | null>(null);

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
      setCardIndex(0);
      setLocked(!!data.locked);
      setLockedAt(data.locked_at ?? null);
      setLockedByName(data.locked_by_name ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('teacher_attendance_roster.load_error', 'Could not load the roster.'));
    } finally {
      setIsLoading(false);
    }
  }, [token, sectionId, subjectId, date, t]);

  // useFocusEffect, not a plain useEffect: a plain effect only reruns when
  // load()'s own deps change (token, section, subject, date) - navigating
  // away (e.g. to History) and back to this exact same screen instance
  // doesn't change any of those, so a leftover error from an earlier failed
  // save used to sit on screen indefinitely instead of clearing on the next
  // real visit. This also covers the initial mount, so no separate
  // useEffect is needed alongside it.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const shiftDate = (deltaDays: number) => {
    const d = fromISO(date);
    d.setDate(d.getDate() + deltaDays);
    const next = toISO(d);
    if (fromISO(next).getTime() > fromISO(toISO(new Date())).getTime()) return; // no future dates
    setDate(next);
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
    if (!token || !sectionId || locked) return;
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
      if (!isOnline) {
        // Queue the batch instead of sending it - offlineQueue auto-flushes
        // it through this same submitAttendance() the moment connectivity
        // returns. Update the cached roster now so reopening this screen
        // before that happens still shows what was just "saved."
        enqueueAttendanceSubmit(token, sectionId, subjectId, date, records);
        await applyRecordsToCachedRoster(token, sectionId, subjectId, date, records);
        setSaveMessage(t('teacher_attendance_roster.saved_offline', 'Saved offline - will sync automatically once you’re back online.'));
      } else {
        const result = await submitAttendance(token, sectionId, subjectId, date, records);
        setSaveMessage(result.message ?? t('teacher_attendance_roster.saved', 'Attendance saved.'));
        if (result.locked) {
          setLocked(true);
          setLockedAt(result.locked_at ?? null);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('teacher_attendance_roster.save_error', 'Could not save attendance.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top }]}>
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

      {!isLoading && locked ? (
        <View style={[styles.lockBanner, styles.bannerMargin]}>
          <Text style={styles.lockBannerTitle}>
            {t('teacher_attendance_roster.locked_title', 'Attendance locked')}
          </Text>
          <Text style={styles.lockBannerText}>
            {lockedByName
              ? t('teacher_attendance_roster.locked_by', 'Submitted by {name}. Ask an admin to unlock this day to make changes.').replace('{name}', lockedByName)
              : t('teacher_attendance_roster.locked_generic', 'This day has already been submitted. Ask an admin to unlock it to make changes.')}
          </Text>
        </View>
      ) : null}

      {error ? (
        <View style={[styles.errorBanner, styles.bannerMargin]}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      {saveMessage ? (
        <View style={[styles.successBanner, styles.bannerMargin]}>
          <IconCheckCircle color={EMERALD} />
          <Text style={styles.successText}>{saveMessage}</Text>
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.deckWrap}>
          <View style={styles.bigSkeletonCard}>
            <SkeletonCircle size={136} style={{ marginBottom: 16 }} />
            <Skeleton width="60%" height={18} style={{ marginBottom: 8 }} />
            <Skeleton width="40%" height={12} />
          </View>
        </View>
      ) : students.length === 0 ? (
        !error ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>{t('teacher_attendance_roster.empty_title', 'No students enrolled')}</Text>
            <Text style={styles.emptyDesc}>{t('teacher_attendance_roster.empty_desc', 'This section has no enrolled students for the running session.')}</Text>
          </View>
        ) : null
      ) : locked ? (
        // Read-only once locked - no swipeable deck, since nothing here can
        // be saved anyway (handleSave bails out early, and the backend
        // rejects a resubmit too). Just a plain list of what was submitted.
        <View style={styles.lockedListWrap}>
          {students.map((s) => {
            const status = statuses[s.student_id] ?? null;
            const meta = status ? statusMeta[status] ?? DEFAULT_STATUS_META.present : null;
            return (
              <View key={s.student_id} style={styles.lockedListRow}>
                <Text style={styles.lockedListName} numberOfLines={1}>{s.student_name}</Text>
                {meta ? (
                  <View style={[styles.lockedListPill, { backgroundColor: meta.soft }]}>
                    <Text style={[styles.lockedListPillText, { color: meta.color }]}>{statusLabel(status as AttendanceStatus)}</Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.deckWrap}>
          <Text style={styles.progressText}>
            {t('teacher_attendance_roster.marked_progress', '{marked} of {total} marked')
              .replace('{marked}', String(markedCount))
              .replace('{total}', String(students.length))}
            {Object.entries(summaryCounts).length > 0
              ? '  ·  ' +
                Object.entries(summaryCounts)
                  .map(([s, c]) => `${(statusMeta[s] ?? DEFAULT_STATUS_META.present).short} ${c}`)
                  .join('  ')
              : ''}
          </Text>

          {cardIndex < students.length ? (
            (() => {
              const item = students[cardIndex];
              const currentStatus = statuses[item.student_id] ?? null;
              const meta = currentStatus ? statusMeta[currentStatus] ?? DEFAULT_STATUS_META.present : null;
              return (
                <BigAttendanceCard
                  key={item.student_id}
                  name={item.student_name}
                  photo={item.photo}
                  subtitle={item.code ? `${t('teacher_attendance_roster.id_prefix', 'ID')}: ${item.code}` : null}
                  address={item.address}
                  age={item.age}
                  statusLabel={currentStatus ? statusLabel(currentStatus) : null}
                  statusColor={meta?.color}
                  statusSoft={meta?.soft}
                  directionMeta={directionMeta}
                  onSwipeComplete={(_direction, code) => {
                    setStatuses((prev) => ({ ...prev, [item.student_id]: code }));
                    setCardIndex((i) => i + 1);
                  }}
                  onPress={() => setDetailStudentId(item.student_id)}
                />
              );
            })()
          ) : (
            <View style={styles.completeCard}>
              <IconCheckCircle color={EMERALD} />
              <Text style={styles.completeTitle}>{t('teacher_attendance_roster.deck_done_title', "That's everyone")}</Text>
              <Text style={styles.completeDesc}>
                {t('teacher_attendance_roster.deck_done_desc', 'Review a card below or tap Save Attendance to submit.')}
              </Text>
            </View>
          )}

          <View style={styles.deckNavRow}>
            <TouchableOpacity
              style={[styles.deckNavBtn, cardIndex === 0 && styles.deckNavBtnDisabled]}
              onPress={() => setCardIndex((i) => Math.max(0, i - 1))}
              disabled={cardIndex === 0}
              hitSlop={10}
            >
              <IconChevronLeft color={cardIndex === 0 ? '#C4C9CF' : INK} size={20} />
            </TouchableOpacity>
            <Text style={styles.deckNavCount}>
              {Math.min(cardIndex + 1, students.length)} / {students.length}
            </Text>
            <TouchableOpacity
              style={[styles.deckNavBtn, cardIndex >= students.length && styles.deckNavBtnDisabled]}
              onPress={() => setCardIndex((i) => Math.min(students.length, i + 1))}
              disabled={cardIndex >= students.length}
              hitSlop={10}
            >
              <IconChevronRight color={cardIndex >= students.length ? '#C4C9CF' : INK} size={20} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!isLoading && students.length > 0 && !locked ? (
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
        statuses={effectiveStatuses}
        statusMeta={statusMeta}
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

  // flex-start, not 'center': centering re-balances against whatever space
  // is left above it, so an error/success banner appearing (shrinking that
  // space) yanked the progress text and card upward right against the
  // banner instead of just pushing the deck down - looked like the two were
  // overlapping. Anchoring to the top keeps the deck's position stable
  // regardless of whether a banner is showing.
  deckWrap: { flex: 1, paddingTop: 16, paddingBottom: 16, justifyContent: 'flex-start' },
  bannerMargin: { marginHorizontal: 16, marginTop: 12, marginBottom: 4 },
  progressText: { fontSize: 12.5, color: SUBTLE, marginTop: 8, marginBottom: 14, fontWeight: '600', textAlign: 'center' },
  bigSkeletonCard: {
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
    backgroundColor: GLASS_SURFACE,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    paddingVertical: 40,
    marginHorizontal: 20,
    ...SHADOW.level2,
  },
  completeCard: {
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
    backgroundColor: GLASS_SURFACE,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    paddingVertical: 44,
    paddingHorizontal: 24,
    marginHorizontal: 20,
    ...SHADOW.level2,
  },
  completeTitle: { fontSize: 17, fontWeight: '700', color: INK, marginTop: 12, marginBottom: 6 },
  completeDesc: { fontSize: 13, color: SUBTLE, textAlign: 'center', lineHeight: 18 },
  deckNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginTop: 20,
  },
  deckNavBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: GLASS_SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  deckNavBtnDisabled: { opacity: 0.4 },
  deckNavCount: { fontSize: 13.5, fontWeight: '700', color: INK, minWidth: 56, textAlign: 'center' },
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
  lockBanner: { backgroundColor: '#FBF2DE', borderRadius: 12, padding: 14 },
  lockBannerTitle: { color: '#8A6417', fontSize: 13.5, fontWeight: '800', marginBottom: 4 },
  lockBannerText: { color: '#8A6417', fontSize: 12.5, lineHeight: 17 },

  lockedListWrap: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  lockedListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: GLASS_SURFACE,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    ...SHADOW.level1,
  },
  lockedListName: { flex: 1, fontSize: 13.5, fontWeight: '600', color: INK, marginRight: 10 },
  lockedListPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  lockedListPillText: { fontSize: 11.5, fontWeight: '700' },

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
