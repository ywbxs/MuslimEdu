import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import KeyboardAwareModal from '../../components/KeyboardAwareModal';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, FileText, Folder, Mic, SquarePen, Star, Trash2, Upload, WifiOff, Wrench } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { useOfflineQueue } from '../../context/OfflineQueueContext';
import { useAcademicGlassTheme, AcademicGlassTheme } from '../teachers/academicGlassTheme';
import { RADIUS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';
import { BentoGrid } from '../../components/glass/BentoGridCard';
import BentoOptionGrid from '../../components/glass/BentoOptionGrid';
import { EmptyState } from '../../components/EmptyState';
import {
  Examination,
  ExaminationAssignment,
  ExaminationDraft,
  ExaminationResult,
  ExaminationStatus,
  ResultDraft,
  deleteExamination,
  fetchExaminationResults,
  fetchExaminations,
  fetchMyExamAssignments,
  publishExamination,
  releaseExaminationResults,
  saveExamination,
  saveExaminationResults,
} from '../../services/examinationService';
import { ClassStudent, fetchClassStudents } from '../../services/teacherClassService';
import { enqueueExaminationSave, enqueueExaminationResultsSave } from '../../services/offlineQueue';

/**
 * M4 dedicated examinations module. The `examinations`/`examination_results`
 * tables and models already existed (see Examination model's docblock) but
 * had no controller, routes, or screen at all — this wires up what was
 * already scaffolded. Exam-category tagging is intentionally left out of
 * this screen: that endpoint is admin-only server-side
 * (admin_gradebook_exam_categories), so it's skipped here rather than
 * hitting a 403 wall for teachers — exam_category_id stays null.
 *
 * Bento/spatial pass: same data + actions as before, reskinned onto the
 * app's glass design system (GlassBackground + academicGlassTheme) with the
 * exam list as a wrapping bento grid of tiles (BentoGrid) instead of a flat
 * column of rows, and the type/section-subject pickers as bento tile grids
 * (BentoOptionGrid) instead of chip rows/plain lists - same visual language
 * as EnrollmentStagesScreen and the other bento-migrated admin screens.
 *
 * Offline: reads (fetchExaminations/fetchMyExamAssignments/
 * fetchExaminationResults) already fall back to the last cached response
 * via cacheThenNetwork - this adds offline *writes* for the two flows
 * worth doing without connectivity (create/edit an exam, enter grades):
 * both get queued through the same offline outbox used by attendance
 * (offlineQueue.ts) and replayed automatically once back online. Publish/
 * delete/release stay online-only - those are meant to be deliberate,
 * connected actions - but now surface a clear "you're offline" message
 * instead of a raw network error when attempted offline.
 */

const ADMIN_ROLES = [1, 2];

const STATUS_FALLBACKS: Record<ExaminationStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
};

const EXAM_TYPES = ['written', 'oral', 'practical', 'project'];

function IconChevronLeft({ color }: { color: string }) {
  return <ChevronLeft size={20} color={color} strokeWidth={2.4} />;
}
function IconDocument({ color }: { color: string }) {
  return <FileText size={20} color={color} strokeWidth={1.8} />;
}
function IconMic({ color }: { color: string }) {
  return <Mic size={20} color={color} strokeWidth={1.8} />;
}
function IconTool({ color }: { color: string }) {
  return <Wrench size={20} color={color} strokeWidth={1.7} />;
}
function IconFolder({ color }: { color: string }) {
  return <Folder size={20} color={color} strokeWidth={1.8} />;
}
function IconPencil({ color, size = 15 }: { color: string; size?: number }) {
  return <SquarePen size={size} color={color} strokeWidth={2} />;
}
function IconStar({ color, size = 15 }: { color: string; size?: number }) {
  return <Star size={size} color={color} strokeWidth={1.8} />;
}
function IconUpload({ color, size = 15 }: { color: string; size?: number }) {
  return <Upload size={size} color={color} strokeWidth={2} />;
}
function IconTrash({ color, size = 15 }: { color: string; size?: number }) {
  return <Trash2 size={size} color={color} strokeWidth={1.9} />;
}
function IconWifiOff({ color, size = 16 }: { color: string; size?: number }) {
  return <WifiOff size={size} color={color} strokeWidth={1.8} />;
}

