import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Svg, { Path, Polyline, Line } from 'react-native-svg';
import { launchImageLibrary } from 'react-native-image-picker';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import {
  fetchLessonPlanTargets,
  fetchTeacherLessonPlans,
  createLessonPlan,
  updateLessonPlan,
  deleteLessonPlan,
  LessonPlan,
  LessonPlanTarget,
  LessonPlanStatus,
} from '../../services/lessonPlanService';
import { Skeleton } from '../../components/Skeleton';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHADOW, GLASS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';

const EMERALD = '#0F9D58';
const EMERALD_SOFT = '#E7F5EC';
const INK = '#1C1C1E';
const SUBTLE = '#8A9099';
const CANVAS = '#F6F7F9';
const RED = '#B3261E';
const RED_SOFT = '#FDECEC';
const GLASS_SURFACE = GLASS.fillOnLight;
const GLASS_BORDER = GLASS.borderOnLight;

const STATUS_FILTER_KEYS: ('all' | LessonPlanStatus)[] = ['all', 'draft', 'submitted', 'approved', 'rejected'];
const STATUS_FILTER_FALLBACKS: Record<'all' | LessonPlanStatus, string> = {
  all: 'All',
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
};

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

function IconChevronLeft({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline points="15 5 8 12 15 19" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconPlus({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1={12} y1={5} x2={12} y2={19} stroke={color} strokeWidth={2.4} strokeLinecap="round" />
      <Line x1={5} y1={12} x2={19} y2={12} stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}
function IconTrash({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconPaperclip({ color, size = 15 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 12l6-6a3 3 0 1 1 4 4l-8 8a5 5 0 1 1-7-7l7-7" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconX({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1={5} y1={5} x2={19} y2={19} stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Line x1={19} y1={5} x2={5} y2={19} stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

function PlanCardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton width="60%" height={14} borderRadius={4} />
      <Skeleton width="40%" height={11} borderRadius={4} style={{ marginTop: 10 }} />
    </View>
  );
}

type FormState = {
  planId: number | null;
  targetKey: string | null;
  title: string;
  weekLabel: string;
  lessonDate: string;
  objectives: string;
  competencies: string;
  activities: string;
  strategies: string;
  materialsNotes: string;
  homework: string;
  reflections: string;
  attachment: { uri: string; name: string; type: string } | null;
};

const EMPTY_FORM: FormState = {
  planId: null,
  targetKey: null,
  title: '',
  weekLabel: '',
  lessonDate: '',
  objectives: '',
  competencies: '',
  activities: '',
  strategies: '',
  materialsNotes: '',
  homework: '',
  reflections: '',
  attachment: null,
};

// Teacher's lesson plans: filter own plans by status, open a modal to
// draft/edit/submit one, add reflections after teaching, delete while
// still a draft. Every field maps 1:1 to a spec §5 "Lesson plans and
// materials" bullet (objectives, competencies, activities, strategies,
// materials, homework, reflections, optional approval).
export default function TeacherLessonPlansScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();
  const { t } = useLocale();
  const statusFilterLabel = (key: 'all' | LessonPlanStatus) =>
    t(`teacher_lesson_plans.status_filter_${key}`, STATUS_FILTER_FALLBACKS[key]);

  const [plans, setPlans] = useState<LessonPlan[]>([]);
  const [targets, setTargets] = useState<LessonPlanTarget[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | LessonPlanStatus>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const targetKey = (target: LessonPlanTarget) => `${target.section_id}:${target.subject_id}`;
  const selectedTarget = targets.find((target) => targetKey(target) === form.targetKey) ?? null;

  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!token) return;
      if (!opts.silent) setIsLoading(true);
      setError(null);
      try {
        const [planList, targetList] = await Promise.all([
          fetchTeacherLessonPlans(token, statusFilter === 'all' ? {} : { status: statusFilter }),
          targets.length ? Promise.resolve(targets) : fetchLessonPlanTargets(token),
        ]);
        setPlans(planList);
        if (!targets.length) setTargets(targetList);
      } catch (e: any) {
        setError(e?.message ?? t('teacher_lesson_plans.load_error', 'Could not load lesson plans.'));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [token, statusFilter, targets]
  );

  useFocusEffect(
    useCallback(() => {
      load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter])
  );

  const openNew = () => {
    setForm({ ...EMPTY_FORM, targetKey: targets[0] ? targetKey(targets[0]) : null });
    setIsModalVisible(true);
  };

  const openEdit = (plan: LessonPlan) => {
    setForm({
      planId: plan.id,
      targetKey: `${plan.section_id}:${plan.subject_id}`,
      title: plan.title,
      weekLabel: plan.week_label ?? '',
      lessonDate: plan.lesson_date ?? '',
      objectives: plan.objectives ?? '',
      competencies: plan.competencies ?? '',
      activities: plan.activities ?? '',
      strategies: plan.strategies ?? '',
      materialsNotes: plan.materials_notes ?? '',
      homework: plan.homework ?? '',
      reflections: plan.reflections ?? '',
      attachment: null,
    });
    setIsModalVisible(true);
  };

  const pickAttachment = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1, quality: 0.8 });
    if (result.didCancel || result.errorCode || !result.assets?.[0]?.uri) return;
    const asset = result.assets[0];
    setForm((f) => ({
      ...f,
      attachment: { uri: asset.uri as string, name: asset.fileName ?? 'attachment.jpg', type: asset.type ?? 'image/jpeg' },
    }));
  };

  const save = async (submit: boolean) => {
    if (!token) return;
    if (!form.title.trim()) {
      Alert.alert(t('teacher_lesson_plans.missing_title_title', 'Missing title'), t('teacher_lesson_plans.missing_title_message', 'Give this lesson plan a title.'));
      return;
    }
    setIsSubmitting(true);
    try {
      if (form.planId) {
        await updateLessonPlan(token, {
          plan_id: form.planId,
          title: form.title.trim(),
          week_label: form.weekLabel.trim() || undefined,
          lesson_date: form.lessonDate.trim() || undefined,
          objectives: form.objectives.trim() || undefined,
          competencies: form.competencies.trim() || undefined,
          activities: form.activities.trim() || undefined,
          strategies: form.strategies.trim() || undefined,
          materials_notes: form.materialsNotes.trim() || undefined,
          homework: form.homework.trim() || undefined,
          reflections: form.reflections.trim() || undefined,
          submit,
        });
      } else {
        if (!selectedTarget) {
          Alert.alert(t('teacher_lesson_plans.pick_class_title', 'Pick a class'), t('teacher_lesson_plans.pick_class_message', 'Choose which section/subject this plan is for.'));
          setIsSubmitting(false);
          return;
        }
        await createLessonPlan(token, {
          section_id: selectedTarget.section_id,
          subject_id: selectedTarget.subject_id,
          title: form.title.trim(),
          week_label: form.weekLabel.trim() || undefined,
          lesson_date: form.lessonDate.trim() || undefined,
          objectives: form.objectives.trim() || undefined,
          competencies: form.competencies.trim() || undefined,
          activities: form.activities.trim() || undefined,
          strategies: form.strategies.trim() || undefined,
          materials_notes: form.materialsNotes.trim() || undefined,
          homework: form.homework.trim() || undefined,
          submit,
          attachment: form.attachment,
        });
      }
      setIsModalVisible(false);
      load({ silent: true });
    } catch (e: any) {
      Alert.alert(t('teacher_lesson_plans.save_error', 'Could not save'), e?.message ?? t('common.try_again_full', 'Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (plan: LessonPlan) => {
    if (!token) return;
    Alert.alert(
      t('teacher_lesson_plans.delete_confirm_title', 'Delete draft?'),
      t('teacher_lesson_plans.delete_confirm_message', 'This cannot be undone.'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('common.delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteLessonPlan(token, plan.id);
              setPlans((prev) => prev.filter((p) => p.id !== plan.id));
            } catch (e: any) {
              Alert.alert(t('teacher_lesson_plans.delete_error', 'Could not delete'), e?.message ?? t('common.try_again_full', 'Please try again.'));
            }
          },
        },
      ],
    );
  };

  const visiblePlans = useMemo(() => plans, [plans]);

  return (
    <GlassBackground style={{ flex: 1, backgroundColor: CANVAS }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} style={styles.backButton}>
          <IconChevronLeft color={INK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('teacher_lesson_plans.header_title', 'Lesson Plans')}</Text>
        <TouchableOpacity onPress={openNew} hitSlop={12} style={styles.newButton}>
          <IconPlus color={EMERALD} />
        </TouchableOpacity>
      </View>

      <FlatList
        horizontal
        data={STATUS_FILTER_KEYS}
        keyExtractor={(f) => f}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item }) => {
          const active = item === statusFilter;
          return (
            <TouchableOpacity
              onPress={() => setStatusFilter(item)}
              style={[styles.filterChip, active && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{statusFilterLabel(item)}</Text>
            </TouchableOpacity>
          );
        }}
      />

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {isLoading ? (
        <View style={{ paddingHorizontal: 16 }}>
          <PlanCardSkeleton />
          <PlanCardSkeleton />
        </View>
      ) : (
        <FlatList
          data={visiblePlans}
          keyExtractor={(p) => String(p.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
          onRefresh={() => {
            setIsRefreshing(true);
            load({ silent: true });
          }}
          refreshing={isRefreshing}
          ListEmptyComponent={
            <Text style={styles.emptyText}>{t('teacher_lesson_plans.empty', 'No lesson plans yet. Tap + to draft your first one.')}</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => openEdit(item)} activeOpacity={0.85}>
              <View style={styles.cardTopRow}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) + '22' }]}>
                  <Text style={[styles.statusBadgeText, { color: statusColor(item.status) }]}>{statusFilterLabel(item.status)}</Text>
                </View>
                {item.status === 'draft' ? (
                  <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={10} style={{ marginLeft: 6 }}>
                    <IconTrash color={SUBTLE} />
                  </TouchableOpacity>
                ) : null}
              </View>
              <Text style={styles.cardMeta}>
                {item.section_name} · {item.subject_name}
                {item.week_label ? ` · ${item.week_label}` : ''}
                {item.lesson_date ? ` · ${item.lesson_date}` : ''}
              </Text>
              {item.status === 'rejected' && item.admin_comment ? (
                <Text style={styles.rejectionNote} numberOfLines={2}>
                  {t('teacher_lesson_plans.admin_comment', 'Admin: {comment}').replace('{comment}', item.admin_comment)}
                </Text>
              ) : null}
            </TouchableOpacity>
          )}
        />
      )}

      <Modal visible={isModalVisible} transparent animationType="fade" onRequestClose={() => setIsModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: '100%' }}>
              <Text style={styles.modalTitle}>{form.planId ? t('teacher_lesson_plans.edit_title', 'Edit lesson plan') : t('teacher_lesson_plans.new_title', 'New lesson plan')}</Text>

              {!form.planId ? (
                <>
                  <Text style={styles.fieldLabel}>{t('teacher_lesson_plans.class_label', 'Class')}</Text>
                  <FlatList
                    horizontal
                    data={targets}
                    keyExtractor={(target) => targetKey(target)}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 4 }}
                    renderItem={({ item }) => {
                      const key = targetKey(item);
                      const active = key === form.targetKey;
                      return (
                        <TouchableOpacity
                          onPress={() => setForm((f) => ({ ...f, targetKey: key }))}
                          style={[styles.chip, active && styles.chipActive]}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>
                            {item.section_name} · {item.subject_name}
                          </Text>
                        </TouchableOpacity>
                      );
                    }}
                  />
                </>
              ) : (
                <Text style={styles.fieldLabel}>
                  {plans.find((p) => p.id === form.planId)?.section_name} ·{' '}
                  {plans.find((p) => p.id === form.planId)?.subject_name}
                </Text>
              )}

              <Text style={styles.fieldLabel}>{t('teacher_lesson_plans.title_label', 'Title')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('teacher_lesson_plans.title_placeholder', 'e.g. Surah Al-Fatiha — Tajweed rules')}
                placeholderTextColor={SUBTLE}
                value={form.title}
                onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
              />

              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>{t('teacher_lesson_plans.week_label', 'Week')}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={t('teacher_lesson_plans.week_placeholder', 'Week 5')}
                    placeholderTextColor={SUBTLE}
                    value={form.weekLabel}
                    onChangeText={(v) => setForm((f) => ({ ...f, weekLabel: v }))}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>{t('teacher_lesson_plans.date_label', 'Date')}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={SUBTLE}
                    value={form.lessonDate}
                    onChangeText={(v) => setForm((f) => ({ ...f, lessonDate: v }))}
                  />
                </View>
              </View>

              <Text style={styles.fieldLabel}>{t('teacher_lesson_plans.objectives_label', 'Objectives')}</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                multiline
                placeholder={t('teacher_lesson_plans.objectives_placeholder', 'What students should be able to do by the end')}
                placeholderTextColor={SUBTLE}
                value={form.objectives}
                onChangeText={(v) => setForm((f) => ({ ...f, objectives: v }))}
              />

              <Text style={styles.fieldLabel}>{t('teacher_lesson_plans.competencies_label', 'Competencies')}</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                multiline
                placeholderTextColor={SUBTLE}
                value={form.competencies}
                onChangeText={(v) => setForm((f) => ({ ...f, competencies: v }))}
              />

              <Text style={styles.fieldLabel}>{t('teacher_lesson_plans.activities_label', 'Activities')}</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                multiline
                placeholderTextColor={SUBTLE}
                value={form.activities}
                onChangeText={(v) => setForm((f) => ({ ...f, activities: v }))}
              />

              <Text style={styles.fieldLabel}>{t('teacher_lesson_plans.strategies_label', 'Strategies')}</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                multiline
                placeholderTextColor={SUBTLE}
                value={form.strategies}
                onChangeText={(v) => setForm((f) => ({ ...f, strategies: v }))}
              />

              <Text style={styles.fieldLabel}>{t('teacher_lesson_plans.materials_label', 'Materials')}</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                multiline
                placeholder={t('teacher_lesson_plans.materials_placeholder', "What you'll bring/use in class")}
                placeholderTextColor={SUBTLE}
                value={form.materialsNotes}
                onChangeText={(v) => setForm((f) => ({ ...f, materialsNotes: v }))}
              />

              <Text style={styles.fieldLabel}>{t('teacher_lesson_plans.homework_label', 'Homework')}</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                multiline
                placeholderTextColor={SUBTLE}
                value={form.homework}
                onChangeText={(v) => setForm((f) => ({ ...f, homework: v }))}
              />

              {form.planId ? (
                <>
                  <Text style={styles.fieldLabel}>{t('teacher_lesson_plans.reflections_label', 'Reflections (after teaching)')}</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    multiline
                    placeholder={t('teacher_lesson_plans.reflections_placeholder', 'How did it go? What would you change?')}
                    placeholderTextColor={SUBTLE}
                    value={form.reflections}
                    onChangeText={(v) => setForm((f) => ({ ...f, reflections: v }))}
                  />
                </>
              ) : (
                <>
                  <Text style={styles.fieldLabel}>{t('teacher_lesson_plans.attachment_label', 'Attachment')}</Text>
                  {form.attachment ? (
                    <View style={styles.attachmentPicked}>
                      <IconPaperclip color={EMERALD} />
                      <Text style={styles.attachmentPickedText} numberOfLines={1}>
                        {form.attachment.name}
                      </Text>
                      <TouchableOpacity onPress={() => setForm((f) => ({ ...f, attachment: null }))} hitSlop={10}>
                        <IconX color={SUBTLE} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity onPress={pickAttachment} style={styles.attachButton}>
                      <IconPaperclip color={EMERALD} />
                      <Text style={styles.attachButtonText}>{t('teacher_lesson_plans.attach_photo', 'Attach a photo (worksheet, slide, etc.)')}</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnGhost]}
                  onPress={() => setIsModalVisible(false)}
                  disabled={isSubmitting}
                >
                  <Text style={styles.modalBtnGhostText}>{t('common.cancel', 'Cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnGhost]}
                  onPress={() => save(false)}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? <ActivityIndicator color={INK} size="small" /> : <Text style={styles.modalBtnGhostText}>{t('teacher_lesson_plans.save_draft', 'Save draft')}</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnPrimary]}
                  onPress={() => save(true)}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.modalBtnPrimaryText}>{t('teacher_lesson_plans.submit', 'Submit')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: INK, marginLeft: 8 },
  newButton: {
    marginLeft: 'auto',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: { paddingHorizontal: 16, paddingBottom: 10, gap: 8, flexDirection: 'row' },
  filterChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F0F1F3' },
  filterChipActive: { backgroundColor: EMERALD },
  filterChipText: { fontSize: 12.5, color: INK, fontWeight: '600' },
  filterChipTextActive: { color: '#FFFFFF' },
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
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: INK },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusBadgeText: { fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase' },
  cardMeta: { fontSize: 12, color: SUBTLE, marginTop: 6 },
  rejectionNote: { fontSize: 12, color: RED, marginTop: 6, fontStyle: 'italic' },
  emptyText: { textAlign: 'center', color: SUBTLE, marginTop: 40, fontSize: 13.5 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(17,24,39,0.4)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 20, width: '100%', maxHeight: '88%', ...SHADOW.card },
  modalTitle: { fontSize: 16, fontWeight: '700', color: INK, marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: SUBTLE, marginTop: 10, marginBottom: 6, textTransform: 'uppercase' },
  input: {
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13.5,
    color: INK,
    backgroundColor: '#FAFAFB',
  },
  textArea: { minHeight: 60, textAlignVertical: 'top' },
  row2: { flexDirection: 'row', gap: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F0F1F3', marginRight: 8 },
  chipActive: { backgroundColor: EMERALD },
  chipText: { fontSize: 12.5, color: INK, fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF' },
  attachButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: EMERALD_SOFT,
  },
  attachButtonText: { fontSize: 12, color: EMERALD, fontWeight: '600' },
  attachmentPicked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F0F1F3',
  },
  attachmentPickedText: { flex: 1, fontSize: 12.5, color: INK, fontWeight: '500' },
  modalActions: { flexDirection: 'row', marginTop: 16, gap: 8 },
  modalBtn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalBtnGhost: { backgroundColor: '#F0F1F3' },
  modalBtnGhostText: { color: INK, fontWeight: '700', fontSize: 13 },
  modalBtnPrimary: { backgroundColor: EMERALD },
  modalBtnPrimaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
});
