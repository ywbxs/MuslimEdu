import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, ScrollView, Linking } from 'react-native';
import KeyboardAwareModal from '../../components/KeyboardAwareModal';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ChevronLeft, Paperclip } from 'lucide-react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { fetchStudentAssessments, submitAssessmentWork, Assessment } from '../../services/assessmentService';
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
  return <ChevronLeft size={size} color={color} strokeWidth={2.4} />;
}
function IconPaperclip({ color, size = 14 }: { color: string; size?: number }) {
  return <Paperclip size={size} color={color} strokeWidth={1.8} />;
}

function statusInfo(t: (key: string, fallback?: string) => string, a: Assessment): { label: string; color: string } {
  const s = a.my_submission;
  if (!s) return a.is_overdue ? { label: t('student_assessments.overdue', 'Overdue'), color: RED } : { label: t('student_assessments.not_started', 'Not started'), color: SUBTLE };
  if (s.status === 'graded') return { label: `${t('student_assessments.graded', 'Graded')} · ${s.score ?? '—'}${a.max_score != null ? `/${a.max_score}` : ''}`, color: EMERALD };
  if (s.status === 'resubmission_requested') return { label: t('student_assessments.resubmit_requested', 'Resubmit requested'), color: AMBER };
  return { label: t('student_assessments.submitted', 'Submitted'), color: EMERALD };
}

function CardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton width="60%" height={14} borderRadius={4} />
      <Skeleton width="40%" height={11} borderRadius={4} style={{ marginTop: 10 }} />
    </View>
  );
}

