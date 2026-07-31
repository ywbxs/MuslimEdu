import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Modal, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path, Polyline } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { fetchClasses, fetchSections, ClassOption, SectionOption } from '../../services/adminService';
import {
  fetchAdminLessonPlanReview,
  decideLessonPlan,
  LessonPlan,
  LessonPlanStatus,
} from '../../services/lessonPlanService';
import { Skeleton } from '../../components/Skeleton';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHADOW, GLASS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';
const EMERALD = '#0F9D58';
const INK = '#1C1C1E';
const SUBTLE = '#8A9099';
const CANVAS = '#F6F7F9';
const RED = '#B3261E';
const GLASS_SURFACE = GLASS.fillOnLight;
const GLASS_BORDER = GLASS.borderOnLight;

const STATUS_FILTERS: { key: 'all' | LessonPlanStatus; labelKey: string; label: string }[] = [
  { key: 'all', labelKey: 'all', label: 'All' },
  { key: 'submitted', labelKey: 'submitted', label: 'Submitted' },
  { key: 'approved', labelKey: 'approved', label: 'Approved' },
  { key: 'rejected', labelKey: 'rejected', label: 'Rejected' },
];

function statusColor(status: LessonPlanStatus) {
  switch (status) {
    case 'approved':
      return EMERALD;
    case 'rejected':
      return RED;
    case 'submitted':
      return '#B8860B';
    default:
      return SUBTLE;
  }
}

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
        {options.length === 0 ? <Text style={styles.emptyPickerText}>{t('admin_lesson_plan_review.nothing_available', 'Nothing available yet.')}</Text> : null}
      </View>
    </View>
  );
}

