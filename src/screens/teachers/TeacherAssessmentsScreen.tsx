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
  ScrollView,
} from 'react-native';
import KeyboardAwareModal from '../../components/KeyboardAwareModal';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ChevronLeft, Plus, Trash2, Users } from 'lucide-react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import {
  fetchAssessmentTargets,
  fetchTeacherAssessments,
  createAssessment,
  updateAssessment,
  deleteAssessment,
  Assessment,
  AssessmentTarget,
  AssessmentExamCategory,
  AssessmentStatus,
  AssessmentType,
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
const RED = '#B3261E';
const RED_SOFT = '#FDECEC';
const GLASS_SURFACE = GLASS.fillOnLight;
const GLASS_BORDER = GLASS.borderOnLight;

const STATUS_FILTER_KEYS: ('all' | AssessmentStatus)[] = ['all', 'draft', 'published'];
const STATUS_FILTER_FALLBACKS: Record<'all' | AssessmentStatus, string> = {
  all: 'All',
  draft: 'Draft',
  published: 'Published',
};

const TYPE_KEYS: AssessmentType[] = ['assignment', 'quiz', 'project', 'exam'];
const TYPE_FALLBACKS: Record<AssessmentType, string> = {
  assignment: 'Assignment',
  quiz: 'Quiz',
  project: 'Project',
  exam: 'Exam',
};

function statusColor(status: AssessmentStatus) {
  return status === 'published' ? EMERALD : SUBTLE;
}

function IconChevronLeft({ color, size = 22 }: { color: string; size?: number }) {
  return <ChevronLeft size={size} color={color} strokeWidth={2.4} />;
}
function IconPlus({ color, size = 20 }: { color: string; size?: number }) {
  return <Plus size={size} color={color} strokeWidth={2.4} />;
}
function IconTrash({ color, size = 16 }: { color: string; size?: number }) {
  return <Trash2 size={size} color={color} strokeWidth={2} />;
}
function IconUsers({ color, size = 15 }: { color: string; size?: number }) {
  return <Users size={size} color={color} strokeWidth={1.8} />;
}

function CardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton width="60%" height={14} borderRadius={4} />
      <Skeleton width="40%" height={11} borderRadius={4} style={{ marginTop: 10 }} />
    </View>
  );
}

type FormState = {
  assessmentId: number | null;
  targetKey: string | null;
  examCategoryId: number | null;
  type: AssessmentType;
  title: string;
  instructions: string;
  maxScore: string;
  dueAt: string;
  allowResubmission: boolean;
  attachment: { uri: string; name: string; type: string } | null;
};

const EMPTY_FORM: FormState = {
  assessmentId: null,
  targetKey: null,
  examCategoryId: null,
  type: 'assignment',
  title: '',
  instructions: '',
  maxScore: '',
  dueAt: '',
  allowResubmission: false,
  attachment: null,
};