// Student's assigned work for their current section — every published
// assessment, each annotated with the student's own submission (if any),
// with a modal to submit or resubmit. Spec §6 Student Portal's half of
// "receive submissions" — the first student-facing write path in this
// Teacher-Portal-write-parity family of features.
export default function StudentAssessmentsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();
  const { t } = useLocale();

  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [active, setActive] = useState<Assessment | null>(null);
  const [textResponse, setTextResponse] = useState('');
  const [attachment, setAttachment] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!token) return;
      if (!opts.silent) setIsLoading(true);
      setError(null);
      try {
        const list = await fetchStudentAssessments(token);
        setAssessments(list);
      } catch (e: any) {
        setError(e?.message ?? t('student_assessments.load_error', 'Could not load your assignments.'));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [token, t]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openSubmit = (a: Assessment) => {
    setActive(a);
    setTextResponse(a.my_submission?.text_response ?? '');
    setAttachment(null);
  };

  const pickAttachment = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1, quality: 0.8 });
    if (result.didCancel || result.errorCode || !result.assets?.[0]?.uri) return;
    const asset = result.assets[0];
    setAttachment({ uri: asset.uri as string, name: asset.fileName ?? 'attachment.jpg', type: asset.type ?? 'image/jpeg' });
  };

  const submit = async () => {
    if (!token || !active) return;
    if (!textResponse.trim() && !attachment) {
      Alert.alert(t('student_assessments.nothing_to_submit_title', 'Nothing to submit'), t('student_assessments.nothing_to_submit_message', 'Write a response or attach a file first.'));
      return;
    }
    setIsSubmitting(true);
    try {
      await submitAssessmentWork(token, {
        assessment_id: active.id,
        text_response: textResponse.trim() || undefined,
        attachment,
      });
      setActive(null);
      load({ silent: true });
    } catch (e: any) {
      Alert.alert(t('student_assessments.submit_error', 'Could not submit'), e?.message ?? t('common.try_again_full', 'Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = (a: Assessment) => {
    const s = a.my_submission;
    if (!s) return true;
    if (s.status === 'resubmission_requested') return true;
    if (s.status === 'graded') return a.allow_resubmission;
    return true; // already-submitted, not-yet-graded — resubmitting just updates it
  };

  return (
    <GlassBackground style={{ flex: 1, backgroundColor: CANVAS }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} style={styles.backButton}>
          <IconChevronLeft color={INK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('student_assessments.title', 'Assignments')}</Text>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {isLoading ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <CardSkeleton />
          <CardSkeleton />
        </View>
      ) : (
        <FlatList
          data={assessments}
          keyExtractor={(a) => String(a.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
          onRefresh={() => {
            setIsRefreshing(true);
            load({ silent: true });
          }}
          refreshing={isRefreshing}
          ListEmptyComponent={<Text style={styles.emptyText}>{t('student_assessments.empty', 'Nothing assigned right now.')}</Text>}
          renderItem={({ item }) => {
            const info = statusInfo(t, item);
            return (
              <TouchableOpacity style={styles.card} onPress={() => openSubmit(item)} activeOpacity={0.85}>
                <View style={styles.cardTopRow}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: info.color + '22' }]}>
                    <Text style={[styles.statusBadgeText, { color: info.color }]}>{info.label}</Text>
                  </View>
                </View>
                <Text style={styles.cardMeta}>
                  {item.subject_name} · {item.type}
                  {item.due_at ? ` · ${t('student_assessments.due', 'due')} ${item.due_at.slice(0, 10)}` : ''}
                </Text>
                {item.my_submission?.feedback ? (
                  <Text style={styles.feedbackNote} numberOfLines={2}>
                    {t('student_assessments.feedback', 'Feedback')}: {item.my_submission.feedback}
                  </Text>
                ) : null}
                {item.attachment_url ? (
                  <TouchableOpacity
                    style={styles.attachmentRow}
                    onPress={() => Linking.openURL(item.attachment_url as string)}
                  >
                    <IconPaperclip color={EMERALD} />
                    <Text style={styles.attachmentText} numberOfLines={1}>
                      {item.attachment_name ?? t('student_assessments.prompt_attachment', 'Prompt attachment')}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
            );
          }}
        />
      )}

      <KeyboardAwareModal visible={!!active} transparent animationType="fade" onRequestClose={() => setActive(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: '100%' }}>
              <Text style={styles.modalTitle}>{active?.title}</Text>
              {active?.instructions ? <Text style={styles.instructions}>{active.instructions}</Text> : null}

              {active && !canSubmit(active) ? (
                <Text style={{ color: RED, fontSize: 12.5, marginTop: 10 }}>
                  {t('student_assessments.graded_locked', "This has already been graded and can't be resubmitted.")}
                </Text>
              ) : (
                <>
                  <Text style={styles.fieldLabel}>{t('student_assessments.your_response', 'Your response')}</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    multiline
                    placeholder={t('student_assessments.response_placeholder', 'Type your answer here')}
                    placeholderTextColor={SUBTLE}
                    value={textResponse}
                    onChangeText={setTextResponse}
                  />

                  {attachment ? (
                    <View style={styles.attachmentPicked}>
                      <Text style={styles.attachmentPickedText} numberOfLines={1}>
                        {attachment.name}
                      </Text>
                      <TouchableOpacity onPress={() => setAttachment(null)}>
                        <Text style={{ color: RED, fontSize: 12 }}>{t('student_assessments.remove', 'Remove')}</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.attachButton} onPress={pickAttachment}>
                      <Text style={styles.attachButtonText}>{t('student_assessments.attach_file', 'Attach a file')}</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.modalBtn, styles.modalBtnPrimary, { marginTop: 18 }]}
                    onPress={submit}
                    disabled={isSubmitting}
                  >
                    <Text style={styles.modalBtnPrimaryText}>
                      {active?.my_submission ? t('student_assessments.resubmit', 'Resubmit') : t('student_assessments.submit', 'Submit')}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity style={{ alignSelf: 'center', marginTop: 14 }} onPress={() => setActive(null)}>
                <Text style={{ color: SUBTLE, fontSize: 13 }}>{t('common.close', 'Close')}</Text>
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
  backButton: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: INK, marginLeft: 8 },
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
  statusBadgeText: { fontSize: 10.5, fontWeight: '700' },
  cardMeta: { fontSize: 12, color: SUBTLE, marginTop: 6 },
  feedbackNote: { fontSize: 12, color: AMBER, marginTop: 6, fontStyle: 'italic' },
  emptyText: { textAlign: 'center', color: SUBTLE, marginTop: 40, fontSize: 13.5 },
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: EMERALD_SOFT,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    maxWidth: '100%',
  },
  attachmentText: { fontSize: 12.5, color: EMERALD, fontWeight: '600' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(17,24,39,0.4)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 20, width: '100%', maxHeight: '88%', ...SHADOW.card },
  modalTitle: { fontSize: 16, fontWeight: '700', color: INK },
  instructions: { fontSize: 13, color: SUBTLE, marginTop: 6, lineHeight: 18 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: SUBTLE, marginTop: 14, marginBottom: 6, textTransform: 'uppercase' },
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
  textArea: { minHeight: 90, textAlignVertical: 'top' },
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
  modalBtn: { borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalBtnPrimary: { backgroundColor: EMERALD },
  modalBtnPrimaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
});
