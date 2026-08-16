import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, SectionList, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import {
  fetchAttendanceHistory,
  fetchAttendanceRoster,
  HistoryRecord,
  AttendanceStatus,
} from '../../services/teacherAttendanceService';
import { Skeleton, SkeletonCircle } from '../../components/Skeleton';
import UserAvatar from '../../components/UserAvatar';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHADOW, GLASS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';
const EMERALD = '#1FAE64';
const INK = '#1C1C1E';
const SUBTLE = '#8A9099';
const HAIRLINE = '#EDEEF0';
const CANVAS = '#F6F7F9';
const GLASS_SURFACE = GLASS.fillOnLight;
const GLASS_SURFACE_STRONG = GLASS.fillOnLightStrong;
const GLASS_BORDER = GLASS.borderOnLight;

const STATUS_META: Record<AttendanceStatus, { label: string; color: string; soft: string }> = {
  present: { label: 'Present', color: '#1FAE64', soft: '#E5F8F5' },
  late: { label: 'Late', color: '#B8860B', soft: '#FBF2DE' },
  absent: { label: 'Absent', color: '#E5484D', soft: '#FCEDED' },
  excused: { label: 'Excused', color: '#4C6EF5', soft: '#EAEDFC' },
  leave: { label: 'Leave', color: '#8A5CF6', soft: '#F0EAFC' },
};
const STATUS_LABEL_KEYS: Record<AttendanceStatus, string> = {
  present: 'present',
  late: 'late',
  absent: 'absent',
  excused: 'excused',
  leave: 'leave',
};

const RANGE_PRESETS: { key: string; label: string; days: number }[] = [
  { key: '7d', label: '7 days', days: 7 },
  { key: '30d', label: '30 days', days: 30 },
  { key: '90d', label: '90 days', days: 90 },
];

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
// Backend now sends a bare "Y-m-d" (see teacher_attendance_history's fix
// for the "Invalid Date" bug), but this stays defensive against a full ISO
// timestamp too ("2026-08-01T00:00:00.000000Z") - taking only the date
// portion before the 'T' - so a stale/uncached record shape never breaks
// the header instead of silently mis-parsing it.
function formatDateHeader(raw: string) {
  const datePart = raw.split('T')[0];
  const [y, m, d] = datePart.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function IconChevronLeft({ color }: { color: string }) {
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}

function RowSkeleton() {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <SkeletonCircle size={32} />
        <Skeleton width="50%" height={13} borderRadius={4} />
      </View>
      <Skeleton width={70} height={22} borderRadius={8} />
    </View>
  );
}

// Read-only history for one section/subject the teacher takes attendance
// for. teacher_attendance_history returns records with student_id only (no
// name), so this screen fetches the roster once (any date works - the
// student list itself isn't date-scoped, only each record's status is) to
// build a student_id -> name map, then groups history records by date.
export default function TeacherAttendanceHistoryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { sectionId, subjectId, classLabel, subjectLabel } = route.params ?? {};
  const { token } = useAuth();
  const { t } = useLocale();

  const [rangeKey, setRangeKey] = useState('30d');
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [nameById, setNameById] = useState<Record<number, string>>({});
  const [photoById, setPhotoById] = useState<Record<number, string | null>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => {
    const preset = RANGE_PRESETS.find((r) => r.key === rangeKey) ?? RANGE_PRESETS[1];
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - (preset.days - 1));
    return { dateFrom: toISO(from), dateTo: toISO(to) };
  }, [rangeKey]);

  const load = useCallback(async () => {
    if (!token || !sectionId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [historyData, rosterData] = await Promise.all([
        fetchAttendanceHistory(token, sectionId, subjectId ?? null, range.dateFrom, range.dateTo),
        fetchAttendanceRoster(token, sectionId, subjectId, toISO(new Date())),
      ]);
      setRecords(historyData);
      const map: Record<number, string> = {};
      const photoMap: Record<number, string | null> = {};
      rosterData.students.forEach((s) => {
        map[s.student_id] = s.student_name;
        photoMap[s.student_id] = s.photo;
      });
      setNameById(map);
      setPhotoById(photoMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('teacher_attendance_history.load_error', 'Could not load attendance history.'));
    } finally {
      setIsLoading(false);
    }
  }, [token, sectionId, subjectId, range, t]);

  useEffect(() => {
    load();
  }, [load]);

  const sections = useMemo(() => {
    const byDate = new Map<string, HistoryRecord[]>();
    records.forEach((r) => {
      const list = byDate.get(r.date) ?? [];
      list.push(r);
      byDate.set(r.date, list);
    });
    return Array.from(byDate.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([date, data]) => ({ title: date, data }));
  }, [records]);

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
          <IconChevronLeft color={INK} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{classLabel ?? t('teacher_attendance_history.title', 'Attendance History')}</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>{subjectLabel ?? ''}</Text>
        </View>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.chipRow}>
        {RANGE_PRESETS.map((preset) => (
          <TouchableOpacity
            key={preset.key}
            style={[styles.chip, rangeKey === preset.key && styles.chipActive]}
            onPress={() => setRangeKey(preset.key)}
          >
            <Text style={[styles.chipText, rangeKey === preset.key && styles.chipTextActive]}>{t(`teacher_attendance_history.range_${preset.key}`, preset.label)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.listContent}>
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          ListEmptyComponent={
            !error ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>{t('teacher_attendance_history.empty_title', 'No records in this range')}</Text>
                <Text style={styles.emptyDesc}>{t('teacher_attendance_history.empty_desc', 'Attendance you take for this class will show up here.')}</Text>
              </View>
            ) : null
          }
          ListHeaderComponent={
            error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null
          }
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{formatDateHeader(section.title)}</Text>
          )}
          renderItem={({ item }) => {
            const meta = STATUS_META[item.status];
            const name = nameById[item.student_id] ?? `${t('teacher_attendance_history.student_hash', 'Student #')}${item.student_id}`;
            return (
              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <UserAvatar name={name} photo={photoById[item.student_id]} size={32} dotColor={null} />
                  <Text style={styles.rowName} numberOfLines={1}>
                    {name}
                  </Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: meta.soft }]}>
                  <Text style={[styles.statusPillText, { color: meta.color }]}>{t(`teacher_attendance_history.status_${STATUS_LABEL_KEYS[item.status]}`, meta.label)}</Text>
                </View>
              </View>
            );
          }}
        />
      )}
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
  headerSubtitle: { fontSize: 12, color: SUBTLE, textAlign: 'center', marginTop: 2 },

  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: GLASS_SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: GLASS_BORDER,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  chipActive: { backgroundColor: EMERALD, borderColor: EMERALD },
  chipText: { fontSize: 12.5, fontWeight: '600', color: SUBTLE },
  chipTextActive: { color: '#FFFFFF' },

  listContent: { padding: 16, paddingBottom: 40 },
  sectionHeader: { fontSize: 12.5, fontWeight: '700', color: SUBTLE, marginTop: 14, marginBottom: 8 },
  row: {
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
  rowLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, marginRight: 10 },
  rowName: { flex: 1, fontSize: 13.5, fontWeight: '600', color: INK },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusPillText: { fontSize: 11.5, fontWeight: '700' },

  emptyWrap: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: INK, marginBottom: 8 },
  emptyDesc: { fontSize: 13.5, color: SUBTLE, textAlign: 'center', lineHeight: 19 },
  errorBanner: { backgroundColor: '#FCEDED', borderRadius: 12, padding: 14, marginBottom: 12 },
  errorText: { color: '#E5484D', fontSize: 13.5, textAlign: 'center' },
});
