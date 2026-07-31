import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Polyline, Circle, Path } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import {
  fetchStudentEnrollmentWorkflowStatusCached,
  StudentEnrollmentWorkflowStatus,
} from '../../services/enrollmentWorkflowService';
import { Skeleton, SkeletonCircle } from '../../components/Skeleton';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SHADOW } from '../../theme/spatial';

const EMERALD = '#0F9D58';
const EMERALD_SOFT = '#E7F5EC';
const INK = '#1C1C1E';
const SUBTLE = '#8A9099';
const HAIRLINE = '#EDEEF0';

const STATUS_META: Record<string, { label: string; color: string; soft: string }> = {
  in_progress: { label: 'In progress', color: '#B8860B', soft: '#FBF2DE' },
  completed: { label: 'Officially enrolled', color: EMERALD, soft: EMERALD_SOFT },
  withdrawn: { label: 'Withdrawn', color: '#E5484D', soft: '#FCEDED' },
};
const STATUS_LABEL_KEYS: Record<string, string> = {
  in_progress: 'in_progress',
  completed: 'completed',
  withdrawn: 'withdrawn',
};

function IconChevronLeft({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Polyline points="15 5 8 12 15 19" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function CheckCircleIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} fill={color} />
      <Polyline points="7.5 12.5 10.5 15.5 16.5 9" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function CurrentDotIcon({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} stroke={EMERALD} strokeWidth={2.4} />
      <Circle cx={12} cy={12} r={4} fill={EMERALD} />
    </Svg>
  );
}
function UpcomingDotIcon({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} stroke="#D9DCE1" strokeWidth={2.4} />
    </Svg>
  );
}
function ClockIcon({ color = SUBTLE, size = 16 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} />
      <Path d="M12 7v5l3 2" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function EnrollmentStatusScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token, user } = useAuth();
  const { t } = useLocale();

  const [data, setData] = useState<StudentEnrollmentWorkflowStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);

  const load = useCallback(async () => {
    if (!token || !user) return;
    setIsLoading(true);
    setError(null);
    try {
      const { data: result, fromCache } = await fetchStudentEnrollmentWorkflowStatusCached(token, user.id);
      setData(result);
      setIsFromCache(fromCache);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('enrollment_status.load_error', 'Could not load your enrollment status.'));
    } finally {
      setIsLoading(false);
    }
  }, [token, user, t]);

  useEffect(() => {
    load();
  }, [load]);

  const record = data?.record ?? null;
  const currentOrder = record?.currentStage?.order ?? -1;
  const isFullyCompleted = record?.status === 'completed';
  const statusMeta = record ? STATUS_META[record.status] ?? STATUS_META.in_progress : null;

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
          <IconChevronLeft color={INK} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{t('enrollment_status.title', 'Enrollment Progress')}</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>{t('enrollment_status.subtitle', 'Where you are in the admission process')}</Text>
        </View>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <>
            <Skeleton width="60%" height={22} borderRadius={6} style={styles.mb16} />
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={styles.stepRow}>
                <SkeletonCircle size={22} />
                <Skeleton width="70%" height={16} borderRadius={4} style={{ marginLeft: 12 }} />
              </View>
            ))}
          </>
        ) : error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={load}>
              <Text style={styles.retryButtonText}>{t('common.try_again', 'Try again')}</Text>
            </TouchableOpacity>
          </View>
        ) : !data?.started ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>{t('enrollment_status.not_started', 'Not started yet')}</Text>
            <Text style={styles.emptyDesc}>
              {data?.message ?? t('enrollment_status.not_started_desc', 'Your enrollment workflow has not been started yet. Please contact the school office.')}
            </Text>
          </View>
        ) : (
          <>
            {isFromCache ? (
              <View style={styles.cacheBanner}>
                <Text style={styles.cacheBannerText}>
                  {t('enrollment_status.showing_cached', "Showing your last synced status - reconnect to check for updates.")}
                </Text>
              </View>
            ) : null}

            {statusMeta ? (
              <View style={[styles.statusPill, { backgroundColor: statusMeta.soft, alignSelf: 'flex-start' }]}>
                <Text style={[styles.statusPillText, { color: statusMeta.color }]}>{record ? t(`enrollment_status.status_${STATUS_LABEL_KEYS[record.status] ?? 'in_progress'}`, statusMeta.label) : statusMeta.label}</Text>
              </View>
            ) : null}

            {record?.status === 'in_progress' && record.currentStage ? (
              <View style={styles.actionCard}>
                <View style={[styles.actionPill, { backgroundColor: EMERALD_SOFT }]}>
                  <Text style={[styles.actionPillText, { color: EMERALD }]}>{record.currentStage.name}</Text>
                </View>
                <Text style={styles.actionHeading}>{t('enrollment_status.what_to_do_now', 'What to do now')}</Text>
                <Text style={styles.actionBody}>
                  {record.currentStage.student_instructions?.trim()
                    ? record.currentStage.student_instructions
                    : t('enrollment_status.no_instructions', 'Please contact the school office for next steps.')}
                </Text>
              </View>
            ) : null}

            <Text style={styles.sectionTitle}>{t('enrollment_status.stages', 'Stages')}</Text>
            <View style={styles.stagesCard}>
              {(data.stages ?? []).map((stage, idx) => {
                const isDone = isFullyCompleted || stage.order < currentOrder;
                const isCurrent = !isFullyCompleted && stage.id === record?.current_stage_id;
                const isLast = idx === (data.stages?.length ?? 0) - 1;
                return (
                  <View key={stage.id} style={styles.stepRow}>
                    <View style={styles.stepIconCol}>
                      {isDone ? (
                        <CheckCircleIcon color={EMERALD} />
                      ) : isCurrent ? (
                        <CurrentDotIcon />
                      ) : (
                        <UpcomingDotIcon />
                      )}
                      {!isLast ? (
                        <View style={[styles.stepLine, isDone && styles.stepLineDone]} />
                      ) : null}
                    </View>
                    <View style={styles.stepTextCol}>
                      <Text
                        style={[
                          styles.stepLabel,
                          isCurrent && styles.stepLabelCurrent,
                          isDone && styles.stepLabelDone,
                        ]}
                      >
                        {stage.name}
                      </Text>
                      {isCurrent ? <Text style={styles.stepCurrentTag}>{t('enrollment_status.you_are_here', 'You are here')}</Text> : null}
                    </View>
                  </View>
                );
              })}
            </View>

            {data.history && data.history.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>{t('enrollment_status.history', 'History')}</Text>
                <View style={styles.historyCard}>
                  {data.history.map((h, idx) => (
                    <View key={idx} style={[styles.historyRow, idx > 0 && styles.historyRowBorder]}>
                      <ClockIcon />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.historyText}>
                          {h.from_stage ? `${h.from_stage} → ${h.to_stage}` : `${t('enrollment_status.started_at', 'Started at')} ${h.to_stage}`}
                        </Text>
                        <Text style={styles.historyDate}>{formatDate(h.changed_at)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.canvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
  },
  backButton: { width: 32 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: INK, textAlign: 'center' },
  headerSubtitle: { fontSize: 12, color: SUBTLE, textAlign: 'center', marginTop: 2 },

  content: { padding: 20, paddingBottom: 48 },
  mb16: { marginBottom: 16 },

  sectionTitle: { fontSize: 15, fontWeight: '700', color: INK, marginTop: 20, marginBottom: 12 },

  statusPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  statusPillText: { fontSize: 12.5, fontWeight: '700' },

  actionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginTop: 16,
    ...SHADOW.level1,
  },
  actionPill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 10 },
  actionPillText: { fontSize: 11.5, fontWeight: '700' },
  actionHeading: { fontSize: 14.5, fontWeight: '700', color: INK, marginBottom: 6 },
  actionBody: { fontSize: 13.5, color: INK, lineHeight: 19 },

  stagesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    ...SHADOW.level1,
  },
  stepRow: { flexDirection: 'row' },
  stepIconCol: { width: 22, alignItems: 'center' },
  stepLine: { width: 2, flex: 1, minHeight: 24, backgroundColor: '#D9DCE1', marginTop: 2 },
  stepLineDone: { backgroundColor: EMERALD },
  stepTextCol: { flex: 1, marginLeft: 12, paddingBottom: 18 },
  stepLabel: { fontSize: 14.5, fontWeight: '600', color: SUBTLE },
  stepLabelDone: { color: INK },
  stepLabelCurrent: { color: EMERALD, fontWeight: '700' },
  stepCurrentTag: { fontSize: 11.5, color: EMERALD, marginTop: 2 },

  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 6,
    ...SHADOW.level1,
  },
  historyRow: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  historyRowBorder: { borderTopWidth: 1, borderTopColor: HAIRLINE },
  historyText: { fontSize: 13.5, fontWeight: '600', color: INK },
  historyDate: { fontSize: 11.5, color: SUBTLE, marginTop: 2 },

  emptyWrap: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: INK, marginBottom: 8 },
  emptyDesc: { fontSize: 13.5, color: SUBTLE, textAlign: 'center', lineHeight: 19 },

  cacheBanner: { backgroundColor: '#F2F3F5', borderRadius: 12, padding: 12, marginBottom: 14 },
  cacheBannerText: { color: SUBTLE, fontSize: 12.5, textAlign: 'center' },

  errorBanner: { backgroundColor: '#FCEDED', borderRadius: 12, padding: 14, alignItems: 'center' },
  errorText: { color: '#E5484D', fontSize: 13.5, textAlign: 'center', marginBottom: 10 },
  retryButton: { backgroundColor: '#E5484D', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  retryButtonText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' },
});
