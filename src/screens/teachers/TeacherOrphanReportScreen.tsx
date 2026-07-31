import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path, Line, Circle, Polyline, Rect } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import {
  fetchTeacherReportStatus,
  submitTeacherReport,
  TeacherReportStatus,
  TeacherMonthlyReport,
} from '../../services/teacherOrphanService';
import { PickedPhoto } from '../../services/orphanService';
import ReportStepWizard, { WizardStep } from '../../components/ReportStepWizard';
import { NoteInput, RatingSelector, PhotoPicker } from '../../components/ReportFormControls';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHADOW, GLASS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';
const EMERALD = '#0F9D58';
const EMERALD_SOFT = '#E7F5EC';
const INK = '#1C1C1E';
const SUBTLE = '#8A9099';
const HAIRLINE = '#EDEEF0';
const CANVAS = '#F6F7F9';
const GLASS_SURFACE = GLASS.fillOnLight;
const GLASS_SURFACE_STRONG = GLASS.fillOnLightStrong;
const GLASS_BORDER = GLASS.borderOnLight;
const DANGER = '#E5484D';
const DANGER_SOFT = '#FCEDED';

const MONTH_KEYS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];
const MONTH_FALLBACKS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const HISTORY_MONTHS = 12;

function IconEdit({ color = EMERALD }: { color?: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M4 20h4L18 10l-4-4L4 16v4z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}
function IconCap({ color = EMERALD }: { color?: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M2 9l10-4 10 4-10 4L2 9z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}
function IconHeart({ color = EMERALD }: { color?: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M12 20s-7-4.35-7-9.5A3.5 3.5 0 0 1 12 7a3.5 3.5 0 0 1 7 3.5C19 15.65 12 20 12 20z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}
function IconTrend({ color = EMERALD }: { color?: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M4 16l5-5 4 4 7-8" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconImage({ color = EMERALD }: { color?: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}
function IconDoc({ color = EMERALD }: { color?: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M6 3h8l4 4v14H6z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M14 3v4h4" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Line x1={9} y1={12} x2={15} y2={12} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={9} y1={16} x2={13} y2={16} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function IconClock({ color = SUBTLE }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} />
      <Polyline points="12 7 12 12 15 14" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconCalendar({ color = EMERALD }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={5} width={16} height={16} rx={2} stroke={color} strokeWidth={2} />
      <Line x1={4} y1={9} x2={20} y2={9} stroke={color} strokeWidth={2} />
      <Line x1={8} y1={3} x2={8} y2={6} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={16} y1={3} x2={16} y2={6} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function IconCheck({ color = '#FFFFFF', size = 13 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline points="5 13 10 18 19 7" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconClose({ color = SUBTLE }: { color?: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Line x1={6} y1={6} x2={18} y2={18} stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Line x1={18} y1={6} x2={6} y2={18} stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

interface TimelineMonth {
  key: string;
  name: string;
  submitted: boolean;
  report: TeacherMonthlyReport | null;
}

function TeacherReportDetailModal({
  visible,
  month,
  onClose,
}: {
  visible: boolean;
  month: TimelineMonth | null;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const report = month?.report ?? null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <TouchableOpacity style={styles.modalBackdropTouch} activeOpacity={1} onPress={onClose} />
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{month?.name ?? ''}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.modalCloseBtn}>
              <IconClose />
            </TouchableOpacity>
          </View>

          {report ? (
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.modalStatusRow}>
                <View style={[styles.statusDot, { backgroundColor: EMERALD }]} />
                <Text style={styles.modalStatusText}>{t('teacher_orphan_report.submitted', 'Submitted')}</Text>
              </View>
              {report.submitted_by ? (
                <Text style={styles.modalSubmittedBy}>{t('teacher_orphan_report.submitted_by', 'By {name}').replace('{name}', report.submitted_by)}</Text>
              ) : null}

              <View style={styles.modalRatingsRow}>
                <View style={styles.modalRatingBox}>
                  <Text style={styles.modalRatingLabel}>{t('teacher_orphan_report.rating_teaching', 'Teaching')}</Text>
                  <Text style={styles.modalRatingValue}>
                    {report.teaching_effectiveness_rating != null ? `${report.teaching_effectiveness_rating}/5` : '—'}
                  </Text>
                </View>
                <View style={styles.modalRatingBox}>
                  <Text style={styles.modalRatingLabel}>{t('teacher_orphan_report.rating_engagement', 'Engagement')}</Text>
                  <Text style={styles.modalRatingValue}>
                    {report.classroom_engagement_rating != null ? `${report.classroom_engagement_rating}/5` : '—'}
                  </Text>
                </View>
                <View style={styles.modalRatingBox}>
                  <Text style={styles.modalRatingLabel}>{t('teacher_orphan_report.rating_growth', 'Growth')}</Text>
                  <Text style={styles.modalRatingValue}>
                    {report.professional_growth_rating != null ? `${report.professional_growth_rating}/5` : '—'}
                  </Text>
                </View>
              </View>

              {report.note ? (
                <View style={styles.modalNoteWrap}>
                  <Text style={styles.modalSectionLabel}>{t('teacher_orphan_report.note_label', 'Note')}</Text>
                  <Text style={styles.modalNoteText}>{report.note}</Text>
                </View>
              ) : null}

              {report.photos?.length ? (
                <View style={styles.modalNoteWrap}>
                  <Text style={styles.modalSectionLabel}>{t('teacher_orphan_report.photos_label', 'Photos')}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {report.photos.map((uri, idx) => (
                      <Image key={`${uri}-${idx}`} source={{ uri }} style={styles.modalPhoto} />
                    ))}
                  </ScrollView>
                </View>
              ) : null}
            </ScrollView>
          ) : (
            <View style={styles.modalEmptyWrap}>
              <View style={[styles.calChip, { backgroundColor: DANGER_SOFT }]}>
                <IconCalendar color={DANGER} />
              </View>
              <Text style={styles.modalEmptyTitle}>{t('teacher_orphan_report.no_report_title', 'No report submitted')}</Text>
              <Text style={styles.modalEmptyBody}>{t('teacher_orphan_report.no_report_body', 'Nothing was submitted for {month} yet.').replace('{month}', month?.name ?? '')}</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

/**
 * TEACHER-ORPHAN monthly report submission.
 * For a teacher who is also an orphan in the system (`role === 'teacher' &&
 * is_orphan === true`). This is intentionally separate from
 * ChildReportWizardScreen/OrphanReportScreen and from the not-yet-built
 * regular-teacher reporting feature — do not merge them. See MainTabs.tsx
 * ReportsRouter for the routing that keeps these three paths apart.
 *
 * Two modes:
 *  - 'overview' (default): current-month status card + a full 12-month
 *    submission history, always visible - so a teacher who has already
 *    submitted this month can still see (and tap into) past months, and a
 *    teacher who hasn't submitted gets a clear way in, instead of the old
 *    dead-end "You're all set" screen that hid the history entirely.
 *  - 'wizard': the existing step-by-step ReportStepWizard, only entered when
 *    starting this month's submission. Note: the backend
 *    (/teacher_report_submit) always targets the current month - there's no
 *    way to back-submit a past "Missing" month yet, so past months in the
 *    history are tap-to-view only.
 */
export default function TeacherOrphanReportScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();
  const { t } = useLocale();

  const [mode, setMode] = useState<'overview' | 'wizard'>('overview');
  const [status, setStatus] = useState<TeacherReportStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<TimelineMonth | null>(null);
  const [wizardMonth, setWizardMonth] = useState<TimelineMonth | null>(null);

  const [note, setNote] = useState('');
  const [teachingEffectiveness, setTeachingEffectiveness] = useState<number | null>(null);
  const [classroomEngagement, setClassroomEngagement] = useState<number | null>(null);
  const [professionalGrowth, setProfessionalGrowth] = useState<number | null>(null);
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [stepIndex, setStepIndex] = useState(0);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await fetchTeacherReportStatus(token);
      setStatus(data);
    } catch {
      // non-fatal - submit will surface any real error
    }
  }, [token]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const now = new Date();
  const monthName = (idx: number) => t(`common.month_${MONTH_KEYS[idx]}`, MONTH_FALLBACKS[idx]);
  const monthLabel = `${monthName(now.getMonth())} ${now.getFullYear()}`;
  const alreadySubmitted = status?.submitted_this_month ?? false;

  // Build a rolling 12-month timeline (current month first) client-side,
  // matching submitted reports from `history` / `current_report` by
  // year-month so months with no report show as "Missing" rather than being
  // silently dropped.
  const timeline: TimelineMonth[] = useMemo(() => {
    const byKey = new Map<string, TeacherMonthlyReport>();
    (status?.history ?? []).forEach((r) => {
      const [y, m] = r.report_month.split('-').map(Number);
      byKey.set(`${y}-${m}`, r);
    });
    if (status?.current_report) {
      const [y, m] = status.current_report.report_month.split('-').map(Number);
      byKey.set(`${y}-${m}`, status.current_report);
    }

    const months: TimelineMonth[] = [];
    for (let i = 0; i < HISTORY_MONTHS; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const report = byKey.get(`${y}-${m + 1}`) ?? null;
      months.push({
        key: `${y}-${m + 1}`,
        name: `${monthName(m)} ${y}`,
        submitted: !!report,
        report,
      });
    }
    return months;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const resetForm = () => {
    setNote('');
    setTeachingEffectiveness(null);
    setClassroomEngagement(null);
    setProfessionalGrowth(null);
    setPhotos([]);
    setStepIndex(0);
  };

  const openWizardFor = (m: TimelineMonth) => {
    resetForm();
    setWizardMonth(m);
    setMode('wizard');
  };

  const handleSubmit = async () => {
    if (!token || !teachingEffectiveness || !classroomEngagement || !professionalGrowth) return;
    setIsSubmitting(true);
    try {
      const [y, m] = (wizardMonth?.key ?? '').split('-').map(Number);
      const reportMonthParam = y && m ? `${y}-${String(m).padStart(2, '0')}-01` : undefined;
      await submitTeacherReport(
        token,
        {
          note,
          teaching_effectiveness_rating: teachingEffectiveness,
          classroom_engagement_rating: classroomEngagement,
          professional_growth_rating: professionalGrowth,
          report_month: reportMonthParam,
        },
        photos,
      );
      Alert.alert(
        t('teacher_orphan_report.submitted_title', 'Report submitted'),
        t('teacher_orphan_report.submitted_message', 'Your {month} report has been sent to your school admin.').replace('{month}', wizardMonth?.name ?? t('teacher_orphan_report.monthly_fallback', 'monthly')),
      );
      resetForm();
      setWizardMonth(null);
      await load();
      setMode('overview');
    } catch (err) {
      Alert.alert(t('teacher_orphan_report.error_title', 'Something went wrong'), err instanceof Error ? err.message : t('common.try_again_full', 'Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps: WizardStep[] = useMemo(
    () => [
      {
        id: 'summary',
        icon: <IconEdit />,
        title: t('teacher_orphan_report.step_summary_title', 'Teaching Summary'),
        subtitle: t('teacher_orphan_report.step_summary_subtitle', 'Share your teaching activities, lessons covered, challenges, and achievements this month.'),
        content: <NoteInput value={note} onChange={setNote} />,
        isValid: true,
      },
      {
        id: 'effectiveness',
        icon: <IconCap />,
        title: t('teacher_orphan_report.step_effectiveness_title', 'Teaching Effectiveness'),
        subtitle: t('teacher_orphan_report.step_effectiveness_subtitle', 'Rate your overall teaching effectiveness this month.'),
        content: (
          <RatingSelector
            value={teachingEffectiveness}
            onChange={setTeachingEffectiveness}
            labels={{
              1: t('teacher_orphan_report.rating_needs_improvement', 'Needs Improve.'),
              3: t('teacher_orphan_report.rating_average', 'Average'),
              5: t('teacher_orphan_report.rating_excellent', 'Excellent'),
            }}
          />
        ),
        isValid: !!teachingEffectiveness,
      },
      {
        id: 'engagement',
        icon: <IconHeart />,
        title: t('teacher_orphan_report.step_engagement_title', 'Classroom Engagement'),
        subtitle: t('teacher_orphan_report.step_engagement_subtitle', 'Rate how engaged your students were this month.'),
        content: (
          <RatingSelector
            value={classroomEngagement}
            onChange={setClassroomEngagement}
            labels={{
              1: t('teacher_orphan_report.rating_low', 'Low'),
              3: t('teacher_orphan_report.rating_average', 'Average'),
              5: t('teacher_orphan_report.rating_very_high', 'Very High'),
            }}
          />
        ),
        isValid: !!classroomEngagement,
      },
      {
        id: 'growth',
        icon: <IconTrend />,
        title: t('teacher_orphan_report.step_growth_title', 'Professional Growth'),
        subtitle: t('teacher_orphan_report.step_growth_subtitle', 'Rate your professional growth this month.'),
        content: (
          <RatingSelector
            value={professionalGrowth}
            onChange={setProfessionalGrowth}
            labels={{
              1: t('teacher_orphan_report.rating_minimal', 'Minimal'),
              3: t('teacher_orphan_report.rating_moderate', 'Moderate'),
              5: t('teacher_orphan_report.rating_significant', 'Significant'),
            }}
          />
        ),
        isValid: !!professionalGrowth,
      },
      {
        id: 'photos',
        icon: <IconImage />,
        title: t('teacher_orphan_report.step_photos_title', 'Add Photos'),
        subtitle: t('teacher_orphan_report.step_photos_subtitle', 'Optional — add photos of your teaching activities, achievements, or classroom moments.'),
        content: <PhotoPicker photos={photos} onChange={setPhotos} />,
        isValid: true,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [note, teachingEffectiveness, classroomEngagement, professionalGrowth, photos, t],
  );

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={EMERALD} />
      </View>
    );
  }

  if (mode === 'wizard') {
    const currentKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
    const isMakeUp = !!wizardMonth && wizardMonth.key !== currentKey;
    return (
      <ReportStepWizard
        headerTitle={t('teacher_orphan_report.header_title', 'Monthly Report')}
        monthLabel={wizardMonth?.name ?? monthLabel}
        badgeLabel={isMakeUp ? t('teacher_orphan_report.badge_makeup', 'Make-Up Report') : t('teacher_orphan_report.header_title', 'Monthly Report')}
        steps={steps}
        currentStepIndex={stepIndex}
        onStepChange={setStepIndex}
        onBackPress={() => {
          setWizardMonth(null);
          setMode('overview');
        }}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    );
  }

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Polyline points="15 5 8 12 15 19" stroke={EMERALD} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={styles.backText}>{t('common.back', 'Back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('teacher_orphan_report.header_title', 'Monthly Report')}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Current-month status card */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View style={styles.iconChip}>
              <IconDoc />
            </View>
            <View style={styles.flex1}>
              <Text style={styles.cardTitle}>
                {alreadySubmitted ? t('teacher_orphan_report.all_set', "You're all set") : t('teacher_orphan_report.submit_prompt', 'Submit Your Monthly Report')}
              </Text>
              <Text style={styles.cardMonth}>{monthLabel}</Text>
            </View>
          </View>
          <View style={styles.divider} />

          {alreadySubmitted ? (
            <View style={styles.doneBox}>
              <Text style={styles.doneBody}>
                {t('teacher_orphan_report.already_submitted', 'Your teaching report for {month} has already been submitted. Check your submission history below.').replace('{month}', monthLabel)}
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.startBody}>
                {t('teacher_orphan_report.start_body', 'Share your teaching summary and rate your month to submit your report.')}
              </Text>
              <TouchableOpacity
                style={styles.submitButton}
                activeOpacity={0.9}
                onPress={() => openWizardFor(timeline[0])}
              >
                <IconEdit color="#FFFFFF" />
                <Text style={styles.submitButtonText}>{t('teacher_orphan_report.start_report', 'Start Report')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Submission history */}
        <View style={styles.card}>
          <View style={styles.historyHead}>
            <View style={styles.sectionHeadInline}>
              <View style={styles.historyHeadIconChip}>
                <IconClock color="#FFFFFF" />
              </View>
              <Text style={styles.historyTitle}>{t('teacher_orphan_report.history_title', 'Submission History')}</Text>
            </View>
          </View>
          <Text style={styles.historyHint}>{t('teacher_orphan_report.history_hint', 'Tap a missing month to submit a make-up report.')}</Text>

          <View style={styles.timelineOuter}>
            <View style={styles.timelineLine} />
            {timeline.map((m, idx) => (
              <TouchableOpacity
                key={m.key}
                style={[styles.timelineRow, idx === timeline.length - 1 && styles.timelineRowLast]}
                activeOpacity={0.7}
                onPress={() => (m.submitted ? setSelectedMonth(m) : openWizardFor(m))}
              >
                <View style={styles.timelineNodeCol}>
                  {m.submitted ? (
                    <View style={styles.timelineNodeFilled}>
                      <IconCheck size={13} />
                    </View>
                  ) : (
                    <View style={styles.timelineNodeHollow} />
                  )}
                </View>

                <View style={[styles.timelineCard, m.submitted && styles.timelineCardHighlighted]}>
                  <View style={[styles.calChip, m.submitted ? styles.calChipDark : styles.calChipMissing]}>
                    <IconCalendar color={m.submitted ? '#FFFFFF' : DANGER} />
                  </View>
                  <View style={styles.flex1}>
                    <Text style={styles.historyMonth}>{m.name}</Text>
                    {m.submitted ? (
                      <Text style={styles.historySubmittedOn}>{t('teacher_orphan_report.submitted', 'Submitted')}</Text>
                    ) : (
                      <Text style={styles.historyMissing}>{t('teacher_orphan_report.missing', 'Missing')}</Text>
                    )}
                  </View>
                  <View style={[styles.statusBadge, m.submitted ? styles.statusBadgeOnTime : styles.statusBadgePending]}>
                    <Text style={[styles.statusBadgeText, m.submitted ? styles.statusBadgeTextOnTime : styles.statusBadgeTextPending]}>
                      {m.submitted ? t('teacher_orphan_report.on_time', 'On time') : t('teacher_orphan_report.make_up', 'Make up')}
                    </Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      <TeacherReportDetailModal
        visible={!!selectedMonth}
        month={selectedMonth}
        onClose={() => setSelectedMonth(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: 'transparent' },
  flex1: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: GLASS_SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: GLASS_BORDER,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', minWidth: 72 },
  backText: { color: EMERALD, fontSize: 16, fontWeight: '600', marginLeft: 2 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: INK },

  scroll: { padding: 16, paddingBottom: 40 },

  card: {
    backgroundColor: GLASS_SURFACE,
    borderRadius: 22,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#0B1F13',
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { fontSize: 19, fontWeight: '700', color: INK, lineHeight: 24 },
  cardMonth: { fontSize: 14, color: EMERALD, fontWeight: '600', marginTop: 2 },
  divider: { height: 1, backgroundColor: GLASS_BORDER, marginVertical: 18 },
  iconChip: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  doneBox: { paddingVertical: 4 },
  doneBody: { fontSize: 14, color: SUBTLE, lineHeight: 20 },
  startBody: { fontSize: 14, color: SUBTLE, lineHeight: 20, marginBottom: 18 },

  submitButton: {
    backgroundColor: EMERALD,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  historyHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  sectionHeadInline: { flexDirection: 'row', alignItems: 'center' },
  historyTitle: { fontSize: 17, fontWeight: '700', color: INK, marginLeft: 10 },
  historyHint: { fontSize: 12.5, color: SUBTLE, marginBottom: 10, marginLeft: 44 },
  historyHeadIconChip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
  },

  calChip: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  calChipDark: { backgroundColor: INK },
  calChipMissing: { backgroundColor: DANGER_SOFT },
  historyMonth: { fontSize: 15, fontWeight: '700', color: INK },
  historySubmittedOn: { fontSize: 12.5, color: EMERALD, fontWeight: '600', marginTop: 2 },
  historyMissing: { fontSize: 12.5, color: DANGER, fontWeight: '600', marginTop: 2 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },

  timelineOuter: { position: 'relative', marginTop: 6 },
  timelineLine: {
    position: 'absolute',
    left: 19,
    top: 20,
    bottom: 20,
    width: 0,
    borderLeftWidth: 1.5,
    borderColor: '#D9DCE0',
    borderStyle: 'solid',
  },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  timelineRowLast: { marginBottom: 0 },
  timelineNodeCol: { width: 40, alignItems: 'center', paddingTop: 20 },
  timelineNodeFilled: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineNodeHollow: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: GLASS_SURFACE,
    borderWidth: 2,
    borderColor: '#C7CBD1',
  ...SHADOW.level1,
  },
  timelineCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GLASS_SURFACE,
    borderRadius: 16,
    padding: 14,
  ...SHADOW.level1,
  },
  timelineCardHighlighted: { backgroundColor: '#F4FAF7', borderColor: '#DCEEE3' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginLeft: 8 },
  statusBadgeOnTime: { backgroundColor: EMERALD_SOFT },
  statusBadgePending: { backgroundColor: DANGER_SOFT },
  statusBadgeText: { fontSize: 11.5, fontWeight: '700' },
  statusBadgeTextOnTime: { color: EMERALD },
  statusBadgeTextPending: { color: DANGER },
  chevron: { fontSize: 20, color: '#C4C9CF', fontWeight: '400', marginLeft: 6 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(12,16,14,0.45)', justifyContent: 'flex-end' },
  modalBackdropTouch: { ...StyleSheet.absoluteFillObject },
  modalCard: {
    backgroundColor: GLASS_SURFACE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 34,
    maxHeight: '80%',
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: INK },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: { paddingBottom: 4 },
  modalStatusRow: { flexDirection: 'row', alignItems: 'center' },
  modalStatusText: { fontSize: 14, fontWeight: '600', color: EMERALD },
  modalSubmittedBy: { fontSize: 12.5, color: SUBTLE, marginTop: 4, marginLeft: 20 },
  modalRatingsRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  modalRatingBox: {
    flex: 1,
    backgroundColor: '#FBFCFD',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalRatingLabel: { fontSize: 11.5, color: SUBTLE, fontWeight: '600', marginBottom: 6 },
  modalRatingValue: { fontSize: 18, color: INK, fontWeight: '700' },
  modalNoteWrap: { marginTop: 20 },
  modalSectionLabel: { fontSize: 12.5, color: SUBTLE, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase' },
  modalNoteText: { fontSize: 14.5, color: INK, lineHeight: 21 },
  modalPhoto: { width: 88, height: 88, borderRadius: 14, marginRight: 10, backgroundColor: '#F0F0F0' },
  modalEmptyWrap: { alignItems: 'center', paddingVertical: 28 },
  modalEmptyTitle: { fontSize: 16, fontWeight: '700', color: INK, marginTop: 14 },
  modalEmptyBody: { fontSize: 13.5, color: SUBTLE, marginTop: 6, textAlign: 'center', lineHeight: 19 },
});
