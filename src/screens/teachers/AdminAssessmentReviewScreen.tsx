import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Polyline } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { fetchClasses, fetchSections, ClassOption, SectionOption } from '../../services/adminService';
import {
  fetchAdminAssessmentReview,
  fetchAdminAssessmentSubmissions,
  Assessment,
  AssessmentSubmission,
  AssessmentStatus,
} from '../../services/assessmentService';
import { Skeleton } from '../../components/Skeleton';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHADOW, GLASS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';
const EMERALD = '#0F9D58';
const INK = '#1C1C1E';
const SUBTLE = '#8A9099';
const RED = '#B3261E';
const GLASS_SURFACE = GLASS.fillOnLight;
const GLASS_BORDER = GLASS.borderOnLight;

const STATUS_FILTERS: { key: 'all' | AssessmentStatus; labelKey: string; label: string }[] = [
  { key: 'all', labelKey: 'all', label: 'All' },
  { key: 'draft', labelKey: 'draft', label: 'Draft' },
  { key: 'published', labelKey: 'published', label: 'Published' },
];

function IconChevronLeft({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Polyline points="15 5 8 12 15 19" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
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
        {options.length === 0 ? <Text style={styles.emptyPickerText}>{t('admin_assessment_review.nothing_available', 'Nothing available yet.')}</Text> : null}
      </View>
    </View>
  );
}

