import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { EMERALD, EMERALD_SOFT, INK, SUBTLE } from '../dashboards/DashboardShell';
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

/**
 * M4 dedicated examinations module. The `examinations`/`examination_results`
 * tables and models already existed (see Examination model's docblock) but
 * had no controller, routes, or screen at all — this wires up what was
 * already scaffolded. Exam-category tagging is intentionally left out of
 * this screen: that endpoint is admin-only server-side
 * (admin_gradebook_exam_categories), so it's skipped here rather than
 * hitting a 403 wall for teachers — exam_category_id stays null.
 *
 * Never executed against a live backend.
 */

const BORDER = '#E4E9E5';
const CANVAS = '#F5F7F6';
const DANGER = '#BA1A1A';
const ADMIN_ROLES = [1, 2];

const STATUS_LABELS: Record<ExaminationStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
};

const EXAM_TYPES = ['written', 'oral', 'practical', 'project'];

export default function ExaminationsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const isAdmin = !!user && ADMIN_ROLES.includes(user.role_id);

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
      setError(e?.message ?? 'Could not load examinations.');
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter]);

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
      Alert.alert('Published exam', 'Only an administrator can change a published exam. You can still grade and release results.');
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
      Alert.alert('Missing info', 'Pick a section and subject first.');
      return;
    }
    if (!fTitle.trim()) {
      Alert.alert('Title required', 'Give this exam a title first.');
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
      const saved = await saveExamination(token, draft);
      setExams((prev) => {
        const others = prev.filter((x) => x.id !== saved.id);
        return [saved, ...others];
      });
      setFormVisible(false);
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const onPublish = (exam: Examination) => {
    Alert.alert('Publish this exam?', 'Students in this section will be able to see it. You can no longer edit its schedule or marks without an administrator.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Publish',
        onPress: async () => {
          if (!token) return;
          try {
            const saved = await publishExamination(token, exam.id);
            setExams((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
          } catch (e: any) {
            Alert.alert('Could not publish', e?.message ?? 'Please try again.');
          }
        },
      },
    ]);
  };

  const confirmDelete = (exam: Examination) => {
    Alert.alert('Delete this exam?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!token) return;
          try {
            await deleteExamination(token, exam.id);
            setExams((prev) => prev.filter((x) => x.id !== exam.id));
          } catch (e: any) {
            Alert.alert('Could not delete', e?.message ?? 'Please try again.');
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
      Alert.alert("Couldn't load roster", e?.message ?? 'Please try again.');
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
      await saveExaminationResults(token, gradingExam.id, results);
      Alert.alert('Saved', 'Grades saved. Remember to release them so students can see their marks.');
    } catch (e: any) {
      Alert.alert('Could not save grades', e?.message ?? 'Please try again.');
    } finally {
      setGradingSaving(false);
    }
  };

  const onRelease = () => {
    if (!token || !gradingExam) return;
    Alert.alert('Release results?', 'Students will be able to see their marks for this exam.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Release',
        onPress: async () => {
          try {
            await releaseExaminationResults(token, gradingExam.id);
            Alert.alert('Released', 'Results are now visible to students.');
          } catch (e: any) {
            Alert.alert('Could not release', e?.message ?? 'Please try again.');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={EMERALD} size="large" />
        <Text style={styles.centerText}>Loading examinations…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Couldn't load this</Text>
        <Text style={styles.centerText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={load}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusOptions: (ExaminationStatus | null)[] = [null, 'draft', 'published', 'archived'];

  return (
    <View style={[styles.flex, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backChevron}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Examinations</Text>
          <Text style={styles.headerSub}>{isAdmin ? 'All exams in your school' : 'Exams you own'}</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {statusOptions.map((s) => (
          <TouchableOpacity
            key={s ?? 'all'}
            style={[styles.filterChip, statusFilter === s && styles.filterChipActive]}
            onPress={() => setStatusFilter(s)}
          >
            <Text style={[styles.filterChipText, statusFilter === s && styles.filterChipTextActive]}>
              {s ? STATUS_LABELS[s] : 'All'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {exams.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No examinations yet.</Text>
          </View>
        ) : (
          exams.map((exam) => {
            const gradedCount = (exam.results ?? []).filter((r) => r.marks_obtained != null || r.is_absent).length;
            return (
              <View key={exam.id} style={styles.card}>
                <View style={styles.rowBetween}>
                  <View style={styles.flexCol}>
                    <Text style={styles.rowTitle}>{exam.title}</Text>
                    <Text style={styles.rowSub}>
                      {exam.exam_type} · {exam.total_marks} marks
                      {exam.scheduled_date ? ` · ${exam.scheduled_date.slice(0, 10)}` : ''}
                      {' · '}
                      {gradedCount}/{(exam.results ?? []).length || '?'} graded
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.statusBadge,
                      exam.status === 'published' ? styles.statusPublished : styles.statusDraft,
                    ]}
                  >
                    {STATUS_LABELS[exam.status]}
                  </Text>
                </View>

                <View style={styles.actionsRow}>
                  <TouchableOpacity onPress={() => openGrading(exam)}>
                    <Text style={styles.actionLink}>Grade</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => openEdit(exam)}>
                    <Text style={styles.actionLink}>Edit</Text>
                  </TouchableOpacity>
                  {exam.status === 'draft' && (
                    <TouchableOpacity onPress={() => onPublish(exam)}>
                      <Text style={styles.actionLink}>Publish</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => confirmDelete(exam)}>
                    <Text style={[styles.actionLink, styles.deleteLink]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <View style={[styles.saveBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity style={styles.addBtn} onPress={openNew}>
          <Text style={styles.addBtnText}>+ New Examination</Text>
        </TouchableOpacity>
      </View>

      {/* Create/edit exam modal */}
      <Modal visible={formVisible} animationType="slide" transparent onRequestClose={() => setFormVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>{editing ? 'Edit Examination' : 'New Examination'}</Text>

              {!editing && (
                <>
                  <Text style={styles.label}>Section / Subject</Text>
                  <ScrollView style={styles.assignmentList} nestedScrollEnabled>
                    {uniqueAssignments.map((a) => {
                      const key = `${a.section_id}:${a.subject_id}`;
                      return (
                        <TouchableOpacity
                          key={key}
                          style={[styles.assignmentRow, fAssignmentKey === key && styles.assignmentRowActive]}
                          onPress={() => setFAssignmentKey(key)}
                        >
                          <Text style={[styles.assignmentRowText, fAssignmentKey === key && styles.assignmentRowTextActive]}>
                            {a.subject_name ?? `Subject ${a.subject_id}`} — Section {a.section_id}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                    {uniqueAssignments.length === 0 && (
                      <Text style={styles.emptyText}>You're not assigned to teach any subject yet.</Text>
                    )}
                  </ScrollView>
                </>
              )}

              <Text style={styles.label}>Title</Text>
              <TextInput style={styles.input} value={fTitle} onChangeText={setFTitle} placeholder="e.g. Midterm Exam" />

              <Text style={styles.label}>Type</Text>
              <View style={styles.chipRow}>
                {EXAM_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.chip, fExamType === t && styles.chipActive]}
                    onPress={() => setFExamType(t)}
                  >
                    <Text style={[styles.chipText, fExamType === t && styles.chipTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Scheduled date (YYYY-MM-DD, optional)</Text>
              <TextInput style={styles.input} value={fScheduledDate} onChangeText={setFScheduledDate} placeholder="2026-08-15" />

              <Text style={styles.label}>Total marks</Text>
              <TextInput style={styles.input} value={fTotalMarks} onChangeText={setFTotalMarks} keyboardType="numeric" />

              <Text style={styles.label}>Passing marks (optional)</Text>
              <TextInput style={styles.input} value={fPassingMarks} onChangeText={setFPassingMarks} keyboardType="numeric" />

              <Text style={styles.label}>Weight % (optional)</Text>
              <TextInput style={styles.input} value={fWeight} onChangeText={setFWeight} keyboardType="numeric" />

              <Text style={styles.label}>Instructions (optional)</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={fInstructions}
                onChangeText={setFInstructions}
                multiline
              />

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancel} onPress={() => setFormVisible(false)} disabled={saving}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalSave} onPress={onSave} disabled={saving}>
                  {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.modalSaveText}>Save</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Grading modal */}
      <Modal visible={gradingVisible} animationType="slide" transparent onRequestClose={() => setGradingVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{gradingExam?.title ?? 'Grade Exam'}</Text>
            {gradingLoading ? (
              <ActivityIndicator color={EMERALD} style={{ marginVertical: 20 }} />
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
                        Absent
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
                {roster.length === 0 && <Text style={styles.emptyText}>No students enrolled in this section.</Text>}
              </ScrollView>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setGradingVisible(false)}>
                <Text style={styles.modalCancelText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCancel} onPress={onRelease}>
                <Text style={styles.modalCancelText}>Release</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={onSaveGrades} disabled={gradingSaving}>
                {gradingSaving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.modalSaveText}>Save Grades</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: CANVAS },
  center: { flex: 1, backgroundColor: CANVAS, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  centerText: { marginTop: 12, fontSize: 14, color: SUBTLE, textAlign: 'center', lineHeight: 20 },
  errorTitle: { fontSize: 18, fontWeight: '700', color: INK },
  retryBtn: { marginTop: 20, backgroundColor: EMERALD, paddingHorizontal: 26, paddingVertical: 12, borderRadius: 999 },
  retryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: EMERALD_SOFT, marginRight: 12 },
  backChevron: { fontSize: 26, lineHeight: 28, color: EMERALD, marginTop: -3 },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: INK },
  headerSub: { fontSize: 12.5, color: SUBTLE, marginTop: 2 },

  filterRow: { flexGrow: 0, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#FFFFFF' },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: '#F1F3F2', marginRight: 8 },
  filterChipActive: { backgroundColor: EMERALD },
  filterChipText: { fontSize: 12.5, fontWeight: '700', color: SUBTLE },
  filterChipTextActive: { color: '#FFFFFF' },

  scroll: { flex: 1 },
  scrollContent: { padding: 16 },

  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: BORDER },
  emptyText: { fontSize: 13.5, color: SUBTLE, lineHeight: 20, textAlign: 'center' },

  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: BORDER, marginBottom: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  flexCol: { flex: 1, paddingRight: 10 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: INK },
  rowSub: { fontSize: 12, color: SUBTLE, marginTop: 3 },

  statusBadge: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, overflow: 'hidden' },
  statusDraft: { color: '#9A6700', backgroundColor: '#FEF3C7' },
  statusPublished: { color: '#166534', backgroundColor: '#DCFCE7' },

  actionsRow: { flexDirection: 'row', gap: 18, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: BORDER, flexWrap: 'wrap' },
  actionLink: { fontSize: 12.5, fontWeight: '700', color: EMERALD },
  deleteLink: { color: DANGER },

  saveBar: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: BORDER },
  addBtn: { backgroundColor: EMERALD, borderRadius: 14, height: 50, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 32, maxHeight: '90%' },
  modalTitle: { fontSize: 17, fontWeight: '800', color: INK, marginBottom: 14 },
  label: { fontSize: 13.5, fontWeight: '700', color: INK, marginTop: 12 },
  input: { marginTop: 8, borderWidth: 1, borderColor: BORDER, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: INK, backgroundColor: '#FAFBFA' },
  inputMultiline: { minHeight: 70, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: BORDER, backgroundColor: '#FAFBFA', marginRight: 8 },
  chipActive: { backgroundColor: EMERALD, borderColor: EMERALD },
  chipText: { fontSize: 13, fontWeight: '600', color: SUBTLE },
  chipTextActive: { color: '#FFFFFF' },

  assignmentList: { marginTop: 8, maxHeight: 140, borderWidth: 1, borderColor: BORDER, borderRadius: 12 },
  assignmentRow: { paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: BORDER },
  assignmentRowActive: { backgroundColor: EMERALD_SOFT },
  assignmentRowText: { fontSize: 13, color: INK },
  assignmentRowTextActive: { color: EMERALD, fontWeight: '700' },

  modalActions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  modalCancel: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F3F2' },
  modalCancelText: { fontSize: 13.5, fontWeight: '700', color: SUBTLE },
  modalSave: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: EMERALD },
  modalSaveText: { fontSize: 13.5, fontWeight: '700', color: '#FFFFFF' },

  rosterList: { maxHeight: 340, marginTop: 8 },
  rosterRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: BORDER, gap: 8 },
  rosterName: { flex: 1, fontSize: 13.5, color: INK },
  marksInput: { width: 64, borderWidth: 1, borderColor: BORDER, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, fontSize: 13.5, color: INK, backgroundColor: '#FAFBFA', textAlign: 'center' },
  absentToggle: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: BORDER },
  absentToggleActive: { backgroundColor: '#FEE2E2', borderColor: DANGER },
  absentToggleText: { fontSize: 11.5, fontWeight: '600', color: SUBTLE },
  absentToggleTextActive: { color: DANGER },
});
