import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { fetchStudentAssessmentGrades, AssessmentSubjectGrade } from '../../services/assessmentService';
import { Skeleton } from '../../components/Skeleton';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHADOW, GLASS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';

const EMERALD = '#1FAE64';
const EMERALD_SOFT = '#E5F8F5';
const INK = '#1C1C1E';
const SUBTLE = '#8A9099';
const CANVAS = '#F6F7F9';
const AMBER = '#B8860B';
const AMBER_SOFT = '#FBF3DF';
const RED = '#B3261E';
const RED_SOFT = '#FDECEC';
const GLASS_SURFACE = GLASS.fillOnLight;
const GLASS_BORDER = GLASS.borderOnLight;

function IconChevronLeft({ color, size = 22 }: { color: string; size?: number }) {
  return <ChevronLeft size={size} color={color} strokeWidth={2.4} />;
}

// Green/amber/red banding for the headline percentage, same rough
// thresholds the grade-scale builder (§4.10) would land on for a
// generic pass/merit/distinction split — not tied to any school's
// actual GradeScale, just a quick visual cue on this screen.
function bandColor(pct: number | null) {
  if (pct === null) return SUBTLE;
  if (pct >= 75) return EMERALD;
  if (pct >= 50) return AMBER;
  return RED;
}
function bandSoft(pct: number | null) {
  if (pct === null) return '#F0F1F3';
  if (pct >= 75) return EMERALD_SOFT;
  if (pct >= 50) return AMBER_SOFT;
  return RED_SOFT;
}

function CardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton width="50%" height={14} borderRadius={4} />
      <Skeleton width="30%" height={11} borderRadius={4} style={{ marginTop: 10 }} />
    </View>
  );
}

// Student's own weighted grade per subject (§4.11 weights, finally read
// into a number) — one call, no picker, since a student only has one
// current section. Companion read-only view to StudentAssessmentsScreen,
// which stays focused on individual assignments/submissions.
export default function StudentAssessmentGradesScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();
  const { t } = useLocale();

  const [subjects, setSubjects] = useState<AssessmentSubjectGrade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!token) return;
      if (!opts.silent) setIsLoading(true);
      setError(null);
      try {
        const data = await fetchStudentAssessmentGrades(token);
        setSubjects(data);
      } catch (e: any) {
        setError(e?.message ?? t('student_assessment_grades.load_error', 'Could not load your grades.'));
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

  return (
    <GlassBackground style={{ flex: 1, backgroundColor: CANVAS }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} style={styles.backButton}>
          <IconChevronLeft color={INK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('student_assessment_grades.title', 'My Grades')}</Text>
        <View style={{ width: 36 }} />
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {isLoading ? (
        <View style={{ paddingHorizontal: 16 }}>
          <CardSkeleton />
          <CardSkeleton />
        </View>
      ) : (
        <FlatList
          data={subjects}
          keyExtractor={(s) => String(s.subject_id)}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
          onRefresh={() => {
            setIsRefreshing(true);
            load({ silent: true });
          }}
          refreshing={isRefreshing}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {t('student_assessment_grades.empty', 'Nothing graded yet — grades appear here once a teacher grades your assessments.')}
            </Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTopRow}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.subject_name ?? t('student_assessment_grades.subject', 'Subject')}
                </Text>
                <View style={[styles.pctBadge, { backgroundColor: bandSoft(item.weighted_percentage) }]}>
                  <Text style={[styles.pctBadgeText, { color: bandColor(item.weighted_percentage) }]}>
                    {item.weighted_percentage !== null ? `${item.weighted_percentage}%` : '—'}
                  </Text>
                </View>
              </View>

              <Text style={styles.cardMeta}>
                {item.graded_count} {t('student_assessment_grades.of', 'of')} {item.total_published} {t('student_assessment_grades.graded', 'graded')}
                {item.calculation_method === 'flat'
                  ? ` · ${t('student_assessment_grades.flat_average', 'flat average (no weighted categories graded yet)')}`
                  : item.calculation_method === 'weighted'
                  ? ` · ${t('student_assessment_grades.weighted_by_category', 'weighted by exam category')}`
                  : ''}
              </Text>

              {item.categories.length > 0 ? (
                <View style={styles.categoryList}>
                  {item.categories.map((c) => (
                    <View key={c.exam_category_id ?? 'uncat'} style={styles.categoryRow}>
                      <Text style={styles.categoryName} numberOfLines={1}>
                        {c.exam_category_name}
                        {c.weight !== null ? ` (${c.weight}%)` : ''}
                      </Text>
                      <Text style={styles.categoryPct}>{c.percentage !== null ? `${c.percentage}%` : '—'}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          )}
        />
      )}
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12 },
  backButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: INK, textAlign: 'center' },
  errorBanner: { marginHorizontal: 16, marginBottom: 8, padding: 10, borderRadius: 10, backgroundColor: RED_SOFT },
  errorText: { color: RED, fontSize: 13 },
  card: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: GLASS_SURFACE,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    marginBottom: 12,
    ...SHADOW.card,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: INK },
  pctBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, minWidth: 52, alignItems: 'center' },
  pctBadgeText: { fontSize: 13, fontWeight: '800' },
  cardMeta: { fontSize: 11.5, color: SUBTLE, marginTop: 6 },
  categoryList: { marginTop: 10, borderTopWidth: 1, borderTopColor: GLASS_BORDER, paddingTop: 8 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 3 },
  categoryName: { flex: 1, fontSize: 12.5, color: INK, marginRight: 8 },
  categoryPct: { fontSize: 12.5, color: SUBTLE, fontWeight: '600' },
  emptyText: { textAlign: 'center', color: SUBTLE, marginTop: 40, fontSize: 13.5, paddingHorizontal: 24 },
});