function examTypeIcon(type: string, color: string) {
  if (type === 'oral') return <IconMic color={color} />;
  if (type === 'practical') return <IconTool color={color} />;
  if (type === 'project') return <IconFolder color={color} />;
  return <IconDocument color={color} />;
}

export default function ExaminationsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const { t } = useLocale();
  const { isOnline } = useOfflineQueue();
  const theme = useAcademicGlassTheme('emerald');
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const isAdmin = !!user && ADMIN_ROLES.includes(user.role_id);
  const statusLabel = (s: ExaminationStatus) => t(`examinations.status_${s}`, STATUS_FALLBACKS[s]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exams, setExams] = useState<Examination[]>([]);
  const [assignments, setAssignments] = useState<ExaminationAssignment[]>([]);
  const [statusFilter, setStatusFilter] = useState<ExaminationStatus | null>(null);

  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<Examination | null>(null);
  const [saving, setSaving] = useState(false);

  const [fAssignmentKey, setFAssignmentKey] = useState<string | null>(null);
  const [fTitle, setFTitle] = useState('');
  const [fExamType, setFExamType] = useState('written');
  const [fScheduledDate, setFScheduledDate] = useState('');
  const [fTotalMarks, setFTotalMarks] = useState('100');
  const [fPassingMarks, setFPassingMarks] = useState('');
  const [fWeight, setFWeight] = useState('');
  const [fInstructions, setFInstructions] = useState('');

  const [gradingVisible, setGradingVisible] = useState(false);
  const [gradingExam, setGradingExam] = useState<Examination | null>(null);
  const [roster, setRoster] = useState<ClassStudent[]>([]);
  const [existingResults, setExistingResults] = useState<Record<number, ExaminationResult>>({});
  const [marksDraft, setMarksDraft] = useState<Record<number, { marks: string; absent: boolean }>>({});
  const [gradingLoading, setGradingLoading] = useState(false);
  const [gradingSaving, setGradingSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [ex, asn] = await Promise.all([
        fetchExaminations(token, { status: statusFilter }),
        fetchMyExamAssignments(token),
      ]);
      setExams(ex);
      setAssignments(asn);
    } catch (e: any) {
      setError(e?.message ?? t('examinations.load_error', 'Could not load examinations.'));
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter, t]);

  useEffect(() => {
    load();
  }, [load]);

  const uniqueAssignments = useMemo(() => {
    const seen = new Set<string>();
    return assignments.filter((a) => {
      const key = `${a.section_id}:${a.subject_id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [assignments]);

  // BentoOptionGrid needs {id, name} options - assignments are keyed by a
  // composite section:subject string, so index them for the tile grid and
  // map back to the real key on selection.
  const assignmentOptions = useMemo(
    () =>
      uniqueAssignments.map((a, index) => ({
        id: index,
        name: `${a.subject_name ?? t('examinations.subject_fallback', 'Subject {id}').replace('{id}', String(a.subject_id))} — ${t('examinations.section_prefix', 'Section')} ${a.section_id}`,
      })),
    [uniqueAssignments, t],
  );
  const selectedAssignmentIndex = useMemo(() => {
    const index = uniqueAssignments.findIndex((a) => `${a.section_id}:${a.subject_id}` === fAssignmentKey);
    return index >= 0 ? index : null;
  }, [uniqueAssignments, fAssignmentKey]);

  const examTypeOptions = useMemo(
    () => EXAM_TYPES.map((examType, index) => ({ id: index, name: t(`examinations.type_${examType}`, examType) })),
    [t],
  );

  const openNew = () => {
    setEditing(null);
    setFAssignmentKey(null);
    setFTitle('');
    setFExamType('written');
    setFScheduledDate('');
    setFTotalMarks('100');
    setFPassingMarks('');
    setFWeight('');
    setFInstructions('');
    setFormVisible(true);
  };

  const openEdit = (exam: Examination) => {
    if (exam.status === 'published' && !isAdmin) {
      Alert.alert(
        t('examinations.published_exam_title', 'Published exam'),
        t('examinations.published_exam_message', 'Only an administrator can change a published exam. You can still grade and release results.'),
      );
      return;
    }
    setEditing(exam);
    setFAssignmentKey(exam.section_id && exam.subject_id ? `${exam.section_id}:${exam.subject_id}` : null);
    setFTitle(exam.title);
    setFExamType(exam.exam_type);
    setFScheduledDate(exam.scheduled_date?.slice(0, 10) ?? '');
    setFTotalMarks(String(exam.total_marks ?? 100));
    setFPassingMarks(exam.passing_marks != null ? String(exam.passing_marks) : '');
    setFWeight(exam.weight != null ? String(exam.weight) : '');
    setFInstructions(exam.instructions ?? '');
    setFormVisible(true);
  };

  const onSave = async () => {
    if (!token) return;
    if (!editing && !fAssignmentKey) {
      Alert.alert(t('examinations.missing_info', 'Missing info'), t('examinations.missing_section_subject', 'Pick a section and subject first.'));
      return;
    }
    if (!fTitle.trim()) {
      Alert.alert(t('examinations.title_required', 'Title required'), t('examinations.title_required_message', 'Give this exam a title first.'));
      return;
    }
    setSaving(true);
    try {
      const [sectionId, subjectId] = editing
        ? [editing.section_id!, editing.subject_id!]
        : fAssignmentKey!.split(':').map(Number);

      const draft: ExaminationDraft = {
        id: editing?.id,
        section_id: sectionId,
        subject_id: subjectId,
        title: fTitle.trim(),
        exam_type: fExamType,
        scheduled_date: fScheduledDate.trim() || null,
        total_marks: fTotalMarks.trim() ? Number(fTotalMarks.trim()) : 100,
        passing_marks: fPassingMarks.trim() ? Number(fPassingMarks.trim()) : null,
        weight: fWeight.trim() ? Number(fWeight.trim()) : null,
        instructions: fInstructions.trim() || null,
      };

      if (!isOnline) {
        // Queue it - offlineQueue auto-flushes through this same
        // saveExamination() the moment connectivity returns. There's no
        // server-assigned id/response to merge into the list yet, so just
        // close the form and tell the user it'll sync.
        enqueueExaminationSave(token, draft);
        setFormVisible(false);
        Alert.alert(
          t('examinations.saved_offline_title', 'Saved offline'),
          t('examinations.saved_offline_message', "This exam will sync automatically once you're back online."),
        );
        return;
      }

      const saved = await saveExamination(token, draft);
      setExams((prev) => {
        const others = prev.filter((x) => x.id !== saved.id);
        return [saved, ...others];
      });
      setFormVisible(false);
    } catch (e: any) {
      Alert.alert(t('examinations.save_error', 'Could not save'), e?.message ?? t('common.try_again_full', 'Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const requireOnline = (message: string): boolean => {
    if (isOnline) return true;
    Alert.alert(t('examinations.offline_title', "You're offline"), message);
    return false;
  };

  const onPublish = (exam: Examination) => {
    if (
      !requireOnline(
        t('examinations.offline_publish_message', 'Connect to the internet to publish this exam.'),
      )
    ) {
      return;
    }
    Alert.alert(
      t('examinations.publish_title', 'Publish this exam?'),
      t(
        'examinations.publish_message',
        'Students in this section will be able to see it. You can no longer edit its schedule or marks without an administrator.',
      ),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('examinations.publish', 'Publish'),
          onPress: async () => {
            if (!token) return;
            try {
              const saved = await publishExamination(token, exam.id);
              setExams((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
            } catch (e: any) {
              Alert.alert(t('examinations.publish_error', 'Could not publish'), e?.message ?? t('common.try_again_full', 'Please try again.'));
            }
          },
        },
      ],
    );
  };

  const confirmDelete = (exam: Examination) => {
    if (
      !requireOnline(t('examinations.offline_delete_message', 'Connect to the internet to delete this exam.'))
    ) {
      return;
    }
    Alert.alert(t('examinations.delete_title', 'Delete this exam?'), t('examinations.delete_message', 'This cannot be undone.'), [
      { text: t('common.cancel', 'Cancel'), style: 'cancel' },
      {
        text: t('examinations.delete', 'Delete'),
        style: 'destructive',
        onPress: async () => {
          if (!token) return;
          try {
            await deleteExamination(token, exam.id);
            setExams((prev) => prev.filter((x) => x.id !== exam.id));
          } catch (e: any) {
            Alert.alert(t('examinations.delete_error', 'Could not delete'), e?.message ?? t('common.try_again_full', 'Please try again.'));
          }
        },
      },
    ]);
  };

  const openGrading = async (exam: Examination) => {
    if (!token || !exam.section_id) return;
    setGradingExam(exam);
    setGradingVisible(true);
    setGradingLoading(true);
    try {
      const [r, results] = await Promise.all([
        fetchClassStudents(token, exam.section_id),
        fetchExaminationResults(token, exam.id),
      ]);
      setRoster(r.students);
      const resultMap: Record<number, ExaminationResult> = {};
      results.forEach((res) => {
        resultMap[res.student_id] = res;
      });
      setExistingResults(resultMap);
      const draft: Record<number, { marks: string; absent: boolean }> = {};
      r.students.forEach((s) => {
        const existing = resultMap[s.id];
        draft[s.id] = {
          marks: existing?.marks_obtained != null ? String(existing.marks_obtained) : '',
          absent: existing?.is_absent ?? false,
        };
      });
      setMarksDraft(draft);
    } catch (e: any) {
      Alert.alert(t('examinations.load_roster_error', "Couldn't load roster"), e?.message ?? t('common.try_again_full', 'Please try again.'));
    } finally {
      setGradingLoading(false);
    }
  };

  const onSaveGrades = async () => {
    if (!token || !gradingExam) return;
    setGradingSaving(true);
    try {
      const results: ResultDraft[] = roster.map((s) => ({
        student_id: s.id,
        marks_obtained: marksDraft[s.id]?.marks.trim() ? Number(marksDraft[s.id].marks.trim()) : null,
        is_absent: marksDraft[s.id]?.absent ?? false,
      }));

      if (!isOnline) {
        enqueueExaminationResultsSave(token, gradingExam.id, results);
        Alert.alert(
          t('examinations.saved_offline_title', 'Saved offline'),
          t(
            'examinations.grades_saved_offline_message',
            "These grades will sync automatically once you're back online. Release them afterward so students can see their marks.",
          ),
        );
        return;
      }

      await saveExaminationResults(token, gradingExam.id, results);
      Alert.alert(t('examinations.saved', 'Saved'), t('examinations.saved_message', 'Grades saved. Remember to release them so students can see their marks.'));
    } catch (e: any) {
      Alert.alert(t('examinations.save_grades_error', 'Could not save grades'), e?.message ?? t('common.try_again_full', 'Please try again.'));
    } finally {
      setGradingSaving(false);
    }
  };

  const onRelease = () => {
    if (!token || !gradingExam) return;
    if (
      !requireOnline(t('examinations.offline_release_message', 'Connect to the internet to release results.'))
    ) {
      return;
    }
    Alert.alert(t('examinations.release_title', 'Release results?'), t('examinations.release_message', 'Students will be able to see their marks for this exam.'), [
      { text: t('common.cancel', 'Cancel'), style: 'cancel' },
      {
        text: t('examinations.release', 'Release'),
        onPress: async () => {
          try {
            await releaseExaminationResults(token, gradingExam.id);
            Alert.alert(t('examinations.released', 'Released'), t('examinations.released_message', 'Results are now visible to students.'));
          } catch (e: any) {
            Alert.alert(t('examinations.release_error', 'Could not release'), e?.message ?? t('common.try_again_full', 'Please try again.'));
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <GlassBackground variant="canvas" />
        <ActivityIndicator color={theme.accent} size="large" />
        <Text style={styles.centerText}>{t('examinations.loading', 'Loading examinations…')}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <GlassBackground variant="canvas" />
        <Text style={styles.errorTitle}>{t('examinations.load_failed_title', "Couldn't load this")}</Text>
        <Text style={styles.centerText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={load}>
          <Text style={styles.retryText}>{t('common.retry', 'Retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusOptions: (ExaminationStatus | null)[] = [null, 'draft', 'published', 'archived'];

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={10}>
          <IconChevronLeft color={theme.accent} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>{t('examinations.title', 'Examinations')}</Text>
          <Text style={styles.headerSub}>
            {isAdmin ? t('examinations.subtitle_admin', 'All exams in your school') : t('examinations.subtitle_teacher', 'Exams you own')}
          </Text>
        </View>
      </View>

      {!isOnline ? (
        <View style={styles.offlineBanner}>
          <IconWifiOff color={theme.warning} />
          <Text style={styles.offlineBannerText}>
            {t('examinations.offline_banner', "You're offline - showing your last saved exams. New exams and grades will sync automatically.")}
          </Text>
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterRowContent}>
        {statusOptions.map((s) => (
          <TouchableOpacity
            key={s ?? 'all'}
            style={[styles.filterChip, statusFilter === s && styles.filterChipActive]}
            onPress={() => setStatusFilter(s)}
          >
            <Text style={[styles.filterChipText, statusFilter === s && styles.filterChipTextActive]}>
              {s ? statusLabel(s) : t('common.all', 'All')}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {exams.length === 0 ? (
          <EmptyState
            icon="📝"
            title={t('examinations.empty_title', 'No examinations yet')}
            subtitle={t('examinations.empty', 'Create one and it stays a draft until you publish it to the section.')}
            actionLabel={t('examinations.new_examination', '+ New Examination')}
            onAction={openNew}
            colors={theme}
          />
        ) : (
          <BentoGrid>
            {exams.map((exam) => {
              const gradedCount = (exam.results ?? []).filter((r) => r.marks_obtained != null || r.is_absent).length;
              const totalResults = (exam.results ?? []).length;
              const isPublished = exam.status === 'published';
              return (
                <View key={exam.id} style={styles.tile}>
                  <View style={styles.tileTop}>
                    <View style={styles.iconWrap}>{examTypeIcon(exam.exam_type, theme.accent)}</View>
                    <Text
                      style={[
                        styles.statusBadge,
                        { color: isPublished ? theme.success : theme.textSecondary, backgroundColor: isPublished ? theme.successSoft : theme.surfaceVariant },
                      ]}
                      numberOfLines={1}
                    >
                      {statusLabel(exam.status)}
                    </Text>
                  </View>

                  <Text style={styles.tileTitle} numberOfLines={2}>
                    {exam.title}
                  </Text>
                  <Text style={styles.tileMeta} numberOfLines={2}>
                    {t(`examinations.type_${exam.exam_type}`, exam.exam_type)} · {exam.total_marks} {t('examinations.marks', 'marks')}
                    {exam.scheduled_date ? ` · ${exam.scheduled_date.slice(0, 10)}` : ''}
                  </Text>
                  <Text style={styles.tileMeta}>
                    {gradedCount}/{totalResults || '?'} {t('examinations.graded', 'graded')}
                  </Text>

                  <View style={styles.tileActions}>
                    <TouchableOpacity style={styles.tileActionBtn} onPress={() => openGrading(exam)} hitSlop={6}>
                      <IconStar color={theme.accent} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.tileActionBtn} onPress={() => openEdit(exam)} hitSlop={6}>
                      <IconPencil color={theme.textSecondary} />
                    </TouchableOpacity>
                    {exam.status === 'draft' && (
                      <TouchableOpacity style={styles.tileActionBtn} onPress={() => onPublish(exam)} hitSlop={6}>
                        <IconUpload color={theme.accent} />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.tileActionBtn} onPress={() => confirmDelete(exam)} hitSlop={6}>
                      <IconTrash color={theme.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </BentoGrid>
        )}
      </ScrollView>

      <View style={[styles.saveBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity style={styles.addBtn} onPress={openNew}>
          <Text style={styles.addBtnText}>{t('examinations.new_examination', '+ New Examination')}</Text>
        </TouchableOpacity>
      </View>

      {/* Create/edit exam modal */}
      <KeyboardAwareModal visible={formVisible} animationType="slide" transparent onRequestClose={() => setFormVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>
                {editing ? t('examinations.edit_examination', 'Edit Examination') : t('examinations.new_examination_title', 'New Examination')}
              </Text>

              {!editing && (
                <BentoOptionGrid
                  label={t('examinations.section_subject_label', 'Section / Subject')}
                  options={assignmentOptions}
                  value={selectedAssignmentIndex}
                  onChange={(id) => setFAssignmentKey(id !== null ? `${uniqueAssignments[id].section_id}:${uniqueAssignments[id].subject_id}` : null)}
                  icon={(_option, color) => <IconDocument color={color} />}
                  theme={theme}
                  tileWidth="47%"
                />
              )}
              {!editing && uniqueAssignments.length === 0 && (
                <Text style={styles.emptyText}>{t('examinations.no_assignments', "You're not assigned to teach any subject yet.")}</Text>
              )}

              <Text style={styles.label}>{t('examinations.title_label', 'Title')}</Text>
              <TextInput style={styles.input} value={fTitle} onChangeText={setFTitle} placeholder={t('examinations.title_placeholder', 'e.g. Midterm Exam')} placeholderTextColor={theme.textMuted} />

              <BentoOptionGrid
                label={t('examinations.type_label', 'Type')}
                options={examTypeOptions}
                value={EXAM_TYPES.indexOf(fExamType)}
                onChange={(id) => id !== null && setFExamType(EXAM_TYPES[id])}
                icon={(option, color) => examTypeIcon(EXAM_TYPES[option?.id ?? 0], color)}
                theme={theme}
                tileWidth="22%"
              />

              <Text style={styles.label}>{t('examinations.scheduled_date_label', 'Scheduled date (YYYY-MM-DD, optional)')}</Text>
              <TextInput style={styles.input} value={fScheduledDate} onChangeText={setFScheduledDate} placeholder="2026-08-15" placeholderTextColor={theme.textMuted} />

              <Text style={styles.label}>{t('examinations.total_marks_label', 'Total marks')}</Text>
              <TextInput style={styles.input} value={fTotalMarks} onChangeText={setFTotalMarks} keyboardType="numeric" placeholderTextColor={theme.textMuted} />

              <Text style={styles.label}>{t('examinations.passing_marks_label', 'Passing marks (optional)')}</Text>
              <TextInput style={styles.input} value={fPassingMarks} onChangeText={setFPassingMarks} keyboardType="numeric" placeholderTextColor={theme.textMuted} />

              <Text style={styles.label}>{t('examinations.weight_label', 'Weight % (optional)')}</Text>
              <TextInput style={styles.input} value={fWeight} onChangeText={setFWeight} keyboardType="numeric" placeholderTextColor={theme.textMuted} />

              <Text style={styles.label}>{t('examinations.instructions_label', 'Instructions (optional)')}</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={fInstructions}
                onChangeText={setFInstructions}
                multiline
                placeholderTextColor={theme.textMuted}
              />

              {!isOnline && (
                <View style={styles.offlineNote}>
                  <IconWifiOff color={theme.warning} size={14} />
                  <Text style={styles.offlineNoteText}>
                    {t('examinations.offline_form_note', "You're offline - this will be queued and saved automatically once you're back online.")}
                  </Text>
                </View>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancel} onPress={() => setFormVisible(false)} disabled={saving}>
                  <Text style={styles.modalCancelText}>{t('common.cancel', 'Cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalSave} onPress={onSave} disabled={saving}>
                  {saving ? <ActivityIndicator color={theme.onAccent} /> : <Text style={styles.modalSaveText}>{t('common.save', 'Save')}</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAwareModal>

      {/* Grading modal */}
      <KeyboardAwareModal visible={gradingVisible} animationType="slide" transparent onRequestClose={() => setGradingVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{gradingExam?.title ?? t('examinations.grade_exam', 'Grade Exam')}</Text>
            {gradingLoading ? (
              <ActivityIndicator color={theme.accent} style={{ marginVertical: 20 }} />
            ) : (
              <ScrollView style={styles.rosterList} nestedScrollEnabled>
                {roster.map((s) => (
                  <View key={s.id} style={styles.rosterRow}>
                    <Text style={styles.rosterName} numberOfLines={1}>
                      {s.name}
                    </Text>
                    <TextInput
                      style={styles.marksInput}
                      value={marksDraft[s.id]?.marks ?? ''}
                      onChangeText={(text) =>
                        setMarksDraft((prev) => ({ ...prev, [s.id]: { ...prev[s.id], marks: text } }))
                      }
                      keyboardType="numeric"
                      placeholder="—"
                      placeholderTextColor={theme.textMuted}
                      editable={!marksDraft[s.id]?.absent}
                    />
                    <TouchableOpacity
                      style={[styles.absentToggle, marksDraft[s.id]?.absent && styles.absentToggleActive]}
                      onPress={() =>
                        setMarksDraft((prev) => ({
                          ...prev,
                          [s.id]: { marks: prev[s.id]?.marks ?? '', absent: !prev[s.id]?.absent },
                        }))
                      }
                    >
                      <Text
                        style={[
                          styles.absentToggleText,
                          marksDraft[s.id]?.absent && styles.absentToggleTextActive,
                        ]}
                      >
                        {t('examinations.absent', 'Absent')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
                {roster.length === 0 && (
                  <Text style={styles.emptyText}>{t('examinations.no_students', 'No students enrolled in this section.')}</Text>
                )}
              </ScrollView>
            )}

            {!isOnline && (
              <View style={styles.offlineNote}>
                <IconWifiOff color={theme.warning} size={14} />
                <Text style={styles.offlineNoteText}>
                  {t('examinations.offline_form_note', "You're offline - this will be queued and saved automatically once you're back online.")}
                </Text>
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setGradingVisible(false)}>
                <Text style={styles.modalCancelText}>{t('common.close', 'Close')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCancel} onPress={onRelease}>
                <Text style={styles.modalCancelText}>{t('examinations.release', 'Release')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={onSaveGrades} disabled={gradingSaving}>
                {gradingSaving ? <ActivityIndicator color={theme.onAccent} /> : <Text style={styles.modalSaveText}>{t('examinations.save_grades', 'Save Grades')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAwareModal>
    </View>
  );
}

const makeStyles = (theme: AcademicGlassTheme) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: theme.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
    centerText: { marginTop: 12, fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 20 },
    errorTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
    retryBtn: { marginTop: 20, backgroundColor: theme.accent, paddingHorizontal: 26, paddingVertical: 12, borderRadius: RADIUS.pill },
    retryText: { color: theme.onAccent, fontWeight: '700', fontSize: 14 },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingBottom: 14,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.accentSoft, marginRight: 12 },
    headerText: { flex: 1 },
    headerTitle: { fontSize: 20, fontWeight: '800', color: theme.textPrimary },
    headerSub: { fontSize: 12.5, color: theme.textSecondary, marginTop: 2 },

    offlineBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.warningSoft,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    offlineBannerText: { flex: 1, color: theme.warning, fontSize: 12, lineHeight: 16, fontWeight: '600' },

    filterRow: { flexGrow: 0, backgroundColor: theme.surface },
    filterRowContent: { paddingHorizontal: 16, paddingVertical: 10 },
    filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: theme.surfaceVariant, marginRight: 8 },
    filterChipActive: { backgroundColor: theme.accent },
    filterChipText: { fontSize: 12.5, fontWeight: '700', color: theme.textSecondary },
    filterChipTextActive: { color: theme.onAccent },

    scroll: { flex: 1 },
    scrollContent: { paddingBottom: 16 },

    emptyText: { fontSize: 13.5, color: theme.textSecondary, lineHeight: 20, textAlign: 'center', marginTop: 8 },

    // --- Bento tile: matches BentoGridCard's visual language (icon badge,
    // status badge top-right, title, meta lines) with its own compact icon
    // action row instead of text links.
    tile: {
      width: '47%',
      minHeight: 190,
      backgroundColor: theme.surface,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      ...theme.elevation2,
    },
    tileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
    iconWrap: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: theme.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusBadge: { fontSize: 10.5, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' },
    tileTitle: { fontSize: 15, fontWeight: '700', color: theme.textPrimary, marginBottom: 6 },
    tileMeta: { fontSize: 11.5, color: theme.textSecondary, lineHeight: 16, marginBottom: 2 },
    tileActions: { flexDirection: 'row', gap: 8, marginTop: 'auto', paddingTop: 10 },
    tileActionBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: theme.surfaceVariant,
      alignItems: 'center',
      justifyContent: 'center',
    },

    saveBar: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: theme.surface, borderTopWidth: 1, borderTopColor: theme.border },
    addBtn: { backgroundColor: theme.accent, borderRadius: RADIUS.pill, height: 52, alignItems: 'center', justifyContent: 'center', ...theme.elevation1 },
    addBtnText: { color: theme.onAccent, fontWeight: '800', fontSize: 15 },

    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalCard: { backgroundColor: theme.surface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: 20, paddingBottom: 32, maxHeight: '90%' },
    modalTitle: { fontSize: 17, fontWeight: '800', color: theme.textPrimary, marginBottom: 14 },
    label: { fontSize: 13.5, fontWeight: '700', color: theme.textPrimary, marginTop: 14, marginBottom: 4 },
    input: { marginTop: 4, borderWidth: 1, borderColor: theme.border, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: theme.textPrimary, backgroundColor: theme.surfaceVariant },
    inputMultiline: { minHeight: 70, textAlignVertical: 'top' },

    offlineNote: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.warningSoft,
      borderRadius: RADIUS.md,
      padding: 12,
      marginTop: 16,
    },
    offlineNoteText: { flex: 1, color: theme.warning, fontSize: 11.5, lineHeight: 16, fontWeight: '600' },

    modalActions: { flexDirection: 'row', gap: 10, marginTop: 22 },
    modalCancel: { flex: 1, height: 48, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceVariant },
    modalCancelText: { fontSize: 13.5, fontWeight: '700', color: theme.textSecondary },
    modalSave: { flex: 1, height: 48, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.accent },
    modalSaveText: { fontSize: 13.5, fontWeight: '700', color: theme.onAccent },

    rosterList: { maxHeight: 340, marginTop: 8 },
    rosterRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border, gap: 8 },
    rosterName: { flex: 1, fontSize: 13.5, color: theme.textPrimary },
    marksInput: { width: 64, borderWidth: 1, borderColor: theme.border, borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 6, fontSize: 13.5, color: theme.textPrimary, backgroundColor: theme.surfaceVariant, textAlign: 'center' },
    absentToggle: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: theme.border },
    absentToggleActive: { backgroundColor: theme.dangerSoft, borderColor: theme.danger },
    absentToggleText: { fontSize: 11.5, fontWeight: '600', color: theme.textSecondary },
    absentToggleTextActive: { color: theme.danger },
  });
