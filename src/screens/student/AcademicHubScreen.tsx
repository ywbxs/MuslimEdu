import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Svg, { Polyline, Circle, Rect } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import {
  fetchStudentSchedule,
  fetchStudentSubjects,
  fetchStudentAttendance,
  fetchStudentGrades,
  fetchStudentAttendanceTrend,
  fetchStudentSubjectGradeBands,
  fetchStudentGpaSummary,
  computeSubjectAverages,
  ScheduleResponse,
  SubjectsResponse,
  AttendanceResponse,
  GradesResponse,
  MonthlyAttendancePoint,
  SubjectAverage,
  SubjectGradeBand,
  GpaSummaryResponse,
  GpaTermOption,
} from '../../services/studentAcademicService';
import { Skeleton } from '../../components/Skeleton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../theme/spatial';

const EMERALD = '#0F9D58';
const EMERALD_SOFT = '#E7F5EC';
const INK = '#1C1C1E';
const SUBTLE = '#8A9099';
const HAIRLINE = '#EDEEF0';

type TabKey = 'schedule' | 'subjects' | 'attendance' | 'grades' | 'progress';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'schedule', label: 'Schedule' },
  { key: 'subjects', label: 'Subjects' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'grades', label: 'Grades' },
  { key: 'progress', label: 'Progress' },
];

function IconChevronLeft({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Polyline points="15 5 8 12 15 19" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const ATTENDANCE_COLOR: Record<string, { color: string; soft: string }> = {
  present: { color: EMERALD, soft: EMERALD_SOFT },
  late: { color: '#B8860B', soft: '#FBF2DE' },
  excused: { color: '#3B82F6', soft: '#EAF1FE' },
  absent: { color: '#E5484D', soft: '#FCEDED' },
};

function LoadingRows() {
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} width="100%" height={64} borderRadius={14} style={{ marginBottom: 10 }} />
      ))}
    </>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.errorBanner}>
      <Text style={styles.errorText}>{message}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
        <Text style={styles.retryButtonText}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

function EmptyState({ title, desc }: { title: string; desc: string }) {
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDesc}>{desc}</Text>
    </View>
  );
}

