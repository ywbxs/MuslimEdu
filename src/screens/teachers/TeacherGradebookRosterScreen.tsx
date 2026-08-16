import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Svg, { Path, Polyline, Circle } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import {
  fetchGradebookRoster,
  submitGradebook,
  GradebookRosterStudent,
  GradebookRecordInput,
} from '../../services/teacherGradebookService';
import { Skeleton, SkeletonCircle } from '../../components/Skeleton';
import UserAvatar from '../../components/UserAvatar';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHADOW, GLASS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';
const EMERALD = '#1FAE64';
const EMERALD_SOFT = '#E5F8F5';
const INK = '#1C1C1E';
const SUBTLE = '#8A9099';
const CANVAS = '#F6F7F9';
const GLASS_SURFACE = GLASS.fillOnLight;
const GLASS_BORDER = GLASS.borderOnLight;

function IconChevronLeft({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline points="15 5 8 12 15 19" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconCheckCircle({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} />
      <Polyline points="8.5 12 11 14.5 15.5 9.5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function StudentRowSkeleton() {
  return (
    <View style={styles.row}>
      <SkeletonCircle size={40} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Skeleton width="55%" height={14} borderRadius={4} />
      </View>
      <Skeleton width={70} height={38} borderRadius={8} />
    </View>
  );
}

export default function TeacherGradebookRosterScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const {
    sectionId,
    subjectId,
    examCategoryId,
    classLabel,
    subjectLabel,
    examCategoryLabel,
  } = route.params ?? {};
  const { token } = useAuth();
  const { t } = useLocale();

  const [students, setStudents] = useState<GradebookRosterStudent[]>([]);
  const [totalMarks, setTotalMarks] = useState<number | null>(null);
  const [marks, setMarks] = useState<Record<number, string>>({});
  const [comments, setComments] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !sectionId) return;
    setIsLoading(true);
    setError(null);
    setSaveMessage(null);
    try {
      const data = await fetchGradebookRoster(token, sectionId, subjectId, examCategoryId);
      setStudents(data.students);
      setTotalMarks(data.total_marks);
      const initialMarks: Record<number, string> = {};
      const initialComments: Record<number, string> = {};
      data.students.forEach((s) => {
        if (s.mark !== null && s.mark !== undefined) initialMarks[s.student_id] = String(s.mark);
        if (s.comment) initialComments[s.student_id] = s.comment;
      });
      setMarks(initialMarks);
      setComments(initialComments);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('teacher_gradebook_roster.load_error', 'Could not load the roster.'));
    } finally {
      setIsLoading(false);
    }
  }, [token, sectionId, subjectId, examCategoryId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const filledCount = useMemo(
    () => Object.values(marks).filter((v) => v !== '' && v !== undefined).length,
    [marks]
  );

  const handleSave = async () => {
    if (!token || !sectionId) return;

    if (totalMarks) {
      const overLimit = Object.entries(marks).find(([, v]) => v !== '' && Number(v) > totalMarks);
      if (overLimit) {
        setError(t('teacher_gradebook_roster.over_limit', 'A mark exceeds the total of {total}. Fix it before saving.').replace('{total}', String(totalMarks)));
        return;
      }
    }

    setIsSaving(true);
    setError(null);
    setSaveMessage(null);
    try {
      const records: GradebookRecordInput[] = students.map((s) => {
        const rawMark = marks[s.student_id];
        const rawComment = comments[s.student_id];
        return {
          student_id: s.student_id,
          mark: rawMark !== undefined && rawMark !== '' ? Number(rawMark) : null,
          comment: rawComment !== undefined ? rawComment : undefined,
        };
      });
      const result = await submitGradebook(token, sectionId, subjectId, examCategoryId, records);
      setSaveMessage(result.message ?? t('teacher_gradebook_roster.saved', 'Grades saved.'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('teacher_gradebook_roster.save_error', 'Could not save grades.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top + 60}
    >
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
          <IconChevronLeft color={INK} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{classLabel ?? t('teacher_gradebook_roster.grades', 'Grades')}</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {subjectLabel ?? ''}{examCategoryLabel ? ` · ${examCategoryLabel}` : ''}
          </Text>
        </View>
        <View style={{ width: 32 }} />
      </View>

      {totalMarks ? (
        <View style={styles.totalBar}>
          <Text style={styles.totalBarText}>{t('teacher_gradebook_roster.out_of', 'Out of')} {totalMarks} {t('teacher_gradebook_roster.marks', 'marks')}</Text>
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.listContent}>
          <StudentRowSkeleton />
          <StudentRowSkeleton />
          <StudentRowSkeleton />
          <StudentRowSkeleton />
        </View>
      ) : (
        <FlatList
          data={students}
          keyExtractor={(item) => String(item.student_id)}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            !error ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>{t('teacher_gradebook_roster.empty_title', 'No students enrolled')}</Text>
                <Text style={styles.emptyDesc}>{t('teacher_gradebook_roster.empty_desc', 'This section has no enrolled students for the running session.')}</Text>
              </View>
            ) : null
          }
          ListHeaderComponent={
            <>
              {error ? (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}
              {saveMessage ? (
                <View style={styles.successBanner}>
                  <IconCheckCircle color={EMERALD} />
                  <Text style={styles.successText}>{saveMessage}</Text>
                </View>
              ) : null}
              {students.length > 0 ? (
                <Text style={styles.progressText}>{filledCount} {t('teacher_gradebook_roster.of', 'of')} {students.length} {t('teacher_gradebook_roster.entered', 'entered')}</Text>
              ) : null}
              {students.length > 0 ? (
                <Text style={styles.noteText}>
                  {t('teacher_gradebook_roster.shared_comment_note', "The comment field is shared across every subject for this exam - leave it blank to keep whatever another subject teacher already wrote.")}
                </Text>
              ) : null}
            </>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <UserAvatar name={item.student_name} photo={item.photo} size={40} dotColor={null} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.rowName} numberOfLines={1}>{item.student_name}</Text>
                <TextInput
                  style={styles.commentInput}
                  placeholder={t('teacher_gradebook_roster.comment_placeholder', 'Comment (optional, shared)')}
                  placeholderTextColor={SUBTLE}
                  value={comments[item.student_id] ?? ''}
                  onChangeText={(text) => setComments((prev) => ({ ...prev, [item.student_id]: text }))}
                  maxLength={500}
                />
              </View>
              <TextInput
                style={styles.markInput}
                placeholder="-"
                placeholderTextColor={SUBTLE}
                keyboardType="numeric"
                value={marks[item.student_id] ?? ''}
                onChangeText={(text) =>
                  setMarks((prev) => ({ ...prev, [item.student_id]: text.replace(/[^0-9.]/g, '') }))
                }
              />
            </View>
          )}
        />
      )}

      {!isLoading && students.length > 0 ? (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.saveButton} activeOpacity={0.85} onPress={handleSave} disabled={isSaving}>
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>{t('teacher_gradebook_roster.save_grades', 'Save Grades')}</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: GLASS_SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: GLASS_BORDER,
  },
  backButton: { width: 32 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: INK, textAlign: 'center' },
  headerSubtitle: { fontSize: 12, color: SUBTLE, textAlign: 'center', marginTop: 2 },

  totalBar: {
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: GLASS_SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: GLASS_BORDER,
  },
  totalBarText: { fontSize: 13, fontWeight: '700', color: EMERALD },

  listContent: { padding: 16, paddingBottom: 100 },
  progressText: { fontSize: 12.5, color: SUBTLE, marginBottom: 4, fontWeight: '600' },
  noteText: { fontSize: 11.5, color: SUBTLE, marginBottom: 10, lineHeight: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GLASS_SURFACE,
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
  ...SHADOW.level1,
  },
  rowName: { fontSize: 13.5, fontWeight: '700', color: INK, marginBottom: 4 },
  commentInput: {
    fontSize: 12,
    color: INK,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: CANVAS,
    borderRadius: 8,
  },
  markInput: {
    width: 64,
    height: 40,
    borderRadius: 8,
    backgroundColor: EMERALD_SOFT,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: EMERALD,
    marginLeft: 8,
  },

  emptyWrap: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: INK, marginBottom: 8 },
  emptyDesc: { fontSize: 13.5, color: SUBTLE, textAlign: 'center', lineHeight: 19 },
  errorBanner: { backgroundColor: '#FCEDED', borderRadius: 12, padding: 14, marginBottom: 12 },
  errorText: { color: '#E5484D', fontSize: 13.5, textAlign: 'center' },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: EMERALD_SOFT,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  successText: { color: EMERALD, fontSize: 13.5, fontWeight: '700' },

  footer: {
    padding: 16,
    paddingBottom: 28,
    backgroundColor: GLASS_SURFACE,
    borderTopWidth: 1,
    borderTopColor: GLASS_BORDER,
  },
  saveButton: {
    backgroundColor: EMERALD,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
