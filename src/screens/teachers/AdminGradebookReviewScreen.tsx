import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Polyline } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { fetchClasses, fetchSections, ClassOption, SectionOption } from '../../services/adminService';
import {
  fetchAdminGradebookExamCategories,
  fetchAdminGradebookReview,
  ExamCategoryOption,
  AdminGradebookStudentRow,
} from '../../services/teacherGradebookService';
import { Skeleton } from '../../components/Skeleton';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHADOW, GLASS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';
const EMERALD = '#0F9D58';
const EMERALD_SOFT = '#E7F5EC';
const INK = '#1C1C1E';
const SUBTLE = '#8A9099';
const CANVAS = '#F6F7F9';
const GLASS_SURFACE = GLASS.fillOnLight;
const GLASS_BORDER = GLASS.borderOnLight;

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
        {options.length === 0 ? <Text style={styles.emptyPickerText}>Nothing available yet.</Text> : null}
      </View>
    </View>
  );
}

// Admin's read-only counterpart to the teacher's grade-entry screens: pick
// class -> section -> exam category, then see every student's mark across
// every subject for that exam, exactly as teachers have entered it so far.
export default function AdminGradebookReviewScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();

  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [examCategories, setExamCategories] = useState<ExamCategoryOption[]>([]);

  const [classId, setClassId] = useState<number | null>(null);
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [examCategoryId, setExamCategoryId] = useState<number | null>(null);

  const [students, setStudents] = useState<AdminGradebookStudentRow[]>([]);
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const [isLoadingSections, setIsLoadingSections] = useState(false);
  const [isLoadingReview, setIsLoadingReview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setIsLoadingFilters(true);
    Promise.all([fetchClasses(token), fetchAdminGradebookExamCategories(token)])
      .then(([classList, examList]) => {
        setClasses(classList);
        setExamCategories(examList);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load filters.'))
      .finally(() => setIsLoadingFilters(false));
  }, [token]);

  const onSelectClass = useCallback(
    (id: number) => {
      setClassId(id);
      setSectionId(null);
      setStudents([]);
      if (!token) return;
      setIsLoadingSections(true);
      fetchSections(token, String(id))
        .then(setSections)
        .catch((err) => setError(err instanceof Error ? err.message : 'Could not load sections.'))
        .finally(() => setIsLoadingSections(false));
    },
    [token]
  );

  const loadReview = useCallback(() => {
    if (!token || !classId || !sectionId || !examCategoryId) return;
    setIsLoadingReview(true);
    setError(null);
    fetchAdminGradebookReview(token, classId, sectionId, examCategoryId)
      .then((data) => setStudents(data.students))
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load grades.'))
      .finally(() => setIsLoadingReview(false));
  }, [token, classId, sectionId, examCategoryId]);

  useEffect(() => {
    loadReview();
  }, [loadReview]);

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
          <IconChevronLeft color={INK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gradebook Review</Text>
        <View style={{ width: 32 }} />
      </View>

      <FlatList
        data={students}
        keyExtractor={(item) => String(item.student_id)}
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
                <Picker label="Class" options={classes} selectedId={classId} onSelect={onSelectClass} />
                {classId ? (
                  isLoadingSections ? (
                    <Skeleton width="100%" height={40} borderRadius={12} style={{ marginTop: 8 }} />
                  ) : (
                    <Picker label="Section" options={sections} selectedId={sectionId} onSelect={setSectionId} />
                  )
                ) : null}
                <Picker
                  label="Exam"
                  options={examCategories}
                  selectedId={examCategoryId}
                  onSelect={setExamCategoryId}
                />
              </>
            )}
            {isLoadingReview ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <ActivityIndicator color={EMERALD} />
              </View>
            ) : null}
            {!isLoadingReview && classId && sectionId && examCategoryId && students.length === 0 && !error ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>No grades entered yet</Text>
                <Text style={styles.emptyDesc}>Nothing has been submitted for this class/section/exam so far.</Text>
              </View>
            ) : null}
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.studentCard}>
            <Text style={styles.studentName}>{item.student_name}</Text>
            {item.comment ? <Text style={styles.studentComment}>{item.comment}</Text> : null}
            {item.subjects.map((subj) => (
              <View key={subj.subject_id} style={styles.subjectRow}>
                <Text style={styles.subjectName}>{subj.subject_name}</Text>
                <Text style={[styles.subjectMark, subj.mark === null ? styles.subjectMarkEmpty : null]}>
                  {subj.mark === null ? 'Not entered' : `${subj.mark}${subj.total_marks ? ` / ${subj.total_marks}` : ''}`}
                </Text>
              </View>
            ))}
          </View>
        )}
      />
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

  studentCard: {
    backgroundColor: GLASS_SURFACE,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    ...SHADOW.level1,
  },
  studentName: { fontSize: 14.5, fontWeight: '700', color: INK, marginBottom: 4 },
  studentComment: { fontSize: 12, color: SUBTLE, fontStyle: 'italic', marginBottom: 8 },
  subjectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: CANVAS,
  },
  subjectName: { fontSize: 13, color: INK, fontWeight: '600' },
  subjectMark: { fontSize: 13, color: EMERALD, fontWeight: '700' },
  subjectMarkEmpty: { color: SUBTLE, fontWeight: '600' },

  emptyWrap: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: INK, marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: SUBTLE, textAlign: 'center', lineHeight: 18 },
  errorBanner: { backgroundColor: '#FCEDED', borderRadius: 12, padding: 14, marginBottom: 12 },
  errorText: { color: '#E5484D', fontSize: 13.5, textAlign: 'center' },
});