// Admin's read + decide counterpart to the teacher's Lesson Plans screen:
// pick class -> section, filter by status, approve/reject anything
// submitted. Drafts never appear here — only submitted/approved/rejected.
export default function AdminLessonPlanReviewScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();
  const { t } = useLocale();

  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [classId, setClassId] = useState<number | null>(null);
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | LessonPlanStatus>('submitted');

  const [plans, setPlans] = useState<LessonPlan[]>([]);
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const [isLoadingSections, setIsLoadingSections] = useState(false);
  const [isLoadingReview, setIsLoadingReview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [decidingPlan, setDecidingPlan] = useState<LessonPlan | null>(null);
  const [decision, setDecision] = useState<'approved' | 'rejected' | null>(null);
  const [comment, setComment] = useState('');
  const [isDeciding, setIsDeciding] = useState(false);

  useEffect(() => {
    if (!token) return;
    setIsLoadingFilters(true);
    fetchClasses(token)
      .then(setClasses)
      .catch((err) => setError(err instanceof Error ? err.message : t('admin_lesson_plan_review.classes_error', 'Could not load classes.')))
      .finally(() => setIsLoadingFilters(false));
  }, [token, t]);

  const onSelectClass = useCallback(
    (id: number) => {
      setClassId(id);
      setSectionId(null);
      setPlans([]);
      if (!token) return;
      setIsLoadingSections(true);
      fetchSections(token, String(id))
        .then(setSections)
        .catch((err) => setError(err instanceof Error ? err.message : t('admin_lesson_plan_review.sections_error', 'Could not load sections.')))
        .finally(() => setIsLoadingSections(false));
    },
    [token, t]
  );

  const loadReview = useCallback(() => {
    if (!token || !sectionId) return;
    setIsLoadingReview(true);
    setError(null);
    fetchAdminLessonPlanReview(token, {
      section_id: sectionId,
      status: statusFilter === 'all' ? undefined : statusFilter,
    })
      .then(setPlans)
      .catch((err) => setError(err instanceof Error ? err.message : t('admin_lesson_plan_review.plans_error', 'Could not load lesson plans.')))
      .finally(() => setIsLoadingReview(false));
  }, [token, sectionId, statusFilter, t]);

  useEffect(() => {
    loadReview();
  }, [loadReview]);

  const openDecide = (plan: LessonPlan, d: 'approved' | 'rejected') => {
    setDecidingPlan(plan);
    setDecision(d);
    setComment('');
  };

  const confirmDecide = async () => {
    if (!token || !decidingPlan || !decision) return;
    setIsDeciding(true);
    try {
      const updated = await decideLessonPlan(token, decidingPlan.id, decision, comment.trim() || undefined);
      setPlans((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setDecidingPlan(null);
      setDecision(null);
    } catch (e: any) {
      // keep the modal open so they can retry
    } finally {
      setIsDeciding(false);
    }
  };

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
          <IconChevronLeft color={INK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('admin_lesson_plan_review.title', 'Lesson Plans Review')}</Text>
        <View style={{ width: 32 }} />
      </View>

      <FlatList
        data={plans}
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
                <Picker label={t('admin_lesson_plan_review.class', 'Class')} options={classes} selectedId={classId} onSelect={onSelectClass} />
                {classId ? (
                  isLoadingSections ? (
                    <Skeleton width="100%" height={40} borderRadius={12} style={{ marginTop: 8 }} />
                  ) : (
                    <Picker label={t('admin_lesson_plan_review.section', 'Section')} options={sections} selectedId={sectionId} onSelect={setSectionId} />
                  )
                ) : null}
                <View style={styles.pickerBlock}>
                  <Text style={styles.pickerLabel}>{t('admin_lesson_plan_review.status', 'Status')}</Text>
                  <View style={styles.chipWrap}>
                    {STATUS_FILTERS.map((f) => (
                      <TouchableOpacity
                        key={f.key}
                        style={[styles.chip, statusFilter === f.key && styles.chipActive]}
                        onPress={() => setStatusFilter(f.key)}
                      >
                        <Text style={[styles.chipText, statusFilter === f.key && styles.chipTextActive]}>{t(`admin_lesson_plan_review.filter_${f.labelKey}`, f.label)}</Text>
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
            {!isLoadingReview && sectionId && plans.length === 0 && !error ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>{t('admin_lesson_plan_review.empty_title', 'Nothing here yet')}</Text>
                <Text style={styles.emptyDesc}>{t('admin_lesson_plan_review.empty_desc', 'No lesson plans match this section/status.')}</Text>
              </View>
            ) : null}
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTopRow}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) + '22' }]}>
                <Text style={[styles.statusBadgeText, { color: statusColor(item.status) }]}>{item.status}</Text>
              </View>
            </View>
            <Text style={styles.cardMeta}>
              {item.teacher_name} · {item.subject_name}
              {item.week_label ? ` · ${item.week_label}` : ''}
              {item.lesson_date ? ` · ${item.lesson_date}` : ''}
            </Text>
            {item.objectives ? <Text style={styles.cardBody} numberOfLines={3}>{item.objectives}</Text> : null}
            {item.admin_comment ? (
              <Text style={styles.decisionNote}>
                {item.decided_by_name ?? t('admin_lesson_plan_review.admin', 'Admin')}: {item.admin_comment}
              </Text>
            ) : null}
            {item.status === 'submitted' ? (
              <View style={styles.decideRow}>
                <TouchableOpacity style={[styles.decideBtn, styles.rejectBtn]} onPress={() => openDecide(item, 'rejected')}>
                  <Text style={styles.rejectBtnText}>{t('admin_lesson_plan_review.reject', 'Reject')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.decideBtn, styles.approveBtn]} onPress={() => openDecide(item, 'approved')}>
                  <Text style={styles.approveBtnText}>{t('admin_lesson_plan_review.approve', 'Approve')}</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        )}
      />

      <Modal visible={!!decidingPlan} transparent animationType="fade" onRequestClose={() => setDecidingPlan(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {decision === 'approved' ? t('admin_lesson_plan_review.approve_confirm', 'Approve this plan?') : t('admin_lesson_plan_review.reject_confirm', 'Reject this plan?')}
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder={t('admin_lesson_plan_review.comment_placeholder', 'Optional comment for the teacher')}
              placeholderTextColor={SUBTLE}
              value={comment}
              onChangeText={setComment}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnGhost]}
                onPress={() => setDecidingPlan(null)}
                disabled={isDeciding}
              >
                <Text style={styles.modalBtnGhostText}>{t('common.cancel', 'Cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, decision === 'approved' ? styles.modalBtnApprove : styles.modalBtnReject]}
                onPress={confirmDecide}
                disabled={isDeciding}
              >
                {isDeciding ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalBtnPrimaryText}>{decision === 'approved' ? t('admin_lesson_plan_review.approve', 'Approve') : t('admin_lesson_plan_review.reject', 'Reject')}</Text>
                )}
              </TouchableOpacity>
            </View>
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
  cardBody: { fontSize: 12.5, color: INK, marginTop: 8, lineHeight: 17 },
  decisionNote: { fontSize: 12, color: SUBTLE, marginTop: 8, fontStyle: 'italic' },

  decideRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  decideBtn: { flex: 1, borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  rejectBtn: { backgroundColor: '#FCEDED' },
  rejectBtnText: { color: RED, fontWeight: '700', fontSize: 12.5 },
  approveBtn: { backgroundColor: EMERALD },
  approveBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12.5 },

  emptyWrap: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: INK, marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: SUBTLE, textAlign: 'center', lineHeight: 18 },
  errorBanner: { backgroundColor: '#FCEDED', borderRadius: 12, padding: 14, marginBottom: 12 },
  errorText: { color: RED, fontSize: 13.5, textAlign: 'center' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(17,24,39,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, width: '100%', ...SHADOW.level2 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: INK, marginBottom: 12 },
  modalInput: {
    backgroundColor: '#F6F7F9',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: INK,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  modalActions: { flexDirection: 'row', marginTop: 16, gap: 10 },
  modalBtn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalBtnGhost: { backgroundColor: '#F0F1F3' },
  modalBtnGhostText: { color: INK, fontWeight: '700', fontSize: 13 },
  modalBtnApprove: { backgroundColor: EMERALD },
  modalBtnReject: { backgroundColor: RED },
  modalBtnPrimaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
});
