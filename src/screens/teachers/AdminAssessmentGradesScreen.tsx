import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Polyline } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { fetchClasses, fetchSections, ClassOption, SectionOption } from '../../services/adminService';
import {
  fetchAdminAssessmentReview,
  fetchAdminAssessmentGrades,
  AssessmentStudentGradeRow,
} from '../../services/assessmentService';
import { Skeleton } from '../../components/Skeleton';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHADOW, GLASS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';

const EMERALD = '#2BCBB0';
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

function IconChevronLeft({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
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

function Picker<T extends { id: number; name: string }>({
  label,
  options,
  selectedId,
  onSelect,
  disabled,
}: {
  label: string;
  options: T[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  disabled?: boolean;
}) {
  const { t } = useLocale();
  return (
    <View style={styles.pickerBlock}>
      <Text style={styles.pickerLabel}>{label}</Text>
      <View style={styles.chipWrap}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt.id}
            disabled={disabled}
            style={[styles.chip, selectedId === opt.id ? styles.chipActive : null, disabled ? styles.chipDisabled : null]}
            onPress={() => onSelect(opt.id)}
          >
            <Text style={[styles.chipText, selectedId === opt.id ? styles.chipTextActive : null]}>{opt.name}</Text>
          </TouchableOpacity>
        ))}
        {options.length === 0 ? <Text style={styles.emptyPickerText}>{t('admin_assessment_grades.nothing_available', 'Nothing available yet.')}</Text> : null}
      </View>
    </View>
  );
}