const DAY_ORDER = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function ScheduleTab({ token }: { token: string }) {
  const [data, setData] = useState<ScheduleResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setData(await fetchStudentSchedule(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your schedule.');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(() => {
    const routines = data?.routines ?? [];
    const byDay: Record<string, typeof routines> = {};
    routines.forEach((r) => {
      const key = (r.day || '').toLowerCase();
      if (!byDay[key]) byDay[key] = [];
      byDay[key].push(r);
    });
    return DAY_ORDER.filter((d) => byDay[d]?.length).map((d) => ({
      day: d,
      entries: byDay[d].sort((a, b) => a.starting_time.localeCompare(b.starting_time)),
    }));
  }, [data]);

  if (isLoading) return <LoadingRows />;
  if (error) return <ErrorBanner message={error} onRetry={load} />;
  if (grouped.length === 0) {
    return <EmptyState title="No schedule yet" desc="Your class routine hasn't been published yet. Check back soon." />;
  }

  return (
    <>
      {grouped.map((group) => (
        <View key={group.day} style={{ marginBottom: 18 }}>
          <Text style={styles.dayHeading}>{group.day[0].toUpperCase() + group.day.slice(1)}</Text>
          {group.entries.map((entry) => (
            <View key={entry.id} style={styles.rowCard}>
              <View style={styles.timeCol}>
                <Text style={styles.timeText}>{entry.starting_time}</Text>
                <Text style={styles.timeTextSub}>{entry.ending_time}</Text>
              </View>
              <View style={styles.rowDivider} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{entry.subject_name}</Text>
                <Text style={styles.rowSubtitle}>
                  {entry.teacher_name}{entry.room_name ? ` · Room ${entry.room_name}` : ''}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ))}
    </>
  );
}

function SubjectsTab({ token }: { token: string }) {
  const [data, setData] = useState<SubjectsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setData(await fetchStudentSubjects(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your subjects.');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  if (isLoading) return <LoadingRows />;
  if (error) return <ErrorBanner message={error} onRetry={load} />;
  if (!data || data.subjects.length === 0) {
    return <EmptyState title="No subjects yet" desc="Subjects for your class haven't been set up yet." />;
  }

  return (
    <>
      {data.subjects.map((s) => (
        <View key={s.id} style={styles.rowCard}>
          <View style={styles.subjectDot} />
          <Text style={[styles.rowTitle, { flex: 1 }]}>{s.name}</Text>
        </View>
      ))}
    </>
  );
}

function AttendanceTab({ token }: { token: string }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<AttendanceResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setData(await fetchStudentAttendance(token, month, year));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your attendance.');
    } finally {
      setIsLoading(false);
    }
  }, [token, month, year]);

  useEffect(() => {
    load();
  }, [load]);

  const shiftMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setMonth(m);
    setYear(y);
  };

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const entries = data?.attedances ?? [];

  return (
    <>
      <View style={styles.monthSwitcher}>
        <TouchableOpacity onPress={() => shiftMonth(-1)} hitSlop={10} style={styles.monthArrow}>
          <Text style={styles.monthArrowText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{monthLabel}</Text>
        <TouchableOpacity onPress={() => shiftMonth(1)} hitSlop={10} style={styles.monthArrow}>
          <Text style={styles.monthArrowText}>›</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <LoadingRows />
      ) : error ? (
        <ErrorBanner message={error} onRetry={load} />
      ) : entries.length === 0 ? (
        <EmptyState title="No records" desc="No attendance has been recorded for this month yet." />
      ) : (
        entries.map((e) => {
          const meta = ATTENDANCE_COLOR[(e.status || '').toLowerCase()] ?? ATTENDANCE_COLOR.present;
          return (
            <View key={e.id} style={styles.rowCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{e.date}</Text>
                {e.is_homeroom ? <Text style={styles.rowSubtitle}>Homeroom</Text> : null}
              </View>
              <View style={[styles.statusPill, { backgroundColor: meta.soft }]}>
                <Text style={[styles.statusPillText, { color: meta.color }]}>
                  {e.status ? e.status[0].toUpperCase() + e.status.slice(1) : '—'}
                </Text>
              </View>
            </View>
          );
        })
      )}
    </>
  );
}

function GradesTab({ token }: { token: string }) {
  const [data, setData] = useState<GradesResponse | null>(null);
  const [bands, setBands] = useState<SubjectGradeBand[]>([]);
  const [termsAvailable, setTermsAvailable] = useState<GpaTermOption[]>([]);
  const [selectedTermId, setSelectedTermId] = useState<number | null>(null);
  const [bandsLoading, setBandsLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBands = useCallback(
    async (termId: number | null) => {
      setBandsLoading(true);
      try {
        const result = await fetchStudentSubjectGradeBands(token, undefined, termId ?? undefined).catch(
          () => ({ bands: [], termId: null, termsAvailable: [] })
        );
        setBands(result.bands);
        setTermsAvailable(result.termsAvailable);
      } finally {
        setBandsLoading(false);
      }
    },
    [token]
  );

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Bands are best-effort context on top of the raw marks this screen
      // already shows - if that call fails for any reason, still show marks.
      const [grades, bandsResult] = await Promise.all([
        fetchStudentGrades(token),
        fetchStudentSubjectGradeBands(token).catch(() => ({ bands: [], termId: null, termsAvailable: [] })),
      ]);
      setData(grades);
      setBands(bandsResult.bands);
      setTermsAvailable(bandsResult.termsAvailable);
      setSelectedTermId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your grades.');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const onSelectTerm = (termId: number | null) => {
    setSelectedTermId(termId);
    loadBands(termId);
  };

  if (isLoading) return <LoadingRows />;
  if (error) return <ErrorBanner message={error} onRetry={load} />;
  if (!data || data.exam_marks.length === 0) {
    return <EmptyState title="No released grades" desc="Results will appear here once your school releases them." />;
  }

  const bandFor = (examCategoryId: number, subjectId: number) =>
    bands.find((b) => b.exam_category_id === examCategoryId && b.subject_id === subjectId)?.band ?? null;

  return (
    <>
      {termsAvailable.length > 0 ? (
        <View style={styles.termSwitcherRow}>
          <TouchableOpacity
            style={[styles.termChip, selectedTermId === null && styles.termChipSelected]}
            onPress={() => onSelectTerm(null)}
          >
            <Text style={[styles.termChipText, selectedTermId === null && styles.termChipTextSelected]}>
              All terms
            </Text>
          </TouchableOpacity>
          {termsAvailable.map((t) => {
            const selected = selectedTermId === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[styles.termChip, selected && styles.termChipSelected]}
                onPress={() => onSelectTerm(t.id)}
              >
                <Text style={[styles.termChipText, selected && styles.termChipTextSelected]}>{t.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
      {bandsLoading ? <ActivityIndicator style={{ marginBottom: 12 }} /> : null}
      {data.exam_marks.map((exam) => (
        <View key={exam.exam_id} style={styles.examCard}>
          <Text style={styles.examCategory}>{exam.exam_category_name}</Text>
          {(exam.subjects ?? []).map((s) => {
            const band = bandFor(exam.exam_category_id, s.subject_id);
            return (
              <View key={s.subject_id} style={styles.gradeRow}>
                <Text style={styles.gradeSubject}>{s.subject_name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.gradeMark}>{String(s.marks)}</Text>
                  {band ? (
                    <Text
                      style={[
                        styles.gradeBandLabel,
                        { color: band.is_passing ? EMERALD : '#E5484D' },
                      ]}
                    >
                      {'  '}
                      {band.label}
                      {band.gpa_value != null ? ` (${band.gpa_value})` : ''}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
          {exam.comment ? <Text style={styles.examComment}>{exam.comment}</Text> : null}
        </View>
      ))}
    </>
  );
}

function AttendanceBarChart({ points }: { points: MonthlyAttendancePoint[] }) {
  const width = 320;
  const height = 140;
  const barGap = 10;
  const barWidth = (width - barGap * (points.length - 1)) / points.length;
  const chartTop = 10;
  const chartBottom = height - 24;
  const chartHeight = chartBottom - chartTop;

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      {points.map((p, i) => {
        const x = i * (barWidth + barGap);
        const pct = p.presentRatePct ?? 0;
        const barHeight = p.presentRatePct === null ? 0 : (pct / 100) * chartHeight;
        const color = pct >= 90 ? EMERALD : pct >= 75 ? '#B8860B' : '#E5484D';
        return (
          <React.Fragment key={`${p.year}-${p.month}`}>
            <Rect
              x={x}
              y={chartTop}
              width={barWidth}
              height={chartHeight}
              rx={6}
              fill="#F1F3F2"
            />
            {p.presentRatePct !== null ? (
              <Rect
                x={x}
                y={chartBottom - barHeight}
                width={barWidth}
                height={Math.max(barHeight, 3)}
                rx={6}
                fill={color}
              />
            ) : null}
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

function ProgressTab({ token }: { token: string }) {
  const [attendance, setAttendance] = useState<MonthlyAttendancePoint[] | null>(null);
  const [subjectAverages, setSubjectAverages] = useState<SubjectAverage[] | null>(null);
  const [gpa, setGpa] = useState<GpaSummaryResponse | null>(null);
  const [selectedTermId, setSelectedTermId] = useState<number | null>(null);
  const [gpaLoading, setGpaLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadGpa = useCallback(
    async (termId: number | null) => {
      setGpaLoading(true);
      try {
        const gpaSummary = await fetchStudentGpaSummary(token, termId ?? undefined).catch(() => null);
        setGpa(gpaSummary);
      } finally {
        setGpaLoading(false);
      }
    },
    [token]
  );

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [trend, grades, gpaSummary] = await Promise.all([
        fetchStudentAttendanceTrend(token, 6),
        fetchStudentGrades(token),
        // Best-effort like the Grades tab's band fetch - a failure here
        // shouldn't block attendance/raw-marks, which are unambiguous.
        fetchStudentGpaSummary(token).catch(() => null),
      ]);
      setAttendance(trend);
      setSubjectAverages(computeSubjectAverages(grades));
      setGpa(gpaSummary);
      setSelectedTermId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your progress.');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const onSelectTerm = (termId: number | null) => {
    setSelectedTermId(termId);
    loadGpa(termId);
  };

  if (isLoading) return <LoadingRows />;
  if (error) return <ErrorBanner message={error} onRetry={load} />;

  const hasAnyAttendance = (attendance ?? []).some((p) => p.totalMarked > 0);
  const hasAnyGrades = (subjectAverages ?? []).some((s) => s.sampleCount > 0);

  return (
    <>
      {gpa && gpa.terms_available.length > 0 ? (
        <View style={styles.termSwitcherRow}>
          <TouchableOpacity
            style={[styles.termChip, selectedTermId === null && styles.termChipSelected]}
            onPress={() => onSelectTerm(null)}
          >
            <Text style={[styles.termChipText, selectedTermId === null && styles.termChipTextSelected]}>
              Whole session
            </Text>
          </TouchableOpacity>
          {gpa.terms_available.map((t) => {
            const selected = selectedTermId === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[styles.termChip, selected && styles.termChipSelected]}
                onPress={() => onSelectTerm(t.id)}
              >
                <Text style={[styles.termChipText, selected && styles.termChipTextSelected]}>{t.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {gpaLoading ? (
        <View style={styles.gpaCard}>
          <ActivityIndicator />
        </View>
      ) : gpa && gpa.gpa !== null ? (
        <View style={styles.gpaCard}>
          <Text style={styles.gpaValue}>{gpa.gpa.toFixed(2)}</Text>
          <Text style={styles.gpaLabel}>
            GPA · based on {gpa.subjects_with_grade} of {gpa.subjects_total} subjects
          </Text>
          {gpa.subjects_with_grade < gpa.subjects_total ? (
            <Text style={styles.progressDisclaimer}>
              The rest don't have a grading scale configured for this subject
              yet, so they're left out rather than guessed at.
            </Text>
          ) : null}
        </View>
      ) : gpa && gpa.subjects_total > 0 ? (
        <View style={styles.gpaCard}>
          <Text style={styles.progressDisclaimer}>
            {selectedTermId !== null
              ? "No GPA yet for this term — none of your subjects have a grading scale configured, or no marks fall inside this term's dates yet."
              : `No GPA yet — none of your ${gpa.subjects_total} subjects have a grading scale configured. Once your school sets one up, it'll appear here.`}
          </Text>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Attendance rate — last 6 months</Text>
      {!hasAnyAttendance ? (
        <EmptyState title="No attendance yet" desc="Nothing recorded in the last 6 months." />
      ) : (
        <View style={styles.chartCard}>
          <AttendanceBarChart points={attendance!} />
          <View style={styles.chartLabelRow}>
            {attendance!.map((p) => (
              <Text key={`${p.year}-${p.month}`} style={styles.chartLabel} numberOfLines={1}>
                {p.label.split(' ')[0]}
              </Text>
            ))}
          </View>
        </View>
      )}

      <Text style={styles.sectionTitle}>Subject averages (raw marks)</Text>
      <Text style={styles.progressDisclaimer}>
        These are plain averages of your recorded scores — not your GPA.
        See the Grades tab for the letter grade behind each mark.
      </Text>
      {!hasAnyGrades ? (
        <EmptyState title="No numeric marks yet" desc="Once results are released, subject averages appear here." />
      ) : (
        (subjectAverages ?? [])
          .filter((s) => s.sampleCount > 0)
          .map((s) => (
            <View key={s.subject_id} style={styles.rowCard}>
              <Text style={[styles.rowTitle, { flex: 1 }]}>{s.subject_name}</Text>
              <Text style={styles.gradeMark}>{s.average}</Text>
            </View>
          ))
      )}
    </>
  );
}

export default function AcademicHubScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { token } = useAuth();
  const [tab, setTab] = useState<TabKey>((route.params?.initialTab as TabKey) || 'schedule');

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
          <IconChevronLeft color={INK} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>Academic</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>Your schedule, subjects, attendance & grades</Text>
        </View>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.tabBar}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabButton, tab === t.key && styles.tabButtonActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabButtonText, tab === t.key && styles.tabButtonTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!token ? null : tab === 'schedule' ? (
          <ScheduleTab token={token} />
        ) : tab === 'subjects' ? (
          <SubjectsTab token={token} />
        ) : tab === 'attendance' ? (
          <AttendanceTab token={token} />
        ) : tab === 'grades' ? (
          <GradesTab token={token} />
        ) : (
          <ProgressTab token={token} />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.canvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
  },
  backButton: { width: 32, height: 32, alignItems: 'flex-start', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: INK, textAlign: 'center' },
  headerSubtitle: { fontSize: 12, color: SUBTLE, textAlign: 'center', marginTop: 2 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 3,
  },
  tabButtonActive: { backgroundColor: EMERALD_SOFT },
  tabButtonText: { fontSize: 12.5, fontWeight: '600', color: SUBTLE },
  tabButtonTextActive: { color: EMERALD },
  content: { padding: 20, paddingBottom: 40 },
  dayHeading: { fontSize: 13, fontWeight: '700', color: SUBTLE, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: INK, marginBottom: 10, marginTop: 4 },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: HAIRLINE,
  },
  chartLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  chartLabel: { fontSize: 10.5, color: SUBTLE, flex: 1, textAlign: 'center' },
  progressDisclaimer: { fontSize: 12, color: SUBTLE, marginBottom: 12, lineHeight: 17 },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: HAIRLINE,
  },
  timeCol: { width: 56 },
  timeText: { fontSize: 13, fontWeight: '700', color: INK },
  timeTextSub: { fontSize: 11, color: SUBTLE, marginTop: 1 },
  rowDivider: { width: 1, height: 30, backgroundColor: HAIRLINE, marginHorizontal: 12 },
  rowTitle: { fontSize: 14.5, fontWeight: '600', color: INK },
  rowSubtitle: { fontSize: 12.5, color: SUBTLE, marginTop: 2 },
  subjectDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: EMERALD, marginRight: 12 },
  monthSwitcher: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  monthArrow: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  monthArrowText: { fontSize: 22, color: EMERALD, fontWeight: '700' },
  monthLabel: { fontSize: 15, fontWeight: '700', color: INK, marginHorizontal: 12 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusPillText: { fontSize: 12, fontWeight: '700' },
  examCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: HAIRLINE,
  },
  examCategory: { fontSize: 14, fontWeight: '700', color: INK, marginBottom: 10 },
  gradeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
  },
  gradeSubject: { fontSize: 13.5, color: INK },
  gradeMark: { fontSize: 13.5, fontWeight: '700', color: EMERALD },
  gradeBandLabel: { fontSize: 12.5, fontWeight: '700' },
  gpaCard: {
    backgroundColor: EMERALD_SOFT,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  gpaValue: { fontSize: 32, fontWeight: '800', color: EMERALD },
  gpaLabel: { fontSize: 12.5, color: INK, marginTop: 2, fontWeight: '600' },
  termSwitcherRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  termChip: {
    borderWidth: 1,
    borderColor: EMERALD_SOFT,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  termChipSelected: { backgroundColor: EMERALD, borderColor: EMERALD },
  termChipText: { fontSize: 12.5, fontWeight: '600', color: INK },
  termChipTextSelected: { color: '#fff' },
  examComment: { fontSize: 12.5, color: SUBTLE, marginTop: 8, fontStyle: 'italic' },
  errorBanner: { backgroundColor: '#FCEDED', borderRadius: 14, padding: 16 },
  errorText: { fontSize: 13.5, color: '#B3261E', marginBottom: 10 },
  retryButton: { alignSelf: 'flex-start', backgroundColor: '#B3261E', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  retryButtonText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' },
  emptyWrap: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: INK, marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: SUBTLE, textAlign: 'center', paddingHorizontal: 24 },
});
