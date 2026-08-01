import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Modal, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path, Line, Circle, Polyline, Rect } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { useOfflineQueue } from '../../context/OfflineQueueContext';
import { enqueueOrphanReportSubmit } from '../../services/offlineQueue';
import {
  fetchReportStatus,
  submitReport,
  ReportStatus,
  TimelineEntry,
  MonthlyReport,
  PickedPhoto,
} from '../../services/orphanService';
import ReportStepWizard, { WizardStep } from '../../components/ReportStepWizard';
import { NoteInput, RatingSelector, PhotoPicker } from '../../components/ReportFormControls';
import PhotoLightbox from '../../components/PhotoLightbox';

const EMERALD = '#0F9D58';
const EMERALD_SOFT = '#E7F5EC';
const INK = '#1C1C1E';
const SUBTLE = '#8A9099';
const HAIRLINE = '#EDEEF0';
const CANVAS = '#F6F7F9';
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
const MONTH_ABBR_FALLBACKS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const HISTORY_PREVIEW_COUNT = 5;

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
function IconChevronLeft() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Polyline points="15 5 8 12 15 19" stroke={EMERALD} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

interface TimelineMonth {
  key: string;
  name: string;
  submitted: boolean;
  submittedOn: string | null;
  report: MonthlyReport | null;
}