// Admin's read-only counterpart to the teacher's Assessments screen — no
// approve/reject step here (unlike LessonPlan/Announcement, a published
// assessment doesn't need admin sign-off, it just needs to be visible).
// Tapping a card drills into its submissions for a read-only grading
// snapshot, via admin_assessment_submissions.
export default function AdminAssessmentReviewScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();
  const { t } = useLocale();

  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [classId, setClassId] = useState<number | null>(null);
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | AssessmentStatus>('published');

  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const [isLoadingSections, setIsLoadingSections] = useState(false);
  const [isLoadingReview, setIsLoadingReview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [detail, setDetail] = useState<Assessment | null>(null);
  const [detailSubmissions, setDetailSubmissions] = useState<AssessmentSubmission[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  useEffect(() => {
    if (!token) return;
    setIsLoadingFilters(true);
    fetchClasses(token)
      .then(setClasses)
      .catch((err) => setError(err instanceof Error ? err.message : t('admin_assessment_review.classes_error', 'Could not load classes.')))
      .finally(() => setIsLoadingFilters(false));
  }, [token, t]);

  const onSelectClass = useCallback(
    (id: number) => {
      setClassId(id);
      setSectionId(null);
      setAssessments([]);
      if (!token) return;
      setIsLoadingSections(true);
      fetchSections(token, String(id))
        .then(setSections)
        .catch((err) => setError(err instanceof Error ? err.message : t('admin_assessment_review.sections_error', 'Could not load sections.')))
        .finally(() => setIsLoadingSections(false));
    },
    [token, t]
  );

  const loadReview = useCallback(() => {
    if (!token || !sectionId) return;
    setIsLoadingReview(true);
    setError(null);
    fetchAdminAssessmentReview(token, {
      section_id: sectionId,
      status: statusFilter === 'all' ? undefined : statusFilter,
    })
      .then(setAssessments)
      .catch((err) => setError(err instanceof Error ? err.message : t('admin_assessment_review.assessments_error', 'Could not load assessments.')))
      .finally(() => setIsLoadingReview(false));
  }, [token, sectionId, statusFilter, t]);

  useEffect(() => {
    loadReview();
  }, [loadReview]);

  const openDetail = async (a: Assessment) => {
    setDetail(a);
    setDetailSubmissions([]);
    if (!token) return;
    setIsLoadingDetail(true);
    try {
      const data = await fetchAdminAssessmentSubmissions(token, a.id);
      setDetailSubmissions(data.submissions);
    } catch (e) {
      // detail modal just shows empty state on failure
    } finally {
      setIsLoadingDetail(false);
    }
  };

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
          <IconChevronLeft color={INK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('admin_assessment_review.title', 'Assessments Review')}</Text>
        <View style={{ width: 32 }} />
      </View>

      <FlatList
        data={assessments}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
            {isLoadingFilters ? (
              <Skeleton width="100%" height={80} borderRadius={12} />
            ) : (
              <>
                <Picker label={t('admin_assessment_review.class', 'Class')} options={classes} selectedId={classId} onSelect={onSelectClass} />
                {classId ? (
                  isLoadingSections ? (
                    <Skeleton width="100%" height={40} borderRadius={12} style={{ marginTop: 8 }} />
                  ) : (
                    <Picker label={t('admin_assessment_review.section', 'Section')} options={sections} selectedId={sectionId} onSelect={setSectionId} />
                  )
                ) : null}
                <View style={styles.pickerBlock}>
                  <Text style={styles.pickerLabel}>{t('admin_assessment_review.status', 'Status')}</Text>
                  <View style={styles.chipWrap}>
                    {STATUS_FILTERS.map((f) => (
                      <TouchableOpacity
                        key={f.key}
                        style={[styles.chip, statusFilter === f.key && styles.chipActive]}
                        onPress={() => setStatusFilter(f.key)}
                      >
                        <Text style={[styles.chipText, statusFilter === f.key && styles.chipTextActive]}>{t(`admin_assessment_review.filter_${f.labelKey}`, f.label)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </>
            )}
            {isLoadingReview ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <ActivityIndicator color={EMERALD} />
              </View>
            ) : null}
            {!isLoadingReview && sectionId && assessments.length === 0 && !error ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>{t('admin_assessment_review.empty_title', 'Nothing here yet')}</Text>
                <Text style={styles.emptyDesc}>{t('admin_assessment_review.empty_desc', 'No assessments match this section/status.')}</Text>
              </View>
            ) : null}
          </>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => openDetail(item)} activeOpacity={0.85}>
            <View style={styles.cardTopRow}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: (item.status === 'published' ? EMERALD : SUBTLE) + '22' }]}>
                <Text style={[styles.statusBadgeText, { color: item.status === 'published' ? EMERALD : SUBTLE }]}>
                  {item.status}
                </Text>
              </View>
            </View>
            <Text style={styles.cardMeta}>
              {item.teacher_name} · {item.subject_name} · {item.type}
              {item.exam_category_name ? ` · ${item.exam_category_name}${item.exam_category_weight != null ? ` (${item.exam_category_weight}%)` : ''}` : ''}
              {item.due_at ? ` · ${t('admin_assessment_review.due', 'due')} ${item.due_at.slice(0, 10)}` : ''}
            </Text>
            {item.status === 'published' ? (
              <Text style={styles.cardStats}>
                {item.submission_count ?? 0} {t('admin_assessment_review.submitted', 'submitted')} · {item.graded_count ?? 0} {t('admin_assessment_review.graded', 'graded')}
              </Text>
            ) : null}
          </TouchableOpacity>
        )}
      />

      <Modal visible={!!detail} transparent animationType="fade" onRequestClose={() => setDetail(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle} numberOfLines={1}>
              {detail?.title}
            </Text>
            <Text style={styles.modalSub}>
              {detail?.teacher_name} · {detail?.section_name} · {detail?.subject_name}
            </Text>
            {isLoadingDetail ? (
              <ActivityIndicator color={EMERALD} style={{ marginTop: 20 }} />
            ) : (
              <FlatList
                data={detailSubmissions}
                keyExtractor={(s) => String(s.id)}
                style={{ maxHeight: 320, marginTop: 12 }}
                ListEmptyComponent={<Text style={styles.emptyDesc}>{t('admin_assessment_review.no_submissions', 'No submissions yet.')}</Text>}
                renderItem={({ item }) => (
                  <View style={styles.subRow}>
                    <Text style={styles.subName} numberOfLines={1}>
                      {item.student_name}
                    </Text>
                    <Text style={styles.subStatus}>
                      {item.status === 'graded' ? `${item.score ?? '—'} ${t('admin_assessment_review.pts', 'pts')}` : item.status}
                    </Text>
                  </View>
                )}
              />
            )}
            <TouchableOpacity style={{ alignSelf: 'center', marginTop: 14 }} onPress={() => setDetail(null)}>
              <Text style={{ color: SUBTLE, fontSize: 13 }}>{t('common.close', 'Close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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

  pickerBlock: { marginBottom: 14 },
  pickerLabel: { fontSize: 12, color: SUBTLE, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: GLASS_SURFACE, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, ...SHADOW.level1 },
  chipActive: { backgroundColor: EMERALD },
  chipDisabled: { opacity: 0.5 },
  chipText: { fontSize: 12.5, fontWeight: '700', color: INK },
  chipTextActive: { color: '#FFFFFF' },
  emptyPickerText: { fontSize: 12.5, color: SUBTLE },

  card: { backgroundColor: GLASS_SURFACE, borderRadius: 14, padding: 14, marginBottom: 10, ...SHADOW.level1 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, fontSize: 14.5, fontWeight: '700', color: INK },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusBadgeText: { fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase' },
  cardMeta: { fontSize: 12, color: SUBTLE, marginTop: 6 },
  cardStats: { fontSize: 11.5, color: EMERALD, marginTop: 8, fontWeight: '600' },

  emptyWrap: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: INK, marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: SUBTLE, textAlign: 'center', lineHeight: 18 },
  errorBanner: { backgroundColor: '#FCEDED', borderRadius: 12, padding: 14, marginBottom: 12 },
  errorText: { color: RED, fontSize: 13.5, textAlign: 'center' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(17,24,39,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, width: '100%', ...SHADOW.level2 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: INK },
  modalSub: { fontSize: 12, color: SUBTLE, marginTop: 4 },
  subRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: GLASS_BORDER,
  },
  subName: { flex: 1, fontSize: 13, color: INK, fontWeight: '600' },
  subStatus: { fontSize: 12, color: SUBTLE },
});
