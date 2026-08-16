import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ChevronLeft, ChevronRight, NotebookText } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import {
  fetchGradebookClasses,
  GradebookClassOption,
  ExamCategoryOption,
} from '../../services/teacherGradebookService';
import { Skeleton } from '../../components/Skeleton';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHADOW, GLASS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';
const EMERALD = '#1FAE64';
const EMERALD_SOFT = '#E5F8F5';
const INK = '#1C1C1E';
const SUBTLE = '#8A9099';
const CANVAS = '#F6F7F9';
const GLASS_SURFACE = GLASS.fillOnLight;
const GLASS_SURFACE_STRONG = GLASS.fillOnLightStrong;
const GLASS_BORDER = GLASS.borderOnLight;

function IconChevronLeft({ color }: { color: string }) {
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}
function IconChevronRight({ color }: { color: string }) {
  return <ChevronRight size={18} color={color} strokeWidth={2.2} />;
}
function IconGradeBook({ color }: { color: string }) {
  return <NotebookText size={22} color={color} strokeWidth={2} />;
}

function ClassCardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton width={44} height={44} borderRadius={12} />
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Skeleton width="60%" height={15} borderRadius={4} />
        <Skeleton width="40%" height={12} borderRadius={4} style={{ marginTop: 8 }} />
      </View>
    </View>
  );
}

// One card per (section, subject) pair the teacher is assigned to teach.
// Tapping a card expands an exam-category chip row inline; picking a
// category jumps straight to that class/subject/exam-category's roster.
export default function TeacherGradebookClassesScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();
  const { t } = useLocale();
  const [classes, setClasses] = useState<GradebookClassOption[]>([]);
  const [examCategories, setExamCategories] = useState<ExamCategoryOption[]>([]);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!token) return;
      if (!opts.silent) setIsLoading(true);
      setError(null);
      try {
        const data = await fetchGradebookClasses(token);
        setClasses(data.classes);
        setExamCategories(data.examCategories);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('teacher_gradebook_classes.load_error', 'Could not load your gradebook classes.'));
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

  const onRefresh = () => {
    setIsRefreshing(true);
    load({ silent: true });
  };

  const goToRoster = (item: GradebookClassOption, examCategory: ExamCategoryOption) => {
    (navigation as any).navigate('TeacherGradebookRoster', {
      sectionId: item.section_id,
      subjectId: item.subject_id,
      examCategoryId: examCategory.id,
      classLabel: `${item.class_name ?? ''} - ${item.section_name}`.trim(),
      subjectLabel: item.subject_name ?? t('teacher_gradebook_classes.subject', 'Subject'),
      examCategoryLabel: examCategory.name,
    });
  };

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
          <IconChevronLeft color={INK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('teacher_gradebook_classes.title', 'Enter Grades')}</Text>
        <View style={{ width: 32 }} />
      </View>

      {isLoading ? (
        <View style={styles.listContent}>
          <ClassCardSkeleton />
          <ClassCardSkeleton />
          <ClassCardSkeleton />
        </View>
      ) : (
        <FlatList
          data={classes}
          keyExtractor={(item) => `${item.section_id}-${item.subject_id}`}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={EMERALD} />}
          ListEmptyComponent={
            !error ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>{t('teacher_gradebook_classes.empty_title', 'Nothing to grade yet')}</Text>
                <Text style={styles.emptyDesc}>
                  {t('teacher_gradebook_classes.empty_desc', "You'll see a card here once you're assigned to teach a subject period.")}
                </Text>
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
              {!error && examCategories.length === 0 ? (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>
                    {t('teacher_gradebook_classes.no_exam_categories', 'No exam categories are set up for this session yet. Ask an admin to add one before entering grades.')}
                  </Text>
                </View>
              ) : null}
            </>
          }
          renderItem={({ item }) => {
            const key = `${item.section_id}-${item.subject_id}`;
            const isExpanded = expandedKey === key;
            return (
              <View style={styles.card}>
                <TouchableOpacity
                  style={styles.cardRow}
                  activeOpacity={0.85}
                  onPress={() => setExpandedKey(isExpanded ? null : key)}
                >
                  <View style={styles.cardIcon}>
                    <IconGradeBook color={EMERALD} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>
                      {item.class_name ?? t('teacher_gradebook_classes.class_fallback', 'Class')} - {item.section_name}
                    </Text>
                    <View style={styles.pill}>
                      <Text style={styles.pillText}>{item.subject_name ?? t('teacher_gradebook_classes.subject', 'Subject')}</Text>
                    </View>
                  </View>
                  <IconChevronRight color={SUBTLE} />
                </TouchableOpacity>
                {isExpanded ? (
                  <View style={styles.examRow}>
                    <Text style={styles.examLabel}>{t('teacher_gradebook_classes.choose_exam', 'Choose an exam:')}</Text>
                    <View style={styles.examChipWrap}>
                      {examCategories.map((cat) => (
                        <TouchableOpacity
                          key={cat.id}
                          style={styles.examChip}
                          onPress={() => goToRoster(item, cat)}
                        >
                          <Text style={styles.examChipText}>{cat.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            );
          }}
        />
      )}
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
  card: {
    backgroundColor: GLASS_SURFACE,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  ...SHADOW.level1,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    backgroundColor: EMERALD_SOFT,
  },
  cardTitle: { fontSize: 15.5, fontWeight: '700', color: INK, marginBottom: 8 },
  pill: { alignSelf: 'flex-start', backgroundColor: EMERALD_SOFT, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8 },
  pillText: { fontSize: 11, fontWeight: '700', color: EMERALD },
  examRow: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: GLASS_BORDER },
  examLabel: { fontSize: 12, color: SUBTLE, fontWeight: '600', marginBottom: 8 },
  examChipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  examChip: { backgroundColor: CANVAS, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  examChipText: { fontSize: 12.5, fontWeight: '700', color: INK },
  emptyWrap: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: INK, marginBottom: 8 },
  emptyDesc: { fontSize: 13.5, color: SUBTLE, textAlign: 'center', lineHeight: 19 },
  errorBanner: { backgroundColor: '#FCEDED', borderRadius: 12, padding: 14, marginBottom: 12 },
  errorText: { color: '#E5484D', fontSize: 13.5, textAlign: 'center' },
});