function ReportDetailModal({
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
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

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
                <Text style={styles.modalStatusText}>
                  {month?.submittedOn ? t('orphan_report.submitted_on', 'Submitted on {date}').replace('{date}', month.submittedOn) : t('orphan_report.submitted', 'Submitted')}
                </Text>
              </View>
              {report.submitted_by ? (
                <Text style={styles.modalSubmittedBy}>{t('orphan_report.submitted_by', 'By {name}').replace('{name}', report.submitted_by)}</Text>
              ) : null}

              <View style={styles.modalRatingsRow}>
                <View style={styles.modalRatingBox}>
                  <Text style={styles.modalRatingLabel}>{t('orphan_report.academic', 'Academic')}</Text>
                  <Text style={styles.modalRatingValue}>
                    {report.academic_rating != null ? `${report.academic_rating}/5` : '—'}
                  </Text>
                </View>
                <View style={styles.modalRatingBox}>
                  <Text style={styles.modalRatingLabel}>{t('orphan_report.wellbeing', 'Wellbeing')}</Text>
                  <Text style={styles.modalRatingValue}>
                    {report.wellbeing_rating != null ? `${report.wellbeing_rating}/5` : '—'}
                  </Text>
                </View>
              </View>

              {report.note ? (
                <View style={styles.modalNoteWrap}>
                  <Text style={styles.modalSectionLabel}>{t('orphan_report.note_label', 'Note')}</Text>
                  <Text style={styles.modalNoteText}>{report.note}</Text>
                </View>
              ) : null}

              {report.photos?.length ? (
                <View style={styles.modalNoteWrap}>
                  <Text style={styles.modalSectionLabel}>{t('orphan_report.photos_label', 'Photos')}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {report.photos.map((uri, idx) => (
                      <TouchableOpacity key={`${uri}-${idx}`} activeOpacity={0.85} onPress={() => setLightboxIndex(idx)}>
                        <Image source={{ uri }} style={styles.modalPhoto} />
                      </TouchableOpacity>
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
              <Text style={styles.modalEmptyTitle}>{t('orphan_report.no_report_title', 'No report submitted')}</Text>
              <Text style={styles.modalEmptyBody}>
                {t('orphan_report.no_report_body', 'Nothing was submitted for {month} yet.').replace('{month}', month?.name ?? '')}
              </Text>
            </View>
          )}
        </View>
      </View>
      <PhotoLightbox
        visible={lightboxIndex !== null}
        photos={report?.photos ?? []}
        initialIndex={lightboxIndex ?? 0}
        onClose={() => setLightboxIndex(null)}
      />
    </Modal>
  );
}

/**
 * CHILD/ORPHAN monthly report submission - rebuilt on the same
 * ReportStepWizard + ReportFormControls used by TeacherOrphanReportScreen,
 * instead of a single long scrolling form, for a consistent step-by-step
 * experience across both report types. Photos are required here (unlike
 * the teacher version, which keeps them optional) and are compressed to
 * PhotoPicker's 200KB-per-image limit automatically (see imagePrep.ts).
 *
 * Two modes, mirroring TeacherOrphanReportScreen:
 *  - 'overview' (default): current-month status card + full submission
 *    history timeline.
 *  - 'wizard': step-by-step form, entered for the current month or, via a
 *    tapped "Missing" month in history, as a make-up report for that past
 *    month (orphan_report_submit honors report_month - see orphanService.ts).
 */
export default function OrphanReportScreen() {
  const navigation = useNavigation();
  const { token } = useAuth();
  const { t } = useLocale();
  const { isOnline, actions: queuedActions } = useOfflineQueue();
  const pendingReportCount = queuedActions.filter((a) => a.kind === 'orphan_report_submit').length;

  const [mode, setMode] = useState<'overview' | 'wizard'>('overview');
  const [status, setStatus] = useState<ReportStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [note, setNote] = useState('');
  const [academicRating, setAcademicRating] = useState<number | null>(null);
  const [wellbeingRating, setWellbeingRating] = useState<number | null>(null);
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [stepIndex, setStepIndex] = useState(0);

  const [selectedMonth, setSelectedMonth] = useState<TimelineMonth | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [wizardMonth, setWizardMonth] = useState<TimelineMonth | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const data = await fetchReportStatus(token);
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('orphan_report.load_error', 'Failed to load report status.'));
    }
  }, [token, t]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const prevPendingReportCount = React.useRef(pendingReportCount);
  useEffect(() => {
    if (prevPendingReportCount.current > 0 && pendingReportCount === 0) {
      load();
    }
    prevPendingReportCount.current = pendingReportCount;
  }, [pendingReportCount, load]);

  const now = new Date();
  const monthName = (idx: number) => t(`common.month_${MONTH_KEYS[idx]}`, MONTH_FALLBACKS[idx]);
  const monthAbbr = (idx: number) => t(`common.month_abbr_${MONTH_KEYS[idx]}`, MONTH_ABBR_FALLBACKS[idx]);
  const currentMonthLabel = `${monthName(now.getMonth())} ${now.getFullYear()}`;
  const alreadySubmitted = status?.submitted_this_month ?? false;

  // Normalize the status into a full timeline regardless of whether the
  // backend returns a rolling `timeline` (preferred) or only a `history`
  // array of submitted reports - unchanged from the previous version.
  const timeline: TimelineMonth[] = useMemo(() => {
    const raw: TimelineEntry[] =
      status?.timeline ??
      (status?.history ?? []).map((r) => ({
        report_month: r.report_month,
        submitted: true,
        report: r,
      }));

    return raw
      .map((entry) => {
        const [year, month] = entry.report_month.split('-').map(Number);
        const submittedOn = entry.report?.submitted_at ?? entry.report?.created_at ?? null;
        let onLabel: string | null = null;
        if (submittedOn) {
          const d = new Date(submittedOn);
          if (!isNaN(d.getTime())) {
            const hours24 = d.getHours();
            const period = hours24 >= 12 ? t('common.pm', 'PM') : t('common.am', 'AM');
            const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
            const minutes = String(d.getMinutes()).padStart(2, '0');
            onLabel = `${monthAbbr(d.getMonth())} ${d.getDate()}, ${d.getFullYear()} • ${hours12}:${minutes} ${period}`;
          }
        }
        return {
          key: entry.report_month,
          name: `${monthName(month - 1)} ${year}`,
          submitted: entry.submitted,
          submittedOn: onLabel,
          report: entry.report,
        };
      })
      .reverse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const visibleTimeline = showAllHistory ? timeline : timeline.slice(0, HISTORY_PREVIEW_COUNT);

  const resetForm = () => {
    setNote('');
    setAcademicRating(null);
    setWellbeingRating(null);
    setPhotos([]);
    setStepIndex(0);
  };

  const openWizardFor = (m: TimelineMonth | null) => {
    resetForm();
    setWizardMonth(m);
    setMode('wizard');
  };

  const handleSubmit = async () => {
    if (!token || !academicRating || !wellbeingRating || photos.length === 0) return;
    const [y, m] = (wizardMonth?.key ?? '').split('-').map(Number);
    const reportMonthParam = y && m ? `${y}-${String(m).padStart(2, '0')}-01` : undefined;
    const fields = {
      note,
      academic_rating: academicRating,
      wellbeing_rating: wellbeingRating,
      report_month: reportMonthParam,
    };
    const targetMonthLabel = wizardMonth?.name ?? currentMonthLabel;

    if (!isOnline) {
      enqueueOrphanReportSubmit(token, fields, photos);
      Alert.alert(
        t('orphan_report.queued_title', "You're offline"),
        t('orphan_report.queued_message', "Your report will be submitted automatically once you're back online."),
      );
      resetForm();
      setWizardMonth(null);
      setMode('overview');
      return;
    }

    setIsSubmitting(true);
    try {
      await submitReport(token, fields, photos);
      Alert.alert(
        t('orphan_report.submitted_title', 'Report submitted'),
        t('orphan_report.submitted_message', 'Your {month} report has been sent to your school admin.').replace('{month}', targetMonthLabel),
      );
      resetForm();
      setWizardMonth(null);
      await load();
      setMode('overview');
    } catch (err) {
      if (err instanceof TypeError) {
        enqueueOrphanReportSubmit(token, fields, photos);
        Alert.alert(
          t('orphan_report.queued_title', "You're offline"),
          t('orphan_report.queued_message', "Your report will be submitted automatically once you're back online."),
        );
        resetForm();
        setWizardMonth(null);
        setMode('overview');
      } else {
        Alert.alert(t('orphan_report.error_title', 'Something went wrong'), err instanceof Error ? err.message : t('common.try_again_full', 'Please try again.'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps: WizardStep[] = useMemo(
    () => [
      {
        id: 'summary',
        icon: <IconEdit />,
        title: t('orphan_report.step_summary_title', 'How was your month?'),
        subtitle: t('orphan_report.step_summary_subtitle', 'Tell us about your studies, activities, and how you are feeling.'),
        content: <NoteInput value={note} onChange={setNote} maxLength={500} placeholder={t('orphan_report.note_placeholder', 'Write a short note about your month...')} />,
        isValid: true,
      },
      {
        id: 'academic',
        icon: <IconCap />,
        title: t('orphan_report.academic_rating_title', 'Academic Rating'),
        subtitle: t('orphan_report.academic_rating_subtitle', 'Rate your academic performance this month.'),
        content: (
          <RatingSelector
            value={academicRating}
            onChange={setAcademicRating}
            labels={{
              1: t('orphan_report.rating_poor', 'Poor'),
              3: t('orphan_report.rating_average', 'Average'),
              5: t('orphan_report.rating_excellent', 'Excellent'),
            }}
          />
        ),
        isValid: !!academicRating,
      },
      {
        id: 'wellbeing',
        icon: <IconHeart />,
        title: t('orphan_report.wellbeing_rating_title', 'Wellbeing Rating'),
        subtitle: t('orphan_report.wellbeing_rating_subtitle', 'Rate your overall wellbeing this month.'),
        content: (
          <RatingSelector
            value={wellbeingRating}
            onChange={setWellbeingRating}
            labels={{
              1: t('orphan_report.rating_very_low', 'Very Low'),
              3: t('orphan_report.rating_average', 'Average'),
              5: t('orphan_report.rating_very_high', 'Very High'),
            }}
          />
        ),
        isValid: !!wellbeingRating,
      },
      {
        id: 'photos',
        icon: <IconImage />,
        title: t('orphan_report.photos_title', 'Add Photos'),
        subtitle: t('orphan_report.photos_subtitle_required', 'Required — add at least one photo of your activities, achievements or study progress.'),
        content: <PhotoPicker photos={photos} onChange={setPhotos} maxPhotos={5} required />,
        // Photos are required for the child report (unlike the optional
        // teacher version) - the wizard's Submit button stays disabled
        // until at least one photo is attached.
        isValid: photos.length > 0,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [note, academicRating, wellbeingRating, photos, t],
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
        headerTitle={t('orphan_report.header_title', 'Monthly Report')}
        monthLabel={wizardMonth?.name ?? currentMonthLabel}
        badgeLabel={isMakeUp ? t('orphan_report.badge_makeup', 'Make-Up Report') : t('orphan_report.header_title', 'Monthly Report')}
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
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <IconChevronLeft />
          <Text style={styles.backText}>{t('common.back', 'Back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('orphan_report.header_title', 'Monthly Report')}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {pendingReportCount > 0 ? (
          <View style={styles.pendingSyncBanner}>
            <IconClock color={EMERALD} />
            <Text style={styles.pendingSyncText}>
              {isOnline
                ? t('orphan_report.pending_sync_online', 'Sending your queued report…')
                : t('orphan_report.pending_sync_offline', "A report is waiting to send once you're back online.")}
            </Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={load}>
              <Text style={styles.retryText}>{t('common.try_again', 'Try again')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Current-month status card */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View style={styles.iconChip}>
              <IconDoc />
            </View>
            <View style={styles.flex1}>
              <Text style={styles.cardTitle}>
                {alreadySubmitted ? t('orphan_report.all_set', "You're all set") : t('orphan_report.submit_prompt', 'Submit Your Monthly Report')}
              </Text>
              <Text style={styles.cardMonth}>{currentMonthLabel}</Text>
            </View>
          </View>
          <View style={styles.divider} />

          {alreadySubmitted ? (
            <View style={styles.doneBox}>
              <Text style={styles.doneBody}>
                {t('orphan_report.already_submitted', 'Your report for this month is submitted. Check your submission history below.')}
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.startBody}>
                {t('orphan_report.start_body', 'Share how your month went and add a photo to submit your report.')}
              </Text>
              <TouchableOpacity style={styles.submitButton} activeOpacity={0.9} onPress={() => openWizardFor(null)}>
                <IconEdit color="#FFFFFF" />
                <Text style={styles.submitButtonText}>{t('orphan_report.start_report', 'Start Report')}</Text>
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
              <Text style={styles.historyTitle}>{t('orphan_report.history_title', 'Submission History')}</Text>
            </View>
            {timeline.length > HISTORY_PREVIEW_COUNT ? (
              <TouchableOpacity hitSlop={8} onPress={() => setShowAllHistory((v) => !v)}>
                <Text style={styles.viewAll}>{showAllHistory ? t('orphan_report.show_less', 'Show less') : t('orphan_report.view_all', 'View All')} ›</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <Text style={styles.historyHint}>{t('orphan_report.history_hint', 'Tap a missing month to submit a make-up report.')}</Text>

          {visibleTimeline.length === 0 ? (
            <Text style={styles.emptyHistory}>{t('orphan_report.empty_history', 'No reports yet. Your first submission will show up here.')}</Text>
          ) : (
            <View style={styles.timelineOuter}>
              <View style={styles.timelineLine} />
              {visibleTimeline.map((m, idx) => (
                <TouchableOpacity
                  key={m.key}
                  style={[styles.timelineRow, idx === visibleTimeline.length - 1 && styles.timelineRowLast]}
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
                        <Text style={styles.historySubmittedOn}>{t('orphan_report.submitted', 'Submitted')}</Text>
                      ) : (
                        <Text style={styles.historyMissing}>{t('orphan_report.missing', 'Missing')}</Text>
                      )}
                    </View>
                    <View style={[styles.statusBadge, m.submitted ? styles.statusBadgeOnTime : styles.statusBadgePending]}>
                      <Text style={[styles.statusBadgeText, m.submitted ? styles.statusBadgeTextOnTime : styles.statusBadgeTextPending]}>
                        {m.submitted ? t('orphan_report.on_time', 'On time') : t('orphan_report.make_up', 'Make up')}
                      </Text>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <ReportDetailModal visible={!!selectedMonth} month={selectedMonth} onClose={() => setSelectedMonth(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: CANVAS },
  flex1: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', minWidth: 72 },
  backText: { color: EMERALD, fontSize: 16, fontWeight: '600', marginLeft: 2 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: INK },

  scroll: { padding: 16, paddingBottom: 40 },
  pendingSyncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: EMERALD_SOFT,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  pendingSyncText: { flex: 1, fontSize: 13, color: EMERALD, fontWeight: '600' },

  errorBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: DANGER_SOFT,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  errorText: { color: DANGER, fontSize: 13, flex: 1, marginRight: 8 },
  retryText: { color: DANGER, fontWeight: '700', fontSize: 13 },

  card: {
    backgroundColor: '#FFFFFF',
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
  divider: { height: 1, backgroundColor: HAIRLINE, marginVertical: 18 },
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
  viewAll: { color: EMERALD, fontSize: 14, fontWeight: '600' },
  emptyHistory: { fontSize: 13, color: SUBTLE, paddingVertical: 14, lineHeight: 19 },
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
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#C7CBD1',
  },
  timelineCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
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
    backgroundColor: '#FFFFFF',
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
  modalRatingsRow: { flexDirection: 'row', gap: 12, marginTop: 18 },
  modalRatingBox: {
    flex: 1,
    backgroundColor: '#FBFCFD',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalRatingLabel: { fontSize: 12, color: SUBTLE, fontWeight: '600', marginBottom: 6 },
  modalRatingValue: { fontSize: 18, color: INK, fontWeight: '700' },
  modalNoteWrap: { marginTop: 20 },
  modalSectionLabel: { fontSize: 12.5, color: SUBTLE, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase' },
  modalNoteText: { fontSize: 14.5, color: INK, lineHeight: 21 },
  modalPhoto: {
    width: 88,
    height: 88,
    borderRadius: 14,
    marginRight: 10,
    backgroundColor: '#F0F0F0',
  },
  modalEmptyWrap: { alignItems: 'center', paddingVertical: 28 },
  modalEmptyTitle: { fontSize: 16, fontWeight: '700', color: INK, marginTop: 14 },
  modalEmptyBody: { fontSize: 13.5, color: SUBTLE, marginTop: 6, textAlign: 'center', lineHeight: 19 },
});
