import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import KeyboardAwareModal from '../../components/KeyboardAwareModal';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { EMERALD, EMERALD_SOFT, INK, SUBTLE } from '../dashboards/DashboardShell';
import { COLORS } from '../../theme/glass';
import {
  MemorizationDraft,
  MemorizationRecord,
  MemorizationStatus,
  QualityRating,
  deleteMemorizationRecord,
  fetchMemorizationRecords,
  saveMemorizationRecord,
} from '../../services/memorizationService';
import {
  RiskLevel,
  TeacherStudentProgressSummary,
  fetchTeacherStudentProgressSummary,
} from '../../services/teacherStudentProgressService';
import { ClassSection, ClassStudent, fetchAllSections, fetchClassStudents, fetchMyClasses } from '../../services/teacherClassService';
import { fetchClassProgressCsv, fetchStudentProgressCsv } from '../../services/reportExportService';
import { isQuranTrackingSchoolUser } from '../../utils/orphanSchool';

/**
 * M4 progress & risk indicators + memorization tracking. Combines two new
 * backend pieces this round: StudentProgressController (read-only
 * aggregation across attendance/grades/exams/behavior/memorization, with
 * a disclosed simple risk score) and MemorizationController (Quran
 * memorization progress, genuinely new — nothing like it existed before).
 *
 * Deliberately separate from the student's own progress view
 * (studentProgressService.ts / student_progress_summary) — this screen
 * calls the teacher/admin-only summary endpoint instead, which required a
 * different route name to avoid colliding with the existing one.
 *
 * Never executed against a live backend.
 */

const BORDER = '#E4E9E5';
const CANVAS = '#F5F7F6';
const DANGER = '#BA1A1A';
const ADMIN_ROLES = [1, 2];

const STATUS_FALLBACKS: Record<MemorizationStatus, string> = {
  assigned: 'Assigned',
  in_progress: 'In Progress',
  memorized: 'Memorized',
  needs_revision: 'Needs Revision',
};

const QUALITY_FALLBACKS: Record<QualityRating, string> = {
  needs_improvement: 'Needs Improvement',
  fair: 'Fair',
  good: 'Good',
  excellent: 'Excellent',
};

const RISK_COLORS: Record<RiskLevel, { color: string; bg: string }> = {
  low: { color: '#166534', bg: '#DCFCE7' },
  moderate: { color: '#9A6700', bg: '#FEF3C7' },
  high: { color: DANGER, bg: '#FEE2E2' },
};

const RISK_LEVEL_FALLBACKS: Record<RiskLevel, string> = {
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
};