// Admin's read-only counterpart to TeacherAssessmentGradesScreen. There's
// no dedicated "subjects in this section" endpoint, so the subject list
// is derived from whatever fetchAdminAssessmentReview returns for the
// chosen section (same data AdminAssessmentReviewScreen already loads) —
// distinct subject_id/subject_name pairs found on published assessments
// there, rather than a separate call.
export default function AdminAssessmentGradesScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();
  const { t } = useLocale();

  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [subjects, setSubjects] = useState<{ id: number; name: string }[]>([]);
  const [classId, setClassId] = useState<number | null>(null);
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [subjectId, setSubjectId] = useState<number | null>(null);

  const [rows, setRows] = useState<AssessmentStudentGradeRow[]>([]);
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const [isLoadingSections, setIsLoadingSections] = useState(false);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);
  const [isLoadingRows, setIsLoadingRows] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [detail, setDetail] = useState<AssessmentStudentGradeRow | null>(null);

  useEffect(() => {
    if (!token) return;
    setIsLoadingFilters(true);
    fetchClasses(token)
      .then(setClasses)
      .catch((err) => setError(err instanceof Error ? err.message : t('admin_assessment_grades.classes_error', 'Could not load classes.')))
      .finally(() => setIsLoadingFilters(false));
  }, [token, t]);

  const onSelectClass = useCallback(
    (id: number) => {
      setClassId(id);
      setSectionId(null);
      setSubjectId(null);
      setSubjects([]);
      setRows([]);
      if (!token) return;
      setIsLoadingSections(true);
      fetchSections(token, String(id))
        .then(setSections)
        .catch((err) => setError(err instanceof Error ? err.message : t('admin_assessment_grades.sections_error', 'Could not load sections.')))
        .finally(() => setIsLoadingSections(false));
    },
    [token, t]
  );

  const onSelectSection = useCallback(
    (id: number) => {
      setSectionId(id);
      setSubjectId(null);
      setRows([]);
      if (!token) return;
      setIsLoadingSubjects(true);
      setError(null);
      fetchAdminAssessmentReview(token, { section_id: id, status: 'published' })
        .then((assessments) => {
          const seen = new Map<number, string>();
          assessments.forEach((a) => {
            if (a.subject_id != null && !seen.has(a.subject_id)) {
              seen.set(a.subject_id, a.subject_name ?? `${t('admin_assessment_grades.subject', 'Subject')} ${a.subject_id}`);
            }
          });
          setSubjects(Array.from(seen.entries()).map(([id, name]) => ({ id, name })));
        })
        .catch((err) => setError(err instanceof Error ? err.message : t('admin_assessment_grades.subjects_error', 'Could not load subjects.')))
        .finally(() => setIsLoadingSubjects(false));
    },
    [token, t]
  );

  useEffect(() => {
    if (!token || !sectionId || !subjectId) return;
    setIsLoadingRows(true);
    setError(null);
    fetchAdminAssessmentGrades(token, sectionId, subjectId)
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : t('admin_assessment_grades.grades_error', 'Could not load grades.')))
      .finally(() => setIsLoadingRows(false));
  }, [token, sectionId, subjectId, t]);

  return (
    <GlassBackground style={{ flex: 1, backgroundColor: CANVAS }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} style={styles.backButton}>
          <IconChevronLeft color={INK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('admin_assessment_grades.title', 'Grades')}</Text>
        <View style={{ width: 22 }} />
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={{ paddingBottom: 8 }}>
        {isLoadingFilters ? (
          <View style={{ paddingHorizontal: 16 }}>
            <Skeleton width="70%" height={30} borderRadius={20} />
          </View>
        ) : (
          <Picker label={t('admin_assessment_grades.class', 'Class')} options={classes} selectedId={classId} onSelect={onSelectClass} />
        )}

        {classId ? (
          isLoadingSections ? (
            <View style={{ paddingHorizontal: 16 }}>
              <Skeleton width="60%" height={30} borderRadius={20} />
            </View>
          ) : (
            <Picker label={t('admin_assessment_grades.section', 'Section')} options={sections} selectedId={sectionId} onSelect={onSelectSection} />
          )
        ) : null}

        {sectionId ? (
          isLoadingSubjects ? (
            <View style={{ paddingHorizontal: 16 }}>
              <Skeleton width="60%" height={30} borderRadius={20} />
            </View>
          ) : (
            <Picker label={t('admin_assessment_grades.subject', 'Subject')} options={subjects} selectedId={subjectId} onSelect={setSubjectId} />
          )
        ) : null}
      </ScrollView>

      {isLoadingRows ? (
        <View style={{ paddingHorizontal: 16 }}>
          <Skeleton width="90%" height={56} borderRadius={16} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => String(r.student_id)}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
          ListEmptyComponent={
            subjectId ? <Text style={styles.emptyText}>{t('admin_assessment_grades.empty_students', 'No students enrolled in this section yet.')}</Text> : null
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
                    {item.grade ? `${item.grade.graded_count} ${t('admin_assessment_grades.of', 'of')} ${item.grade.total_published} ${t('admin_assessment_grades.graded', 'graded')}` : t('admin_assessment_grades.no_assessments', 'No assessments yet')}
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
                  ? t('admin_assessment_grades.flat_average', 'Flat average — no weighted category has graded work yet')
                  : detail?.grade?.calculation_method === 'weighted'
                  ? t('admin_assessment_grades.weighted_by_category', 'Weighted by exam category')
                  : ''}
              </Text>
              {(detail?.grade?.categories ?? []).map((c) => (
                <View key={c.exam_category_id ?? 'uncat'} style={styles.categoryRow}>
                  <Text style={styles.categoryName} numberOfLines={1}>
                    {c.exam_category_name}
                    {c.weight !== null ? ` (${c.weight}%)` : ''} · {c.graded_count} {t('admin_assessment_grades.graded', 'graded')}
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
  backButton: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: INK, textAlign: 'center' },
  errorBanner: { marginHorizontal: 16, marginBottom: 8, padding: 10, borderRadius: 10, backgroundColor: RED_SOFT },
  errorText: { color: RED, fontSize: 13 },
  pickerBlock: { marginBottom: 10 },
  pickerLabel: { fontSize: 11.5, fontWeight: '700', color: SUBTLE, marginLeft: 16, marginBottom: 6, textTransform: 'uppercase' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F0F1F3', marginBottom: 8 },
  chipActive: { backgroundColor: EMERALD },
  chipDisabled: { opacity: 0.5 },
  chipText: { fontSize: 12.5, color: INK, fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF' },
  emptyPickerText: { fontSize: 12.5, color: SUBTLE, fontStyle: 'italic' },
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
