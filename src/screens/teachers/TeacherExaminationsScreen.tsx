import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import examService, { Examination, ExamStatus } from '../../services/teacherExaminationService';
import { C, tintFor } from '../nextPhaseTheme';
import { useLocale } from '../../context/LocaleContext';

const FILTERS: Array<{ key: ExamStatus | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Drafts' },
  { key: 'published', label: 'Published' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

type Props = { navigation: any };

export default function TeacherExaminationsScreen({ navigation }: Props) {
  const { t } = useLocale();
  const [exams, setExams] = useState<Examination[]>([]);
  const [summary, setSummary] = useState({ total: 0, draft: 0, published: 0, upcoming: 0 });
  const [filter, setFilter] = useState<ExamStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await examService.list(filter === 'all' ? {} : { status: filter });
      setExams(res.examinations);
      setSummary(res.summary);
    } catch (e: any) {
      setError(e?.message ?? t('teacher_examinations.load_error', 'Could not load examinations.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter, t]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => navigation.addListener?.('focus', load), [navigation, load]);

  const publish = (exam: Examination) => {
    const next: ExamStatus = exam.status === 'published' ? 'draft' : 'published';

    Alert.alert(
      next === 'published' ? t('teacher_examinations.publish_title', 'Publish examination') : t('teacher_examinations.unpublish_title', 'Move back to draft'),
      next === 'published'
        ? t('teacher_examinations.publish_message', 'Students in this section will be notified immediately.')
        : t('teacher_examinations.unpublish_message', 'Students will no longer see this examination.'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: next === 'published' ? t('teacher_examinations.publish', 'Publish') : t('teacher_examinations.unpublish', 'Unpublish'),
          onPress: async () => {
            try {
              await examService.setStatus(exam.id, next);
              load();
            } catch (e: any) {
              Alert.alert(t('teacher_examinations.update_error', 'Could not update'), e?.message ?? t('common.try_again_full', 'Please try again.'));
            }
          },
        },
      ],
    );
  };

  const remove = (exam: Examination) => {
    Alert.alert(t('teacher_examinations.delete_title', 'Delete examination'), exam.title, [
      { text: t('common.cancel', 'Cancel'), style: 'cancel' },
      {
        text: t('teacher_examinations.delete', 'Delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await examService.remove(exam.id);
            load();
          } catch (e: any) {
            Alert.alert(t('teacher_examinations.delete_error', 'Could not delete'), e?.message ?? t('common.try_again_full', 'Please try again.'));
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={s.center}>
        <ActivityIndicator color={C.green} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen}>
      <FlatList
        data={exams}
        keyExtractor={item => String(item.id)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={C.green}
          />
        }
        contentContainerStyle={exams.length === 0 ? { flexGrow: 1 } : { paddingBottom: 96 }}
        ListHeaderComponent={
          <View>
            <Text style={s.title}>{t('teacher_examinations.title', 'Examinations')}</Text>
            <Text style={s.sub}>{t('teacher_examinations.subtitle', 'Schedule, publish and mark your own examinations.')}</Text>

            <View style={s.stats}>
              <Stat label={t('teacher_examinations.total', 'Total')} value={summary.total} />
              <Stat label={t('teacher_examinations.drafts', 'Drafts')} value={summary.draft} />
              <Stat label={t('teacher_examinations.published', 'Published')} value={summary.published} tint={C.green} />
              <Stat label={t('teacher_examinations.upcoming', 'Upcoming')} value={summary.upcoming} tint={C.blue} />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
              {FILTERS.map(f => (
                <TouchableOpacity
                  key={f.key}
                  style={[s.chip, filter === f.key && s.chipActive]}
                  onPress={() => setFilter(f.key)}
                >
                  <Text style={[s.chipText, filter === f.key && s.chipTextActive]}>{t(`teacher_examinations.filter_${f.key}`, f.label)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyTitle}>{error ? t('teacher_examinations.error_title', 'Something went wrong') : t('teacher_examinations.empty_title', 'No examinations yet')}</Text>
            <Text style={s.emptyBody}>
              {error ?? t('teacher_examinations.empty_body', 'Create one and it stays a draft until you publish it to the section.')}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const tint = tintFor(item.status);

          return (
            <View style={s.card}>
              <View style={s.cardTop}>
                <Text style={s.cardTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <View style={[s.pill, { backgroundColor: tint.bg }]}>
                  <Text style={[s.pillText, { color: tint.fg }]}>{item.status}</Text>
                </View>
              </View>

              <Text style={s.cardMeta}>
                {item.exam_type} · {item.total_marks} {t('teacher_examinations.marks', 'marks')}
                {item.scheduled_date ? ' · ' + item.scheduled_date : ' · ' + t('teacher_examinations.no_date_set', 'no date set')}
                {item.start_time ? ' · ' + item.start_time : ''}
                {item.room ? ' · ' + item.room : ''}
              </Text>

              {item.graded_count !== null ? (
                <Text style={s.cardMeta}>{item.graded_count} {t('teacher_examinations.marked', 'marked')}</Text>
              ) : null}

              <View style={s.actions}>
                <TouchableOpacity
                  style={s.action}
                  onPress={() => navigation.navigate('TeacherExaminationGrading', { examinationId: item.id })}
                >
                  <Text style={s.actionText}>{t('teacher_examinations.marks_action', 'Marks')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.action}
                  onPress={() => navigation.navigate('TeacherExaminationForm', { examination: item })}
                >
                  <Text style={s.actionText}>{t('common.edit', 'Edit')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.action} onPress={() => publish(item)}>
                  <Text style={[s.actionText, { color: C.green }]}>
                    {item.status === 'published' ? t('teacher_examinations.unpublish', 'Unpublish') : t('teacher_examinations.publish', 'Publish')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.action} onPress={() => remove(item)}>
                  <Text style={[s.actionText, { color: C.red }]}>{t('teacher_examinations.delete', 'Delete')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />

      <TouchableOpacity style={s.fab} onPress={() => navigation.navigate('TeacherExaminationForm', {})}>
        <Text style={s.fabText}>{t('teacher_examinations.new_examination', 'New examination')}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function Stat({ label, value, tint }: { label: string; value: number; tint?: string }) {
  return (
    <View style={s.stat}>
      <Text style={[s.statValue, tint ? { color: tint } : null]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  title: { fontSize: 25, fontWeight: '700', color: C.ink, marginHorizontal: 18, marginTop: 16 },
  sub: { color: C.muted, marginHorizontal: 18, marginTop: 4 },
  stats: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, marginTop: 14 },
  stat: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statValue: { fontSize: 19, fontWeight: '800', color: C.ink },
  statLabel: { fontSize: 11, color: C.muted, marginTop: 3 },
  chips: { paddingHorizontal: 14, paddingVertical: 12 },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.card,
    marginRight: 8,
  },
  chipActive: { backgroundColor: C.greenSoft, borderColor: C.green },
  chipText: { color: C.muted, fontSize: 13 },
  chipTextActive: { color: C.green, fontWeight: '700' },
  card: {
    backgroundColor: C.card,
    marginHorizontal: 14,
    marginBottom: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.line,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: C.ink },
  pill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  pillText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  cardMeta: { color: C.muted, fontSize: 12.5, marginTop: 6 },
  actions: { flexDirection: 'row', gap: 6, marginTop: 12, flexWrap: 'wrap' },
  action: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.bg,
  },
  actionText: { fontSize: 13, fontWeight: '600', color: C.ink },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: C.ink },
  emptyBody: { color: C.muted, textAlign: 'center', marginTop: 7, lineHeight: 20 },
  fab: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 18,
    backgroundColor: C.green,
    borderRadius: 13,
    paddingVertical: 15,
    alignItems: 'center',
  },
  fabText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