export default function StudentProgressScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  // Quran memorization tracking is Markaz-only (per admin request) - this
  // is the backstop, since a teacher can still reach this screen via
  // TeacherDashboard's generic "Student Progress" tile regardless of
  // school type, not just through AdminDashboard's Markaz-gated tile.
  const isQuranTrackingSchool = isQuranTrackingSchoolUser(user);
  const { t } = useLocale();
  const isAdmin = !!user && ADMIN_ROLES.includes(user.role_id);
  const statusLabel = (status: MemorizationStatus) =>
    t(`student_progress.status_${status}`, STATUS_FALLBACKS[status]);
  const qualityLabel = (quality: QualityRating) =>
    t(`student_progress.quality_${quality}`, QUALITY_FALLBACKS[quality]);
  const riskLevelLabel = (level: RiskLevel) =>
    t(`student_progress.risk_${level}`, RISK_LEVEL_FALLBACKS[level]).toUpperCase();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sections, setSections] = useState<{ id: number; name: string }[]>([]);
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [roster, setRoster] = useState<ClassStudent[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [studentId, setStudentId] = useState<number | null>(null);

  const [summary, setSummary] = useState<TeacherStudentProgressSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [memRecords, setMemRecords] = useState<MemorizationRecord[]>([]);
  const [memLoading, setMemLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<MemorizationRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [fSurahNumber, setFSurahNumber] = useState('');
  const [fSurahName, setFSurahName] = useState('');
  const [fJuz, setFJuz] = useState('');
  const [fStatus, setFStatus] = useState<MemorizationStatus>('in_progress');
  const [fQuality, setFQuality] = useState<QualityRating | null>(null);
  const [fDate, setFDate] = useState(new Date().toISOString().slice(0, 10));
  const [fNotes, setFNotes] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const secs = isAdmin
        ? (await fetchAllSections(token)).map((r) => ({ id: r.id, name: r.name }))
        : (await fetchMyClasses(token)).map((r: ClassSection) => ({ id: r.section_id, name: r.section_name }));
      setSections(secs);
    } catch (e: any) {
      setError(e?.message ?? t('student_progress.load_sections_error', 'Could not load sections.'));
    } finally {
      setLoading(false);
    }
  }, [token, isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  const onSelectSection = async (id: number) => {
    if (!token) return;
    setSectionId(id);
    setStudentId(null);
    setSummary(null);
    setMemRecords([]);
    setRosterLoading(true);
    try {
      const r = await fetchClassStudents(token, id);
      setRoster(r.students);
    } catch (e: any) {
      Alert.alert(t('student_progress.load_students_error', "Couldn't load students"), e?.message ?? t('common.try_again_full', 'Please try again.'));
      setRoster([]);
    } finally {
      setRosterLoading(false);
    }
  };

  const onSelectStudent = async (id: number) => {
    if (!token) return;
    setStudentId(id);
    setSummaryLoading(true);
    setSummaryError(null);
    setMemLoading(true);
    try {
      const [s, records] = await Promise.all([
        fetchTeacherStudentProgressSummary(token, id),
        fetchMemorizationRecords(token, { studentId: id }),
      ]);
      setSummary(s);
      setMemRecords(records);
    } catch (e: any) {
      setSummaryError(e?.message ?? t('student_progress.load_student_error', 'Could not load this student.'));
    } finally {
      setSummaryLoading(false);
      setMemLoading(false);
    }
  };

  const openNewRecord = () => {
    setEditing(null);
    setFSurahNumber('');
    setFSurahName('');
    setFJuz('');
    setFStatus('in_progress');
    setFQuality(null);
    setFDate(new Date().toISOString().slice(0, 10));
    setFNotes('');
    setFormVisible(true);
  };

  const openEditRecord = (r: MemorizationRecord) => {
    setEditing(r);
    setFSurahNumber(String(r.surah_number));
    setFSurahName(r.surah_name);
    setFJuz(r.juz_number != null ? String(r.juz_number) : '');
    setFStatus(r.status);
    setFQuality(r.quality_rating);
    setFDate(r.recorded_date.slice(0, 10));
    setFNotes(r.notes ?? '');
    setFormVisible(true);
  };

  const onSaveRecord = async () => {
    if (!token || !studentId) return;
    if (!fSurahNumber.trim() || !fSurahName.trim()) {
      Alert.alert(
        t('student_progress.missing_info_title', 'Missing info'),
        t('student_progress.missing_info_message', 'Surah number and name are required.'),
      );
      return;
    }
    setSaving(true);
    try {
      const draft: MemorizationDraft = {
        id: editing?.id,
        student_id: studentId,
        section_id: sectionId,
        surah_number: Number(fSurahNumber.trim()),
        surah_name: fSurahName.trim(),
        juz_number: fJuz.trim() ? Number(fJuz.trim()) : null,
        status: fStatus,
        quality_rating: fQuality,
        recorded_date: fDate.trim(),
        notes: fNotes.trim() || null,
      };
      const saved = await saveMemorizationRecord(token, draft);
      setMemRecords((prev) => {
        const others = prev.filter((x) => x.id !== saved.id);
        return [saved, ...others];
      });
      setFormVisible(false);
    } catch (e: any) {
      Alert.alert(t('student_progress.save_error', 'Could not save'), e?.message ?? t('common.try_again_full', 'Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteRecord = (r: MemorizationRecord) => {
    Alert.alert(
      t('student_progress.delete_confirm_title', 'Delete this record?'),
      t('student_progress.delete_confirm_message', '"{surah}" will be removed.').replace('{surah}', r.surah_name),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('common.delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            if (!token) return;
            try {
              await deleteMemorizationRecord(token, r.id);
              setMemRecords((prev) => prev.filter((x) => x.id !== r.id));
            } catch (e: any) {
              Alert.alert(t('student_progress.delete_error', 'Could not delete'), e?.message ?? t('common.try_again_full', 'Please try again.'));
            }
          },
        },
      ],
    );
  };

  const onExportStudentReport = async () => {
    if (!token || !studentId) return;
    setExporting(true);
    try {
      const report = await fetchStudentProgressCsv(token, studentId);
      await Share.share({ title: report.filename, message: report.csv });
    } catch (e: any) {
      Alert.alert(t('student_progress.export_error', 'Could not export report'), e?.message ?? t('common.try_again_full', 'Please try again.'));
    } finally {
      setExporting(false);
    }
  };

  const onExportClassReport = async () => {
    if (!token || !sectionId) return;
    setExporting(true);
    try {
      const report = await fetchClassProgressCsv(token, sectionId);
      await Share.share({ title: report.filename, message: report.csv });
    } catch (e: any) {
      Alert.alert(t('student_progress.export_error', 'Could not export report'), e?.message ?? t('common.try_again_full', 'Please try again.'));
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={EMERALD} size="large" />
        <Text style={styles.centerText}>{t('common.loading', 'Loading…')}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>{t('student_progress.error_title', "Couldn't load this")}</Text>
        <Text style={styles.centerText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={load}>
          <Text style={styles.retryText}>{t('common.retry', 'Retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backChevron}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>{t('student_progress.header_title', 'Student Progress')}</Text>
          <Text style={styles.headerSub}>{t('student_progress.header_sub', 'Attendance, grades, behavior, and memorization in one view')}</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {sections.map((s) => (
          <TouchableOpacity
            key={s.id}
            style={[styles.filterChip, sectionId === s.id && styles.filterChipActive]}
            onPress={() => onSelectSection(s.id)}
          >
            <Text style={[styles.filterChipText, sectionId === s.id && styles.filterChipTextActive]}>{s.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {sectionId && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {rosterLoading ? (
            <ActivityIndicator color={EMERALD} style={{ marginLeft: 16 }} />
          ) : (
            roster.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[styles.filterChip, studentId === s.id && styles.filterChipActive]}
                onPress={() => onSelectStudent(s.id)}
              >
                <Text style={[styles.filterChipText, studentId === s.id && styles.filterChipTextActive]}>{s.name}</Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
      {sectionId && (
        <TouchableOpacity onPress={onExportClassReport} disabled={exporting} style={styles.exportClassRow}>
          <Text style={styles.actionLink}>{exporting ? t('student_progress.preparing', 'Preparing…') : t('student_progress.export_class_report', '⬇ Export class report (CSV)')}</Text>
        </TouchableOpacity>
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {!studentId ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{t('student_progress.empty_pick', 'Pick a section, then a student, to see their progress.')}</Text>
          </View>
        ) : summaryLoading ? (
          <ActivityIndicator color={EMERALD} style={{ marginTop: 20 }} />
        ) : summaryError ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{summaryError}</Text>
          </View>
        ) : summary ? (
          <>
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.rowTitle}>{summary.student.name}</Text>
                <Text style={[styles.riskBadge, { color: RISK_COLORS[summary.risk.level].color, backgroundColor: RISK_COLORS[summary.risk.level].bg }]}>
                  {riskLevelLabel(summary.risk.level)} {t('student_progress.risk_suffix', 'RISK')}
                </Text>
              </View>
              <Text style={styles.metricRow}>
                {t('student_progress.metric_attendance', 'Attendance')}: {summary.attendance.rate_percent != null ? `${summary.attendance.rate_percent}%` : t('student_progress.no_data', 'No data')}
                {' '}({summary.attendance.days_recorded} {t('student_progress.days', 'days')}, {t('student_progress.last_n_days', 'last {n}').replace('{n}', String(summary.lookback_days))})
              </Text>
              <Text style={styles.metricRow}>
                {t('student_progress.metric_assessment_average', 'Assessment average')}: {summary.grades.assessment_average_percent != null ? `${summary.grades.assessment_average_percent}%` : t('student_progress.no_data', 'No data')}
                {' '}({summary.grades.graded_assessment_count} {t('student_progress.graded', 'graded')})
              </Text>
              <Text style={styles.metricRow}>
                {t('student_progress.metric_exam_average', 'Exam average')}: {summary.grades.exam_average_percent != null ? `${summary.grades.exam_average_percent}%` : t('student_progress.no_data', 'No data')}
                {' '}({summary.grades.graded_exam_count} {t('student_progress.graded', 'graded')})
              </Text>
              <Text style={styles.metricRow}>
                {t('student_progress.metric_behavior_incidents', 'Behavior incidents (last {n} days)').replace('{n}', String(summary.lookback_days))}: {summary.behavior.incidents_last_90_days}
                {summary.behavior.major_incidents_last_90_days > 0 ? ` (${summary.behavior.major_incidents_last_90_days} ${t('student_progress.major', 'major')})` : ''}
              </Text>
              {isQuranTrackingSchool ? (
                <Text style={styles.metricRow}>
                  {t('student_progress.metric_memorization', 'Memorization')}: {summary.memorization.memorized_count} {t('student_progress.memorized', 'memorized')}, {summary.memorization.in_progress_count} {t('student_progress.in_progress', 'in progress')}
                </Text>
              ) : null}
              <TouchableOpacity onPress={onExportStudentReport} disabled={exporting} style={styles.exportStudentRow}>
                <Text style={styles.actionLink}>{exporting ? t('student_progress.preparing', 'Preparing…') : t('student_progress.export_student_report', '⬇ Export this report (CSV)')}</Text>
              </TouchableOpacity>
            </View>

            {isQuranTrackingSchool ? (
              <>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionHeader}>{t('student_progress.memorization_records', 'Memorization Records')}</Text>
                  <TouchableOpacity onPress={openNewRecord}>
                    <Text style={styles.actionLink}>{t('student_progress.add', '+ Add')}</Text>
                  </TouchableOpacity>
                </View>

                {memLoading ? (
                  <ActivityIndicator color={EMERALD} />
                ) : memRecords.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyText}>{t('student_progress.empty_memorization', 'No memorization records yet for this student.')}</Text>
                  </View>
                ) : (
                  memRecords.map((r) => (
                    <View key={r.id} style={styles.card}>
                      <View style={styles.rowBetween}>
                        <Text style={styles.rowTitle}>
                          {r.surah_name} {r.juz_number ? `(${t('student_progress.juz', 'Juz')} ${r.juz_number})` : ''}
                        </Text>
                        <Text style={styles.statusBadge}>{statusLabel(r.status)}</Text>
                      </View>
                      <Text style={styles.rowSub}>
                        {r.recorded_date.slice(0, 10)}
                        {r.quality_rating ? ` · ${qualityLabel(r.quality_rating)}` : ''}
                      </Text>
                      {!!r.notes && <Text style={styles.metricRow}>{r.notes}</Text>}
                      <View style={styles.actionsRow}>
                        <TouchableOpacity onPress={() => openEditRecord(r)}>
                          <Text style={styles.actionLink}>{t('common.edit', 'Edit')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => confirmDeleteRecord(r)}>
                          <Text style={[styles.actionLink, styles.deleteLink]}>{t('common.delete', 'Delete')}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      <KeyboardAwareModal visible={formVisible} animationType="slide" transparent onRequestClose={() => setFormVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>{editing ? t('student_progress.edit_record', 'Edit Record') : t('student_progress.new_record', 'New Memorization Record')}</Text>

              <Text style={styles.label}>{t('student_progress.surah_number_label', 'Surah number (1-114)')}</Text>
              <TextInput style={styles.input} value={fSurahNumber} onChangeText={setFSurahNumber} keyboardType="numeric" />

              <Text style={styles.label}>{t('student_progress.surah_name_label', 'Surah name')}</Text>
              <TextInput style={styles.input} value={fSurahName} onChangeText={setFSurahName} placeholder={t('student_progress.surah_name_placeholder', 'e.g. Al-Fatiha')} />

              <Text style={styles.label}>{t('student_progress.juz_label', 'Juz (optional, 1-30)')}</Text>
              <TextInput style={styles.input} value={fJuz} onChangeText={setFJuz} keyboardType="numeric" />

              <Text style={styles.label}>{t('student_progress.status_label', 'Status')}</Text>
              <View style={styles.chipRow}>
                {(Object.keys(STATUS_FALLBACKS) as MemorizationStatus[]).map((s) => (
                  <TouchableOpacity key={s} style={[styles.chip, fStatus === s && styles.chipActive]} onPress={() => setFStatus(s)}>
                    <Text style={[styles.chipText, fStatus === s && styles.chipTextActive]}>{statusLabel(s)}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>{t('student_progress.quality_label', 'Quality (optional)')}</Text>
              <View style={styles.chipRow}>
                {(Object.keys(QUALITY_FALLBACKS) as QualityRating[]).map((q) => (
                  <TouchableOpacity
                    key={q}
                    style={[styles.chip, fQuality === q && styles.chipActive]}
                    onPress={() => setFQuality(fQuality === q ? null : q)}
                  >
                    <Text style={[styles.chipText, fQuality === q && styles.chipTextActive]}>{qualityLabel(q)}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>{t('student_progress.date_label', 'Date (YYYY-MM-DD)')}</Text>
              <TextInput style={styles.input} value={fDate} onChangeText={setFDate} />

              <Text style={styles.label}>{t('student_progress.notes_label', 'Notes (optional)')}</Text>
              <TextInput style={[styles.input, styles.inputMultiline]} value={fNotes} onChangeText={setFNotes} multiline />

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancel} onPress={() => setFormVisible(false)} disabled={saving}>
                  <Text style={styles.modalCancelText}>{t('common.cancel', 'Cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalSave} onPress={onSaveRecord} disabled={saving}>
                  {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.modalSaveText}>{t('common.save', 'Save')}</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAwareModal>
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

  emptyCard: { backgroundColor: 'transparent', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: COLORS.border },
  emptyText: { fontSize: 13.5, color: SUBTLE, lineHeight: 20, textAlign: 'center' },

  card: { backgroundColor: 'transparent', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowTitle: { fontSize: 15, fontWeight: '700', color: INK, flex: 1, paddingRight: 10 },
  rowSub: { fontSize: 12, color: SUBTLE, marginTop: 3 },
  metricRow: { fontSize: 13, color: INK, marginTop: 6, lineHeight: 18 },

  riskBadge: { fontSize: 11, fontWeight: '800', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, overflow: 'hidden' },
  statusBadge: { fontSize: 11, fontWeight: '700', color: EMERALD, backgroundColor: EMERALD_SOFT, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, overflow: 'hidden' },

  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 10 },
  sectionHeader: { fontSize: 15, fontWeight: '800', color: INK },

  actionsRow: { flexDirection: 'row', gap: 18, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: BORDER },
  actionLink: { fontSize: 12.5, fontWeight: '700', color: EMERALD },
  deleteLink: { color: DANGER },
  exportClassRow: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#FFFFFF' },
  exportStudentRow: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: BORDER },

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
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  modalCancel: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F3F2' },
  modalCancelText: { fontSize: 14.5, fontWeight: '700', color: SUBTLE },
  modalSave: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: EMERALD },
  modalSaveText: { fontSize: 14.5, fontWeight: '700', color: '#FFFFFF' },
});