// Teacher's assessments/assignments: filter by status, create/edit in a
// modal, publish or keep as draft, delete while still a draft, and jump
// into the grading roster for a published one. Spec §5's "Assessments and
// assignments" bullet — the larger, submission-bearing sibling of Lesson
// Plans built the prior session.
export default function TeacherAssessmentsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();
  const { t } = useLocale();
  const statusFilterLabel = (key: 'all' | AssessmentStatus) =>
    t(`teacher_assessments.status_filter_${key}`, STATUS_FILTER_FALLBACKS[key]);
  const typeLabel = (key: AssessmentType) => t(`teacher_assessments.type_${key}`, TYPE_FALLBACKS[key]);

  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [targets, setTargets] = useState<AssessmentTarget[]>([]);
  const [examCategories, setExamCategories] = useState<AssessmentExamCategory[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | AssessmentStatus>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const targetKey = (target: AssessmentTarget) => `${target.section_id}:${target.subject_id}`;
  const selectedTarget = targets.find((target) => targetKey(target) === form.targetKey) ?? null;

  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!token) return;
      if (!opts.silent) setIsLoading(true);
      setError(null);
      try {
        const [list, targetData] = await Promise.all([
          fetchTeacherAssessments(token, statusFilter === 'all' ? {} : { status: statusFilter }),
          targets.length ? Promise.resolve({ targets, examCategories }) : fetchAssessmentTargets(token),
        ]);
        setAssessments(list);
        if (!targets.length) {
          setTargets(targetData.targets);
          setExamCategories(targetData.examCategories);
        }
      } catch (e: any) {
        setError(e?.message ?? t('teacher_assessments.load_error', 'Could not load assessments.'));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [token, statusFilter, targets, examCategories]
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

  const openEdit = (a: Assessment) => {
    setForm({
      assessmentId: a.id,
      targetKey: `${a.section_id}:${a.subject_id}`,
      examCategoryId: a.exam_category_id,
      type: a.type,
      title: a.title,
      instructions: a.instructions ?? '',
      maxScore: a.max_score != null ? String(a.max_score) : '',
      dueAt: a.due_at ?? '',
      allowResubmission: a.allow_resubmission,
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

  const save = async (publish: boolean) => {
    if (!token) return;
    if (!form.title.trim()) {
      Alert.alert(t('teacher_assessments.missing_title_title', 'Missing title'), t('teacher_assessments.missing_title_message', 'Give this assessment a title.'));
      return;
    }
    setIsSubmitting(true);
    try {
      if (form.assessmentId) {
        await updateAssessment(token, {
          assessment_id: form.assessmentId,
          exam_category_id: form.examCategoryId,
          title: form.title.trim(),
          instructions: form.instructions.trim() || undefined,
          max_score: form.maxScore.trim() ? Number(form.maxScore) : null,
          due_at: form.dueAt.trim() || null,
          allow_resubmission: form.allowResubmission,
          publish,
        });
      } else {
        if (!selectedTarget) {
          Alert.alert(t('teacher_assessments.pick_class_title', 'Pick a class'), t('teacher_assessments.pick_class_message', 'Choose which section/subject this is for.'));
          setIsSubmitting(false);
          return;
        }
        await createAssessment(token, {
          section_id: selectedTarget.section_id,
          subject_id: selectedTarget.subject_id,
          exam_category_id: form.examCategoryId,
          type: form.type,
          title: form.title.trim(),
          instructions: form.instructions.trim() || undefined,
          max_score: form.maxScore.trim() ? Number(form.maxScore) : undefined,
          due_at: form.dueAt.trim() || undefined,
          allow_resubmission: form.allowResubmission,
          publish,
          attachment: form.attachment,
        });
      }
      setIsModalVisible(false);
      load({ silent: true });
    } catch (e: any) {
      Alert.alert(t('teacher_assessments.save_error', 'Could not save'), e?.message ?? t('common.try_again_full', 'Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (a: Assessment) => {
    if (!token) return;
    Alert.alert(
      t('teacher_assessments.delete_confirm_title', 'Delete draft?'),
      t('teacher_assessments.delete_confirm_message', 'This cannot be undone.'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('common.delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAssessment(token, a.id);
              setAssessments((prev) => prev.filter((p) => p.id !== a.id));
            } catch (e: any) {
              Alert.alert(t('teacher_assessments.delete_error', 'Could not delete'), e?.message ?? t('common.try_again_full', 'Please try again.'));
            }
          },
        },
      ],
    );
  };

  const visible = useMemo(() => assessments, [assessments]);

  return (
    <GlassBackground style={{ flex: 1, backgroundColor: CANVAS }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} style={styles.backButton}>
          <IconChevronLeft color={INK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('teacher_assessments.header_title', 'Assessments')}</Text>
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
          <CardSkeleton />
          <CardSkeleton />
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(a) => String(a.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
          onRefresh={() => {
            setIsRefreshing(true);
            load({ silent: true });
          }}
          refreshing={isRefreshing}
          ListEmptyComponent={
            <Text style={styles.emptyText}>{t('teacher_assessments.empty', 'No assessments yet. Tap + to create your first one.')}</Text>
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
                {item.section_name} · {item.subject_name} · {typeLabel(item.type)}
                {item.exam_category_name ? ` · ${item.exam_category_name}` : ''}
                {item.due_at ? ` · ${t('teacher_assessments.due', 'due {date}').replace('{date}', item.due_at.slice(0, 10))}` : ''}
                {item.max_score != null ? ` · ${t('teacher_assessments.points', '{n} pts').replace('{n}', String(item.max_score))}` : ''}
              </Text>
              {item.status === 'published' ? (
                <TouchableOpacity
                  style={styles.gradeButton}
                  onPress={() => (navigation as any).navigate('TeacherAssessmentGrading', { assessmentId: item.id })}
                >
                  <IconUsers color={EMERALD} />
                  <Text style={styles.gradeButtonText}>
                    {t('teacher_assessments.submitted_graded', '{submitted} submitted · {graded} graded')
                      .replace('{submitted}', String(item.submission_count ?? 0))
                      .replace('{graded}', String(item.graded_count ?? 0))}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </TouchableOpacity>
          )}
        />
      )}

      <KeyboardAwareModal visible={isModalVisible} transparent animationType="fade" onRequestClose={() => setIsModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: '100%' }}>
              <Text style={styles.modalTitle}>{form.assessmentId ? t('teacher_assessments.edit_title', 'Edit assessment') : t('teacher_assessments.new_title', 'New assessment')}</Text>

              {!form.assessmentId ? (
                <>
                  <Text style={styles.fieldLabel}>{t('teacher_assessments.class_label', 'Class')}</Text>
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

                  <Text style={styles.fieldLabel}>{t('teacher_assessments.type_label', 'Type')}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {TYPE_KEYS.map((typeKey) => {
                      const active = typeKey === form.type;
                      return (
                        <TouchableOpacity
                          key={typeKey}
                          onPress={() => setForm((f) => ({ ...f, type: typeKey }))}
                          style={[styles.chip, active && styles.chipActive, { marginBottom: 8 }]}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>{typeLabel(typeKey)}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              ) : (
                <Text style={styles.fieldLabel}>
                  {assessments.find((a) => a.id === form.assessmentId)?.section_name} ·{' '}
                  {assessments.find((a) => a.id === form.assessmentId)?.subject_name} · {typeLabel(form.type)}
                </Text>
              )}

              <Text style={styles.fieldLabel}>{t('teacher_assessments.exam_category_label', 'Exam category (optional)')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                <TouchableOpacity
                  onPress={() => setForm((f) => ({ ...f, examCategoryId: null }))}
                  style={[styles.chip, form.examCategoryId === null && styles.chipActive, { marginBottom: 8 }]}
                >
                  <Text style={[styles.chipText, form.examCategoryId === null && styles.chipTextActive]}>{t('common.none', 'None')}</Text>
                </TouchableOpacity>
                {examCategories.map((c) => {
                  const active = c.id === form.examCategoryId;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      onPress={() => setForm((f) => ({ ...f, examCategoryId: c.id }))}
                      style={[styles.chip, active && styles.chipActive, { marginBottom: 8 }]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {c.name}
                        {c.weight != null ? ` (${c.weight}%)` : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>{t('teacher_assessments.title_label', 'Title')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('teacher_assessments.title_placeholder', 'e.g. Tajweed rules — worksheet 3')}
                placeholderTextColor={SUBTLE}
                value={form.title}
                onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
              />

              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>{t('teacher_assessments.max_score_label', 'Max score')}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="100"
                    keyboardType="numeric"
                    placeholderTextColor={SUBTLE}
                    value={form.maxScore}
                    onChangeText={(v) => setForm((f) => ({ ...f, maxScore: v }))}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>{t('teacher_assessments.due_date_label', 'Due date')}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={SUBTLE}
                    value={form.dueAt}
                    onChangeText={(v) => setForm((f) => ({ ...f, dueAt: v }))}
                  />
                </View>
              </View>

              <Text style={styles.fieldLabel}>{t('teacher_assessments.instructions_label', 'Instructions')}</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                multiline
                placeholder={t('teacher_assessments.instructions_placeholder', 'What students need to do')}
                placeholderTextColor={SUBTLE}
                value={form.instructions}
                onChangeText={(v) => setForm((f) => ({ ...f, instructions: v }))}
              />

              <View style={styles.switchRow}>
                <Text style={styles.fieldLabelInline}>{t('teacher_assessments.allow_resubmission', 'Allow resubmission after grading')}</Text>
                <Switch
                  value={form.allowResubmission}
                  onValueChange={(v) => setForm((f) => ({ ...f, allowResubmission: v }))}
                  trackColor={{ true: EMERALD }}
                />
              </View>

              {!form.assessmentId ? (
                form.attachment ? (
                  <View style={styles.attachmentPicked}>
                    <Text style={styles.attachmentPickedText} numberOfLines={1}>
                      {form.attachment.name}
                    </Text>
                    <TouchableOpacity onPress={() => setForm((f) => ({ ...f, attachment: null }))}>
                      <Text style={{ color: RED, fontSize: 12 }}>{t('common.remove', 'Remove')}</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.attachButton} onPress={pickAttachment}>
                    <Text style={styles.attachButtonText}>{t('teacher_assessments.attach_reference', 'Attach reference material')}</Text>
                  </TouchableOpacity>
                )
              ) : null}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnGhost]}
                  onPress={() => save(false)}
                  disabled={isSubmitting}
                >
                  <Text style={styles.modalBtnGhostText}>{t('teacher_assessments.save_draft', 'Save draft')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnPrimary]}
                  onPress={() => save(true)}
                  disabled={isSubmitting}
                >
                  <Text style={styles.modalBtnPrimaryText}>{t('teacher_assessments.publish', 'Publish')}</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={{ alignSelf: 'center', marginTop: 12 }} onPress={() => setIsModalVisible(false)}>
                <Text style={{ color: SUBTLE, fontSize: 13 }}>{t('common.cancel', 'Cancel')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </KeyboardAwareModal>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12 },
  backButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: INK, textAlign: 'center' },
  newButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
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
  emptyText: { textAlign: 'center', color: SUBTLE, marginTop: 40, fontSize: 13.5 },
  gradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: EMERALD_SOFT,
  },
  gradeButtonText: { fontSize: 11.5, color: EMERALD, fontWeight: '700' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(17,24,39,0.4)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 20, width: '100%', maxHeight: '88%', ...SHADOW.card },
  modalTitle: { fontSize: 16, fontWeight: '700', color: INK, marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: SUBTLE, marginTop: 10, marginBottom: 6, textTransform: 'uppercase' },
  fieldLabelInline: { fontSize: 12.5, fontWeight: '600', color: INK, flex: 1 },
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
  textArea: { minHeight: 70, textAlignVertical: 'top' },
  row2: { flexDirection: 'row', gap: 10 },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F0F1F3', marginRight: 8 },
  chipActive: { backgroundColor: EMERALD },
  chipText: { fontSize: 12.5, color: INK, fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF' },
  attachButton: {
    alignSelf: 'flex-start',
    marginTop: 12,
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
    marginTop: 12,
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
