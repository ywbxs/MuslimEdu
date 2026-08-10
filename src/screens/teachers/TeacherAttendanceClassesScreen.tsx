import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import Svg, { Path, Polyline, Line, Circle } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { fetchAttendanceClasses, AttendanceClassOption } from '../../services/teacherAttendanceService';
import { Skeleton } from '../../components/Skeleton';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHADOW, GLASS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';
const EMERALD = '#2BCBB0';
const EMERALD_SOFT = '#E5F8F5';
const AMBER = '#B8860B';
const AMBER_SOFT = '#FBF2DE';
const INK = '#1C1C1E';
const SUBTLE = '#8A9099';
const HAIRLINE = '#EDEEF0';
const CANVAS = '#F6F7F9';
const GLASS_SURFACE = GLASS.fillOnLight;
const GLASS_SURFACE_STRONG = GLASS.fillOnLightStrong;
const GLASS_BORDER = GLASS.borderOnLight;

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const DAY_INDEX_TO_KEY = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function toMinutes(hhmm?: string | null): number | null {
  if (!hhmm) return null;
  const parts = hhmm.split(':');
  if (parts.length < 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function IconChevronLeft({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Polyline points="15 5 8 12 15 19" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconChevronRight({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Polyline points="9 5 16 12 9 19" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconClipboard({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M7 4h10v3H7z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M6 6h12a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Line x1={8.5} y1={12} x2={15.5} y2={12} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={8.5} y1={16} x2={13} y2={16} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function IconClock({ color }: { color: string }) {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} />
      <Polyline points="12 7 12 12 15 14" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ClassCardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton width={44} height={44} borderRadius={12} />
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Skeleton width="60%" height={15} borderRadius={4} />
        <Skeleton width="40%" height={12} borderRadius={4} style={{ marginTop: 8 }} />
      </View>
    </View>
  );
}

// One card per (section, subject) pair the teacher is allowed to take
// attendance for - homeroom sections first (from Section.class_teacher_id),
// then subject periods (from ClassSubjectTeacher), exactly as returned by
// teacher_attendance_classes. Tapping a card normally jumps to
// AttendanceMethodChooser (Manual/Scan/Face) for that pair - but when
// reached via the bottom tab bar's "Scan" tab (see MainTabs.tsx), the
// route's `directTo` param skips that chooser and jumps straight into
// AttendanceScan, since the whole point of that tab is scanning.
export default function TeacherAttendanceClassesScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const directTo = route.params?.directTo ?? 'AttendanceMethodChooser';
  const { token } = useAuth();
  const { t } = useLocale();
  const [classes, setClasses] = useState<AttendanceClassOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!token) return;
      if (!opts.silent) setIsLoading(true);
      setError(null);
      try {
        const data = await fetchAttendanceClasses(token);
        setClasses(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('teacher_attendance_classes.load_error', 'Could not load your attendance classes.'));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [token, t]
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

  // Groups classes around the teacher's schedule: whatever period is
  // happening right now floats to the top, then the rest of today's
  // periods, then everything else - nothing is hidden, just reordered.
  const sections = useMemo(() => {
    const todayKey = DAY_INDEX_TO_KEY[new Date().getDay()];
    const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();

    const nowGroup: AttendanceClassOption[] = [];
    const todayGroup: AttendanceClassOption[] = [];
    const otherGroup: AttendanceClassOption[] = [];

    classes.forEach((item) => {
      if (item.role === 'homeroom') {
        todayGroup.push(item);
        return;
      }
      if (item.day_of_week !== todayKey) {
        otherGroup.push(item);
        return;
      }
      const start = toMinutes(item.start_time);
      const end = toMinutes(item.end_time);
      if (start !== null && end !== null && nowMinutes >= start && nowMinutes < end) {
        nowGroup.push(item);
      } else {
        todayGroup.push(item);
      }
    });

    todayGroup.sort((a, b) => {
      const aMin = toMinutes(a.start_time);
      const bMin = toMinutes(b.start_time);
      if (aMin === null && bMin === null) return 0;
      if (aMin === null) return -1;
      if (bMin === null) return 1;
      return aMin - bMin;
    });

    const groups: { key: string; title: string; data: AttendanceClassOption[] }[] = [];
    if (nowGroup.length) {
      groups.push({ key: 'now', title: t('teacher_attendance_classes.section_now', 'Happening now'), data: nowGroup });
    }
    if (todayGroup.length) {
      groups.push({ key: 'today', title: t('teacher_attendance_classes.section_today', 'Later today'), data: todayGroup });
    }
    if (otherGroup.length) {
      groups.push({ key: 'other', title: t('teacher_attendance_classes.section_other', 'Other classes'), data: otherGroup });
    }
    return groups;
  }, [classes, t]);

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
          <IconChevronLeft color={INK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('teacher_attendance_classes.title', 'Take Attendance')}</Text>
        <View style={{ width: 32 }} />
      </View>

      {isLoading ? (
        <View style={styles.listContent}>
          <ClassCardSkeleton />
          <ClassCardSkeleton />
          <ClassCardSkeleton />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => `${item.section_id}-${item.subject_id}`}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={EMERALD} />}
          ListEmptyComponent={
            !error ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>{t('teacher_attendance_classes.empty_title', 'Nothing to take attendance for yet')}</Text>
                <Text style={styles.emptyDesc}>
                  {t('teacher_attendance_classes.empty_desc', "You'll see a card here once you're made a class teacher or assigned to teach a subject period.")}
                </Text>
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
          renderSectionHeader={({ section }) => <Text style={styles.sectionHeader}>{section.title}</Text>}
          renderItem={({ item }) => {
            const isHomeroom = item.role === 'homeroom';
            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.85}
                onPress={() =>
                  (navigation as any).navigate(directTo, {
                    sectionId: item.section_id,
                    subjectId: item.subject_id,
                    classLabel: `${item.class_name ?? ''} - ${item.section_name}`.trim(),
                    subjectLabel: item.subject_name ?? (isHomeroom ? t('teacher_attendance_classes.homeroom_daily', 'Homeroom / Daily') : t('teacher_attendance_classes.subject', 'Subject')),
                    date: todayISO(),
                  })
                }
              >
                <View style={[styles.cardIcon, isHomeroom ? styles.cardIconEmerald : styles.cardIconAmber]}>
                  <IconClipboard color={isHomeroom ? EMERALD : AMBER} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>
                    {item.class_name ?? t('teacher_attendance_classes.class_fallback', 'Class')} - {item.section_name}
                  </Text>
                  <View style={styles.cardMetaRow}>
                    <View style={[styles.pill, isHomeroom ? styles.pillEmerald : styles.pillAmber]}>
                      <Text style={[styles.pillText, isHomeroom ? styles.pillTextEmerald : styles.pillTextAmber]}>
                        {isHomeroom ? t('teacher_attendance_classes.homeroom', 'Homeroom') : item.subject_name ?? t('teacher_attendance_classes.subject', 'Subject')}
                      </Text>
                    </View>
                    {!isHomeroom && item.start_time ? (
                      <View style={styles.timeRow}>
                        <IconClock color={SUBTLE} />
                        <Text style={styles.cardMeta}>
                          {item.day_of_week ? `${item.day_of_week} ` : ''}
                          {item.start_time}
                          {item.end_time ? ` - ${item.end_time}` : ''}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <IconChevronRight color={SUBTLE} />
              </TouchableOpacity>
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: GLASS_SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: GLASS_BORDER,
  },
  backButton: { width: 32 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: INK },
  listContent: { padding: 16 },
  sectionHeader: {
    fontSize: 12.5,
    fontWeight: '700',
    color: SUBTLE,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
    marginTop: 4,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GLASS_SURFACE,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  ...SHADOW.level1,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cardIconEmerald: { backgroundColor: EMERALD_SOFT },
  cardIconAmber: { backgroundColor: AMBER_SOFT },
  cardTitle: { fontSize: 15.5, fontWeight: '700', color: INK },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8 },
  pillEmerald: { backgroundColor: EMERALD_SOFT },
  pillAmber: { backgroundColor: AMBER_SOFT },
  pillText: { fontSize: 11, fontWeight: '700' },
  pillTextEmerald: { color: EMERALD },
  pillTextAmber: { color: AMBER },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cardMeta: { fontSize: 11.5, color: SUBTLE },
  emptyWrap: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: INK, marginBottom: 8 },
  emptyDesc: { fontSize: 13.5, color: SUBTLE, textAlign: 'center', lineHeight: 19 },
  errorBanner: { backgroundColor: '#FCEDED', borderRadius: 12, padding: 14, marginBottom: 12 },
  errorText: { color: '#E5484D', fontSize: 13.5, textAlign: 'center' },
});
