import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Polyline } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import {
  fetchAssessmentTargets,
  fetchTeacherAssessmentGrades,
  AssessmentTarget,
  AssessmentStudentGradeRow,
} from '../../services/assessmentService';
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
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline points="15 5 8 12 15 19" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

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

function RowSkeleton() {
  return (
    <View style={styles.row}>
      <Skeleton width="55%" height={13} borderRadius={4} />
      <Skeleton width={44} height={20} borderRadius={8} />
    </View>
  );
}

// Teacher's weighted-grade roster for one class/subject they teach —
// same target picker (fetchAssessmentTargets) TeacherAssessmentsScreen
// already uses for "which class is this for", reused here since the
// underlying "what may this teacher see" check is identical. Tapping a
// student opens the same category breakdown the student sees on their
// own My Grades screen, so a teacher can see exactly why a number is
// what it is.
export default function TeacherAssessmentGradesScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();
  const { t } = useLocale();

  const [targets, setTargets] = useState<AssessmentTarget[]>([]);
  const [targetKey, setTargetKey] = useState<string | null>(null);
  const [rows, setRows] = useState<AssessmentStudentGradeRow[]>([]);

  const [isLoadingTargets, setIsLoadingTargets] = useState(true);
  const [isLoadingRows, setIsLoadingRows] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [detail, setDetail] = useState<AssessmentStudentGradeRow | null>(null);

  const keyOf = (target: AssessmentTarget) => `${target.section_id}:${target.subject_id}`;
  const selected = targets.find((target) => keyOf(target) === targetKey) ?? null;

  useEffect(() => {
    if (!token) return;
    setIsLoadingTargets(true);
    fetchAssessmentTargets(token)
      .then(({ targets: fetched }) => {
        setTargets(fetched);
        if (fetched[0]) setTargetKey(keyOf(fetched[0]));
      })
      .catch((e: any) => setError(e?.message ?? t('teacher_assessment_grades.classes_error', 'Could not load your classes.')))
      .finally(() => setIsLoadingTargets(false));
  }, [token, t]);

  useEffect(() => {
    if (!token || !selected) return;
    setIsLoadingRows(true);
    setError(null);
    fetchTeacherAssessmentGrades(token, selected.section_id, selected.subject_id)
      .then(setRows)
      .catch((e: any) => setError(e?.message ?? t('teacher_assessment_grades.grades_error', 'Could not load grades.')))
      .finally(() => setIsLoadingRows(false));
  }, [token, selected?.section_id, selected?.subject_id, t]);

  return (
    <GlassBackground style={{ flex: 1, backgroundColor: CANVAS }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} style={styles.backButton}>
          <IconChevronLeft color={INK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('teacher_assessment_grades.title', 'Grades')}</Text>
        <View style={{ width: 36 }} />
      </View>

      {isLoadingTargets ? (
        <View style={{ paddingHorizontal: 16 }}>
          <Skeleton width="70%" height={30} borderRadius={20} />
        </View>
      ) : (
        <FlatList
          horizontal
          data={targets}
          keyExtractor={(target) => keyOf(target)}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          renderItem={({ item }) => {
            const active = keyOf(item) === targetKey;
            return (
              <TouchableOpacity
                onPress={() => setTargetKey(keyOf(item))}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {item.section_name} · {item.subject_name}
                </Text>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={<Text style={styles.emptyText}>{t('teacher_assessment_grades.empty_classes', 'No classes assigned yet.')}</Text>}
        />
      )}

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {isLoadingRows ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => String(r.student_id)}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
          ListEmptyComponent={
            selected ? <Text style={styles.emptyText}>{t('teacher_assessment_grades.empty_students', 'No students enrolled in this section yet.')}</Text> : null
          }
          renderItem={({ item }) => {
            const pct = item.grade?.weighted_percentage ?? null;
            return (
              <TouchableOpacity
                style={styles.row}
                activeOpacity={0.85}
                onPress={() => item.grade && setDetail(item)}
                disabled={!item.grade}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {item.student_name}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {item.grade ? `${item.grade.graded_count} ${t('teacher_assessment_grades.of', 'of')} ${item.grade.total_published} ${t('teacher_assessment_grades.graded', 'graded')}` : t('teacher_assessment_grades.no_assessments', 'No assessments yet')}
                  </Text>
                </View>
                <View style={[styles.pctBadge, { backgroundColor: bandSoft(pct) }]}>
                  <Text style={[styles.pctBadgeText, { color: bandColor(pct) }]}>{pct !== null ? `${pct}%` : '—'}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <Modal visible={!!detail} transparent animationType="fade" onRequestClose={() => setDetail(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: '100%' }}>
              <Text style={styles.modalTitle}>{detail?.student_name}</Text>
              <Text style={styles.modalSubtitle}>
                {detail?.grade?.calculation_method === 'flat'
                  ? t('teacher_assessment_grades.flat_average', 'Flat average — no weighted category has graded work yet')
                  : detail?.grade?.calculation_method === 'weighted'
                  ? t('teacher_assessment_grades.weighted_by_category', 'Weighted by exam category')
                  : ''}
              </Text>
              {(detail?.grade?.categories ?? []).map((c) => (
                <View key={c.exam_category_id ?? 'uncat'} style={styles.categoryRow}>
                  <Text style={styles.categoryName} numberOfLines={1}>
                    {c.exam_category_name}
                    {c.weight !== null ? ` (${c.weight}%)` : ''} · {c.graded_count} {t('teacher_assessment_grades.graded', 'graded')}
                  </Text>
                  <Text style={styles.categoryPct}>{c.percentage !== null ? `${c.percentage}%` : '—'}</Text>
                </View>
              ))}
              <TouchableOpacity style={{ alignSelf: 'center', marginTop: 16 }} onPress={() => setDetail(null)}>
                <Text style={{ color: SUBTLE, fontSize: 13 }}>{t('common.close', 'Close')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12 },
  backButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: INK, textAlign: 'center' },
  filterRow: { paddingHorizontal: 16, paddingBottom: 10, gap: 8, flexDirection: 'row' },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F0F1F3' },
  chipActive: { backgroundColor: EMERALD },
  chipText: { fontSize: 12.5, color: INK, fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF' },
  errorBanner: { marginHorizontal: 16, marginBottom: 8, padding: 10, borderRadius: 10, backgroundColor: RED_SOFT },
  errorText: { color: RED, fontSize: 13 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    backgroundColor: GLASS_SURFACE,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    marginBottom: 10,
    ...SHADOW.card,
  },
  rowName: { fontSize: 14.5, fontWeight: '700', color: INK },
  rowMeta: { fontSize: 11.5, color: SUBTLE, marginTop: 3 },
  pctBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, minWidth: 52, alignItems: 'center' },
  pctBadgeText: { fontSize: 13, fontWeight: '800' },
  emptyText: { textAlign: 'center', color: SUBTLE, marginTop: 40, fontSize: 13.5, paddingHorizontal: 24 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(17,24,39,0.4)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 20, width: '100%', maxHeight: '75%', ...SHADOW.card },
  modalTitle: { fontSize: 16, fontWeight: '700', color: INK },
  modalSubtitle: { fontSize: 12, color: SUBTLE, marginTop: 4, marginBottom: 12 },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: GLASS_BORDER,
  },
  categoryName: { flex: 1, fontSize: 13, color: INK, marginRight: 8 },
  categoryPct: { fontSize: 13, color: SUBTLE, fontWeight: '700' },
});
