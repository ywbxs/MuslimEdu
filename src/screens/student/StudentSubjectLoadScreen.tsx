/**
 * StudentSubjectLoadScreen
 *
 * The student sees only their own load. No id is ever sent; the backend reads
 * the authenticated user, so changing a payload cannot reveal another student.
 *
 * Navigate with: navigation.navigate('StudentSubjectLoad')
 */
import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import subjectLoadingService, {
  SubjectLoading,
} from '../../services/subjectLoadingService';
import {useLocale} from '../../context/LocaleContext';

const C = {
  bg: '#F5F7F6',
  card: '#FFFFFF',
  ink: '#12211C',
  muted: '#6B7C76',
  line: '#E3EAE7',
  green: '#12805C',
  greenSoft: '#E7F4EF',
  amber: '#B4790B',
  amberSoft: '#FDF3DF',
  red: '#C0392B',
};

function statusCopy(t: (key: string, fallback?: string) => string, status?: string) {
  if (status === 'approved') {
    return t('student_subject_load.status_approved', 'Officially loaded');
  }
  if (status === 'submitted') {
    return t('student_subject_load.status_submitted', 'Waiting for registrar approval');
  }
  if (status === 'rejected') {
    return t('student_subject_load.status_rejected', 'Returned to your adviser');
  }
  if (status === 'draft') {
    return t('student_subject_load.status_draft', 'Tentative, not yet submitted');
  }
  if (status === 'cancelled') {
    return t('student_subject_load.status_cancelled', 'Cancelled');
  }
  return t('student_subject_load.status_none', 'No subject load yet');
}

type Props = {navigation: any};

export default function StudentSubjectLoadScreen({navigation}: Props) {
  const {t} = useLocale();
  const [current, setCurrent] = useState<SubjectLoading | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      setError(null);
      const res = await subjectLoadingService.myLoad();
      setCurrent(res.current_load);
      setHistory(res.history || []);
    } catch (e: any) {
      setError(e.message || t('student_subject_load.load_error', 'Could not load your subjects.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  if (loading) {
    return (
      <SafeAreaView style={s.center}>
        <ActivityIndicator size={'large'} color={C.green} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView
        contentContainerStyle={{paddingBottom: 40}}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchAll();
            }}
          />
        }>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={s.back}>{t('common.back', 'Back')}</Text>
          </TouchableOpacity>
          <Text style={s.title}>{t('student_subject_load.title', 'My Subjects')}</Text>
          <Text style={s.subtitle}>{statusCopy(t, current?.status)}</Text>
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}

        {!current ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyTitle}>{t('student_subject_load.empty_title', 'Nothing loaded yet')}</Text>
            <Text style={s.emptyBody}>
              {t('student_subject_load.empty_body', 'Your adviser or the registrar has not loaded your subjects for this term. Once they do, your schedule and Certificate of Registration appear here.')}
            </Text>
          </View>
        ) : (
          <View>
            <View style={s.card}>
              <View style={s.statRow}>
                <View style={s.stat}>
                  <Text style={s.statValue}>{current.total_subjects}</Text>
                  <Text style={s.statLabel}>{t('student_subject_load.subjects', 'subjects')}</Text>
                </View>
                <View style={s.stat}>
                  <Text style={s.statValue}>{current.total_units}</Text>
                  <Text style={s.statLabel}>{t('student_subject_load.units', 'units')}</Text>
                </View>
                <View style={s.stat}>
                  <Text style={s.statValue}>
                    {current.load_number || '-'}
                  </Text>
                  <Text style={s.statLabel}>{t('student_subject_load.load_no', 'load no.')}</Text>
                </View>
              </View>
            </View>

            {current.status !== 'approved' ? (
              <View style={s.noticeCard}>
                <Text style={s.noticeText}>
                  {t('student_subject_load.notice_prefix', 'This load is')} {current.status}. {t('student_subject_load.notice_suffix', 'Subjects can still change until the registrar approves it.')}
                </Text>
              </View>
            ) : null}

            {current.items.map(item => (
              <View key={item.id} style={s.card}>
                <Text style={s.itemTitle}>
                  {item.subject_code ? item.subject_code + ' - ' : ''}
                  {item.subject_name || `${t('student_subject_load.subject_hash', 'Subject #')}${item.subject_id}`}
                </Text>
                <Text style={s.itemMeta}>
                  {item.units} {t('student_subject_load.units', 'units')} · {item.load_type}
                  {item.status !== 'enrolled' ? ' · ' + item.status : ''}
                </Text>
                {item.final_grade ? (
                  <Text style={s.grade}>{t('student_subject_load.grade', 'Grade')}: {item.final_grade}</Text>
                ) : null}
              </View>
            ))}
          </View>
        )}

        {history.length > 1 ? (
          <View>
            <Text style={s.sectionTitle}>{t('student_subject_load.previous_terms', 'Previous terms')}</Text>
            {history.map(h => (
              <View key={h.id} style={s.historyRow}>
                <Text style={s.historyTitle}>
                  {h.load_number || `${t('student_subject_load.load_hash', 'Load #')}${h.id}`}
                </Text>
                <Text style={s.historyMeta}>
                  {h.total_subjects} {t('student_subject_load.subjects', 'subjects')} · {h.total_units} {t('student_subject_load.units', 'units')} ·{' '}
                  {String(h.status).toUpperCase()}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: {flex: 1, backgroundColor: C.bg},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg},
  header: {paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10},
  back: {color: C.green, fontWeight: '600', marginBottom: 6},
  title: {fontSize: 24, fontWeight: '700', color: C.ink},
  subtitle: {fontSize: 13, color: C.muted, marginTop: 3},
  card: {backgroundColor: C.card, marginHorizontal: 14, marginBottom: 10, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: C.line},
  statRow: {flexDirection: 'row'},
  stat: {flex: 1, alignItems: 'center'},
  statValue: {fontSize: 17, fontWeight: '700', color: C.ink},
  statLabel: {fontSize: 11, color: C.muted, marginTop: 2},
  noticeCard: {backgroundColor: C.amberSoft, marginHorizontal: 14, marginBottom: 10, padding: 12, borderRadius: 12},
  noticeText: {color: C.amber, fontSize: 12, lineHeight: 17},
  itemTitle: {fontSize: 15, fontWeight: '600', color: C.ink},
  itemMeta: {fontSize: 12, color: C.muted, marginTop: 3},
  grade: {fontSize: 12, color: C.green, marginTop: 6, fontWeight: '600'},
  emptyCard: {backgroundColor: C.card, margin: 14, padding: 18, borderRadius: 14, borderWidth: 1, borderColor: C.line},
  emptyTitle: {fontSize: 16, fontWeight: '700', color: C.ink},
  emptyBody: {fontSize: 13, color: C.muted, marginTop: 8, lineHeight: 19},
  sectionTitle: {fontSize: 13, fontWeight: '700', color: C.muted, marginHorizontal: 18, marginTop: 16, marginBottom: 8, letterSpacing: 0.5},
  historyRow: {marginHorizontal: 18, marginBottom: 12, borderLeftWidth: 2, borderLeftColor: C.line, paddingLeft: 12},
  historyTitle: {fontSize: 14, fontWeight: '600', color: C.ink},
  historyMeta: {fontSize: 12, color: C.muted, marginTop: 2},
  error: {color: C.red, paddingHorizontal: 18, paddingBottom: 8},
});
