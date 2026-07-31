import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, Modal, ScrollView } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import Svg, { Path, Polyline, Circle } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import {
  fetchAssessmentSubmissions,
  gradeSubmission,
  Assessment,
  AssessmentSubmission,
} from '../../services/assessmentService';
import { Skeleton, SkeletonCircle } from '../../components/Skeleton';
import UserAvatar from '../../components/UserAvatar';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHADOW, GLASS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';

const EMERALD = '#0F9D58';
const EMERALD_SOFT = '#E7F5EC';
const INK = '#1C1C1E';
const SUBTLE = '#8A9099';
const CANVAS = '#F6F7F9';
const AMBER = '#B8860B';
const AMBER_SOFT = '#FBF3DF';
const RED = '#B3261E';
const GLASS_SURFACE = GLASS.fillOnLight;
const GLASS_BORDER = GLASS.borderOnLight;

function IconChevronLeft({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline points="15 5 8 12 15 19" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconCheckCircle({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} />
      <Polyline points="8.5 12 11 14.5 15.5 9.5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconPaperclip({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 12l6-6a3 3 0 1 1 4 4l-8 8a5 5 0 1 1-7-7l7-7" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function rowStatusColor(status: AssessmentSubmission['status']) {
  if (status === 'graded') return EMERALD;
  if (status === 'resubmission_requested') return AMBER;
  return SUBTLE;
}
function rowStatusLabel(t: (key: string, fallback?: string) => string, status: AssessmentSubmission['status']) {
  if (status === 'resubmission_requested') return t('teacher_assessment_grading.resubmit_requested', 'Resubmit requested');
  return status;
}

function RowSkeleton() {
  return (
    <View style={styles.row}>
      <SkeletonCircle size={40} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Skeleton width="55%" height={14} borderRadius={4} />
      </View>
      <Skeleton width={60} height={24} borderRadius={8} />
    </View>
  );
}

// Grading roster for one published assessment: every student who has
// submitted, their attempt/status, and a modal to score + leave feedback
// or send it back for resubmission. Students who haven't submitted at all
// aren't listed here — there's no submission row for them yet — this is
// intentionally submission-centric rather than full-roster, since (unlike
// Gradebook) not every enrolled student necessarily has work in yet.
export default function TeacherAssessmentGradingScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { token } = useAuth();
  const { t } = useLocale();
  const assessmentId: number = route.params?.assessmentId;

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [submissions, setSubmissions] = useState<AssessmentSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [active, setActive] = useState<AssessmentSubmission | null>(null);
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!token || !assessmentId) return;
      if (!opts.silent) setIsLoading(true);
      setError(null);
      try {
        const data = await fetchAssessmentSubmissions(token, assessmentId);
        setAssessment(data.assessment);
        setSubmissions(data.submissions);
      } catch (e: any) {
        setError(e?.message ?? t('teacher_assessment_grading.load_error', 'Could not load submissions.'));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [token, assessmentId, t]
  );

  useFocusEffect(
    useCallback(() => {
      load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [assessmentId])
  );

  const openGrade = (s: AssessmentSubmission) => {
    setActive(s);
    setScore(s.score != null ? String(s.score) : '');
    setFeedback(s.feedback ?? '');
  };

  const submitGrade = async (requestResubmission: boolean) => {
    if (!token || !active) return;
    setIsSaving(true);
    try {
      await gradeSubmission(token, {
        submission_id: active.id,
        score: requestResubmission ? undefined : score.trim() ? Number(score) : null,
        feedback: feedback.trim() || undefined,
        request_resubmission: requestResubmission,
      });
      setActive(null);
      load({ silent: true });
    } catch (e: any) {
      Alert.alert(t('teacher_assessment_grading.save_error', 'Could not save'), e?.message ?? t('common.try_again_full', 'Please try again.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <GlassBackground style={{ flex: 1, backgroundColor: CANVAS }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} style={styles.backButton}>
          <IconChevronLeft color={INK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {assessment?.title ?? t('teacher_assessment_grading.title', 'Grading')}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      {assessment ? (
        <Text style={styles.subHeader}>
          {assessment.section_name} · {assessment.subject_name}
          {assessment.max_score != null ? ` · ${t('teacher_assessment_grading.out_of', 'out of')} ${assessment.max_score}` : ''}
        </Text>
      ) : null}

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {isLoading ? (
        <View style={{ paddingHorizontal: 16 }}>
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </View>
      ) : (
        <FlatList
          data={submissions}
          keyExtractor={(s) => String(s.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
          onRefresh={() => {
            setIsRefreshing(true);
            load({ silent: true });
          }}
          refreshing={isRefreshing}
          ListEmptyComponent={<Text style={styles.emptyText}>{t('teacher_assessment_grading.empty', 'No submissions yet.')}</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => openGrade(item)} activeOpacity={0.85}>
              <UserAvatar name={item.student_name ?? '?'} size={40} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {item.student_name}
                </Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {t('teacher_assessment_grading.attempt', 'Attempt')} {item.attempt_number}
                  {item.attachment_name ? ` · ${t('teacher_assessment_grading.has_attachment', 'has attachment')}` : ''}
                  {item.score != null ? ` · ${item.score} ${t('teacher_assessment_grading.pts', 'pts')}` : ''}
                </Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: rowStatusColor(item.status) + '22' }]}>
                {item.status === 'graded' ? <IconCheckCircle color={EMERALD} size={13} /> : null}
                <Text style={[styles.statusBadgeText, { color: rowStatusColor(item.status) }]}>
                  {rowStatusLabel(t, item.status)}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      <Modal visible={!!active} transparent animationType="fade" onRequestClose={() => setActive(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: '100%' }}>
              <Text style={styles.modalTitle}>{active?.student_name}</Text>
              <Text style={styles.modalSub}>{t('teacher_assessment_grading.attempt', 'Attempt')} {active?.attempt_number}</Text>

              {active?.text_response ? (
                <>
                  <Text style={styles.fieldLabel}>{t('teacher_assessment_grading.response', 'Response')}</Text>
                  <Text style={styles.responseText}>{active.text_response}</Text>
                </>
              ) : null}

              {active?.attachment_name ? (
                <View style={styles.attachmentRow}>
                  <IconPaperclip color={SUBTLE} />
                  <Text style={styles.attachmentText} numberOfLines={1}>
                    {active.attachment_name}
                  </Text>
                </View>
              ) : null}

              <Text style={styles.fieldLabel}>{t('teacher_assessment_grading.score', 'Score')}{assessment?.max_score != null ? ` (${t('teacher_assessment_grading.out_of', 'out of')} ${assessment.max_score})` : ''}</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="e.g. 85"
                placeholderTextColor={SUBTLE}
                value={score}
                onChangeText={setScore}
              />

              <Text style={styles.fieldLabel}>{t('teacher_assessment_grading.feedback', 'Feedback')}</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                multiline
                placeholder={t('teacher_assessment_grading.feedback_placeholder', 'Notes for the student')}
                placeholderTextColor={SUBTLE}
                value={feedback}
                onChangeText={setFeedback}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnGhost]}
                  onPress={() => submitGrade(true)}
                  disabled={isSaving}
                >
                  <Text style={styles.modalBtnGhostText}>{t('teacher_assessment_grading.ask_resubmit', 'Ask to resubmit')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnPrimary]}
                  onPress={() => submitGrade(false)}
                  disabled={isSaving}
                >
                  <Text style={styles.modalBtnPrimaryText}>{t('teacher_assessment_grading.save_grade', 'Save grade')}</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={{ alignSelf: 'center', marginTop: 12 }} onPress={() => setActive(null)}>
                <Text style={{ color: SUBTLE, fontSize: 13 }}>{t('common.cancel', 'Cancel')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 4 },
  backButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: INK, textAlign: 'center' },
  subHeader: { textAlign: 'center', fontSize: 12, color: SUBTLE, marginBottom: 8 },
  errorBanner: { marginHorizontal: 16, marginBottom: 8, padding: 10, borderRadius: 10, backgroundColor: '#FDECEC' },
  errorText: { color: RED, fontSize: 13 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    backgroundColor: GLASS_SURFACE,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    marginBottom: 10,
    ...SHADOW.card,
  },
  rowName: { fontSize: 14, fontWeight: '700', color: INK },
  rowMeta: { fontSize: 11.5, color: SUBTLE, marginTop: 3 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusBadgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  emptyText: { textAlign: 'center', color: SUBTLE, marginTop: 40, fontSize: 13.5 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(17,24,39,0.4)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 20, width: '100%', maxHeight: '88%', ...SHADOW.card },
  modalTitle: { fontSize: 16, fontWeight: '700', color: INK },
  modalSub: { fontSize: 12, color: SUBTLE, marginTop: 2, marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: SUBTLE, marginTop: 10, marginBottom: 6, textTransform: 'uppercase' },
  responseText: { fontSize: 13.5, color: INK, lineHeight: 19, backgroundColor: '#FAFAFB', borderRadius: 10, padding: 10 },
  attachmentRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  attachmentText: { fontSize: 12.5, color: INK },
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
  modalActions: { flexDirection: 'row', marginTop: 16, gap: 8 },
  modalBtn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalBtnGhost: { backgroundColor: AMBER_SOFT },
  modalBtnGhostText: { color: AMBER, fontWeight: '700', fontSize: 13 },
  modalBtnPrimary: { backgroundColor: EMERALD },
  modalBtnPrimaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
});
