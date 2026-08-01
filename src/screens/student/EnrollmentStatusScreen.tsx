import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import Svg, { Polyline, Circle, Path } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import {
  fetchStudentEnrollmentWorkflowStatus,
  StudentEnrollmentWorkflowStatus,
} from '../../services/enrollmentWorkflowService';
import { Skeleton, SkeletonCircle } from '../../components/Skeleton';
import { GlassButton } from '../../components/glass/GlassKit';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SHADOW, RADIUS } from '../../theme/spatial';

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

function CheckCircleIcon({ color, size = 40 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} fill={color} />
      <Polyline points="7.5 12.5 10.5 15.5 16.5 9" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
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
function BulbIcon({ color = EMERALD, size = 22 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 18h6M10 21h4" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path
        d="M12 3a6 6 0 0 0-3.6 10.8c.5.4.8 1 .8 1.7V16h5.6v-.5c0-.7.3-1.3.8-1.7A6 6 0 0 0 12 3z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

interface EnrollmentStatusScreenProps {
  /**
   * Called with a freshly-fetched status whenever this screen loads one
   * successfully. MainTabs' enrollment gate passes its own applyStatus here
   * when it renders this screen in place of the tab bar, so a retry from
   * this screen (or its own initial load, if the gate's check failed first)
   * can unlock the gate too - without this, the gate's verdict would only
   * ever come from its own independent fetch and could get stuck showing
   * this screen even after enrollment is genuinely completed.
   */
  onStatusLoaded?: (status: StudentEnrollmentWorkflowStatus) => void;
}

/**
 * This is the ONLY screen a student sees while the enrollment gate in
 * MainTabs is blocking them (no tab bar underneath, no back target to go
 * to) - so it deliberately has no back button, and a Log Out button
 * instead, matching MenuScreen's footer pattern (GlassButton, danger
 * variant, direct logout - no confirmation dialog).
 */
export default function EnrollmentStatusScreen({ onStatusLoaded }: EnrollmentStatusScreenProps = {}) {
  const insets = useSafeAreaInsets();
  const { token, logout } = useAuth();
  const { t } = useLocale();

  const [data, setData] = useState<StudentEnrollmentWorkflowStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchStudentEnrollmentWorkflowStatus(token);
      setData(result);
      onStatusLoaded?.(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('enrollment_status.load_error', 'Could not load your enrollment status.'));
    } finally {
      setIsLoading(false);
    }
  }, [token, t, onStatusLoaded]);

  useEffect(() => {
    load();
  }, [load]);

  const record = data?.record ?? null;
  const currentOrder = record?.currentStage?.order ?? -1;
  const isFullyCompleted = record?.status === 'completed';
  const statusMeta = record ? STATUS_META[record.status] ?? STATUS_META.in_progress : null;

  const stages = data?.stages ?? [];
  const currentIndex = isFullyCompleted
    ? stages.length - 1
    : stages.findIndex((s) => s.id === record?.current_stage_id);
  const progressPct = stages.length > 0 && currentIndex >= 0
    ? Math.round(((currentIndex + 1) / stages.length) * 100)
    : 0;

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <Text style={styles.headerTitle}>{t('enrollment_status.title', 'Enrollment Progress')}</Text>
        <Text style={styles.headerSubtitle}>{t('enrollment_status.subtitle', 'Where you are in the admission process')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <>
            <Skeleton width="60%" height={22} borderRadius={6} style={styles.mb16} />
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={styles.stepRow}>
                <SkeletonCircle size={40} />
                <Skeleton width="70%" height={18} borderRadius={4} style={{ marginLeft: 16 }} />
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
            <View style={styles.topRow}>
              {statusMeta ? (
                <View style={[styles.statusPill, { backgroundColor: statusMeta.soft }]}>
                  <Text style={[styles.statusPillText, { color: statusMeta.color }]}>{record ? t(`enrollment_status.status_${STATUS_LABEL_KEYS[record.status] ?? 'in_progress'}`, statusMeta.label) : statusMeta.label}</Text>
                </View>
              ) : null}
              {stages.length > 0 && currentIndex >= 0 ? (
                <Text style={styles.stepOfText}>
                  {t('enrollment_status.step_of', 'Step {current} of {total}')
                    .replace('{current}', String(currentIndex + 1))
                    .replace('{total}', String(stages.length))}
                </Text>
              ) : null}
            </View>

            {stages.length > 0 && currentIndex >= 0 ? (
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
              </View>
            ) : null}

            {record?.status === 'in_progress' && record.currentStage ? (
              <View style={styles.actionCard}>
                <View style={styles.actionHeaderRow}>
                  <View style={styles.actionIconWrap}>
                    <BulbIcon />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={[styles.actionPill, { backgroundColor: EMERALD_SOFT }]}>
                      <Text style={[styles.actionPillText, { color: EMERALD }]}>{record.currentStage.name}</Text>
                    </View>
                    <Text style={styles.actionHeading}>{t('enrollment_status.what_to_do_now', 'What to do now')}</Text>
                  </View>
                </View>
                <Text style={styles.actionBody}>
                  {record.currentStage.student_instructions?.trim()
                    ? record.currentStage.student_instructions
                    : t('enrollment_status.no_instructions', 'Please contact the school office for next steps.')}
                </Text>
              </View>
            ) : null}

            <Text style={styles.sectionTitle}>{t('enrollment_status.stages', 'Stages')}</Text>
            <View style={styles.stagesCard}>
              {stages.map((stage, idx) => {
                const isDone = isFullyCompleted || stage.order < currentOrder;
                const isCurrent = !isFullyCompleted && stage.id === record?.current_stage_id;
                const isLast = idx === stages.length - 1;
                return (
                  <View
                    key={stage.id}
                    style={[styles.stepRow, isCurrent && styles.stepRowCurrent]}
                  >
                    <View style={styles.stepIconCol}>
                      {isDone ? (
                        <CheckCircleIcon color={EMERALD} />
                      ) : (
                        <View style={[styles.stepNumberCircle, isCurrent && styles.stepNumberCircleCurrent]}>
                          <Text style={[styles.stepNumberText, isCurrent && styles.stepNumberTextCurrent]}>{idx + 1}</Text>
                        </View>
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
                      {isCurrent ? (
                        <View style={styles.hereTag}>
                          <View style={styles.hereDot} />
                          <Text style={styles.stepCurrentTag}>{t('enrollment_status.you_are_here', 'You are here')}</Text>
                        </View>
                      ) : null}
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

        <View style={styles.footerWrap}>
          <GlassButton
            label={t('menu.log_out', 'Log Out')}
            variant="danger"
            onPress={logout}
            radius={RADIUS.lg}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.canvas },
  header: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 22,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: INK, textAlign: 'center' },
  headerSubtitle: { fontSize: 13.5, color: SUBTLE, textAlign: 'center', marginTop: 4 },

  content: { padding: 20, paddingBottom: 48 },
  mb16: { marginBottom: 16 },

  sectionTitle: { fontSize: 17, fontWeight: '800', color: INK, marginTop: 28, marginBottom: 14 },

  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusPill: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  statusPillText: { fontSize: 13.5, fontWeight: '800' },
  stepOfText: { fontSize: 13, fontWeight: '700', color: SUBTLE },

  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E7E9EC',
    marginTop: 14,
    overflow: 'hidden',
  },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: EMERALD },

  actionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 22,
    marginTop: 20,
    borderLeftWidth: 4,
    borderLeftColor: EMERALD,
    ...SHADOW.level2,
  },
  actionHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  actionPill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 6 },
  actionPillText: { fontSize: 11.5, fontWeight: '700' },
  actionHeading: { fontSize: 17, fontWeight: '800', color: INK },
  actionBody: { fontSize: 15, color: INK, lineHeight: 22 },

  stagesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    ...SHADOW.level2,
  },
  stepRow: { flexDirection: 'row', borderRadius: 16 },
  stepRowCurrent: { backgroundColor: EMERALD_SOFT, marginHorizontal: -10, paddingHorizontal: 10, paddingTop: 8 },
  stepIconCol: { width: 40, alignItems: 'center' },
  stepNumberCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2.4,
    borderColor: '#D9DCE1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  stepNumberCircleCurrent: { borderColor: EMERALD, ...SHADOW.level1 },
  stepNumberText: { fontSize: 15, fontWeight: '800', color: '#B8BCC2' },
  stepNumberTextCurrent: { color: EMERALD },
  stepLine: { width: 3, flex: 1, minHeight: 32, backgroundColor: '#D9DCE1', marginTop: 4, borderRadius: 2 },
  stepLineDone: { backgroundColor: EMERALD },
  stepTextCol: { flex: 1, marginLeft: 16, paddingBottom: 26, justifyContent: 'center' },
  stepLabel: { fontSize: 16.5, fontWeight: '700', color: SUBTLE },
  stepLabelDone: { color: INK },
  stepLabelCurrent: { color: EMERALD, fontWeight: '800', fontSize: 17.5 },
  hereTag: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  hereDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: EMERALD, marginRight: 6 },
  stepCurrentTag: { fontSize: 12.5, fontWeight: '700', color: EMERALD },

  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 6,
    ...SHADOW.level2,
  },
  historyRow: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  historyRowBorder: { borderTopWidth: 1, borderTopColor: HAIRLINE },
  historyText: { fontSize: 14, fontWeight: '600', color: INK },
  historyDate: { fontSize: 12, color: SUBTLE, marginTop: 2 },

  emptyWrap: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: INK, marginBottom: 10 },
  emptyDesc: { fontSize: 14.5, color: SUBTLE, textAlign: 'center', lineHeight: 21 },

  errorBanner: { backgroundColor: '#FCEDED', borderRadius: 16, padding: 18, alignItems: 'center' },
  errorText: { color: '#E5484D', fontSize: 14.5, textAlign: 'center', marginBottom: 12 },
  retryButton: { backgroundColor: '#E5484D', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
  retryButtonText: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '700' },

  footerWrap: { marginTop: 32 },
});
