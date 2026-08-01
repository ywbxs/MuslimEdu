import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path, Circle, Rect, Line, Polyline } from 'react-native-svg';
import { launchImageLibrary } from 'react-native-image-picker';
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
import { Skeleton, SkeletonCircle } from '../../components/Skeleton';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHADOW } from '../../theme/spatial';
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

const MAX_NOTE = 500;
const MAX_PHOTOS = 5;

// --- Inline stroke icons ---
function IconDoc({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M6 3h8l4 4v14H6z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M14 3v4h4" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Line x1={9} y1={12} x2={15} y2={12} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={9} y1={16} x2={13} y2={16} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function IconEdit({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M4 20h4L18 10l-4-4L4 16v4z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Line x1={13} y1={7} x2={17} y2={11} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function IconCap({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M2 9l10-4 10 4-10 4L2 9z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M6 11v4c0 1.1 2.7 2.5 6 2.5s6-1.4 6-2.5v-4" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconHeart({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 20s-7-4.35-7-9.5A3.5 3.5 0 0 1 12 7a3.5 3.5 0 0 1 7 3.5C19 15.65 12 20 12 20z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
function IconImage({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={5} width={18} height={14} rx={2} stroke={color} strokeWidth={2} />
      <Circle cx={8.5} cy={10} r={1.5} fill={color} />
      <Path d="M5 17l4.5-4.5L13 16l3-3 3 3.5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconSend({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M21 3L10.5 13.5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M21 3l-6.5 18-4-8-8-4L21 3z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconCalendar({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={5} width={16} height={16} rx={2} stroke={color} strokeWidth={2} />
      <Line x1={4} y1={9} x2={20} y2={9} stroke={color} strokeWidth={2} />
      <Line x1={8} y1={3} x2={8} y2={6} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={16} y1={3} x2={16} y2={6} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function IconClock({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} />
      <Polyline points="12 7 12 12 15 14" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconPlus({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Line x1={12} y1={5} x2={12} y2={19} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={5} y1={12} x2={19} y2={12} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function IconClose({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Line x1={6} y1={6} x2={18} y2={18} stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Line x1={18} y1={6} x2={6} y2={18} stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}
function IconCheck({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline points="5 13 10 18 19 7" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function SectionHead({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.sectionHead}>
      <View style={styles.iconChip}>{icon}</View>
      <View style={styles.flex1}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSub}>{subtitle}</Text>
      </View>
    </View>
  );
}

function RatingSelector({
  value,
  onChange,
  labels,
}: {
  value: number | null;
  onChange: (v: number) => void;
  labels: Record<number, string>;
}) {
  return (
    <View style={styles.ratingRow}>
      {[1, 2, 3, 4, 5].map((n) => {
        const selected = value === n;
        return (
          <TouchableOpacity key={n} style={styles.ratingCell} onPress={() => onChange(n)} activeOpacity={0.8}>
            <View style={[styles.ratingCircle, selected && styles.ratingCircleActive]}>
              <Text style={[styles.ratingNum, selected && styles.ratingNumActive]}>{n}</Text>
            </View>
            {labels[n] ? <Text style={styles.ratingLabel}>{labels[n]}</Text> : <View style={styles.ratingLabelSpacer} />}
          </TouchableOpacity>
        );
      })}
    </View>
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

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <TouchableOpacity style={styles.modalBackdropTouch} activeOpacity={1} onPress={onClose} />
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{month?.name ?? ''}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.modalCloseBtn}>
              <IconClose color={SUBTLE} />
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
              <Text style={styles.modalEmptyTitle}>{t('orphan_report.no_report_title', 'No report submitted')}</Text>
              <Text style={styles.modalEmptyBody}>
                {t('orphan_report.no_report_body', 'Nothing was submitted for {month} yet.').replace('{month}', month?.name ?? '')}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

export default function OrphanReportScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();
  const { t } = useLocale();
  const { isOnline, actions: queuedActions } = useOfflineQueue();
  const pendingReportCount = queuedActions.filter((a) => a.kind === 'orphan_report_submit').length;

  const [status, setStatus] = useState<ReportStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [note, setNote] = useState('');
  const [academicRating, setAcademicRating] = useState<number | null>(null);
  const [wellbeingRating, setWellbeingRating] = useState<number | null>(null);
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState<TimelineMonth | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);
  // Set when the child taps a "Missing" month in the submission history -
  // the form above switches to targeting that past month instead of the
  // current one, mirroring TeacherOrphanReportScreen's make-up-report flow.
  const [makeUpMonth, setMakeUpMonth] = useState<TimelineMonth | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const data = await fetchReportStatus(token);
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('orphan_report.load_error', 'Failed to load report status.'));
    }
  }, [token]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  // A queued report that finishes sending in the background (app stays
  // open while connectivity returns) won't show up until the status is
  // refetched - do that the moment the queue for this screen drains.
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

  const pickPhotos = async () => {
    if (photos.length >= MAX_PHOTOS) return;
    const result = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: MAX_PHOTOS - photos.length,
      quality: 0.7,
    });
    if (result.didCancel || result.errorCode || !result.assets) return;
    const picked: PickedPhoto[] = result.assets
      .filter((a) => !!a.uri)
      .map((a) => ({
        uri: a.uri as string,
        fileName: a.fileName ?? null,
        type: a.type ?? null,
      }));
    setPhotos((prev) => [...prev, ...picked].slice(0, MAX_PHOTOS));
  };

  const removePhoto = (uri: string) => setPhotos((prev) => prev.filter((p) => p.uri !== uri));

  const resetForm = () => {
    setNote('');
    setAcademicRating(null);
    setWellbeingRating(null);
    setPhotos([]);
    setMakeUpMonth(null);
  };

  const handleSubmit = async () => {
    if (!token) return;
    if (!academicRating || !wellbeingRating) {
      Alert.alert(t('orphan_report.almost_done', 'Almost done'), t('orphan_report.select_ratings', 'Please select both an academic and wellbeing rating.'));
      return;
    }
    // Reconstruct "YYYY-MM-01" from the tapped timeline entry's key so a
    // make-up submission targets that past month instead of whatever month
    // the backend defaults new submissions to - same approach as
    // TeacherOrphanReportScreen.handleSubmit.
    const [y, m] = (makeUpMonth?.key ?? '').split('-').map(Number);
    const reportMonthParam = y && m ? `${y}-${String(m).padStart(2, '0')}-01` : undefined;
    const fields = {
      note,
      academic_rating: academicRating,
      wellbeing_rating: wellbeingRating,
      report_month: reportMonthParam,
    };
    const targetMonthLabel = makeUpMonth?.name ?? currentMonthLabel;

    // Already known offline - don't bother attempting the request, queue it
    // straight away so it sends automatically once connectivity returns.
    if (!isOnline) {
      enqueueOrphanReportSubmit(token, fields, photos);
      Alert.alert(
        t('orphan_report.queued_title', "You're offline"),
        t('orphan_report.queued_message', "Your report will be submitted automatically once you're back online."),
      );
      resetForm();
      return;
    }

    setIsSubmitting(true);
    try {
      await submitReport(token, fields, photos);
      Alert.alert(
        t('orphan_report.submitted_title', 'Report submitted'),
        t('orphan_report.submitted_message', 'Your {month} report has been sent to your school admin.').replace('{month}', targetMonthLabel),
      );
      await load();
      resetForm();
    } catch (err) {
      // A dropped connection mid-submit looks like a plain TypeError from
      // fetch (RN: "Network request failed") - queue it instead of losing
      // the note/ratings/photos the user just filled in.
      if (err instanceof TypeError) {
        enqueueOrphanReportSubmit(token, fields, photos);
        Alert.alert(
          t('orphan_report.queued_title', "You're offline"),
          t('orphan_report.queued_message', "Your report will be submitted automatically once you're back online."),
        );
        resetForm();
      } else {
        Alert.alert(t('orphan_report.error_title', 'Something went wrong'), err instanceof Error ? err.message : t('common.try_again_full', 'Please try again.'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const openMakeUp = (m: TimelineMonth) => {
    setNote('');
    setAcademicRating(null);
    setWellbeingRating(null);
    setPhotos([]);
    setMakeUpMonth(m);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  // Normalize the status into a full 12-month timeline regardless of whether
  // the backend returns a rolling `timeline` (preferred) or only a `history`
  // array of submitted reports. The backend already sends the whole year
  // (oldest -> newest); we keep the underlying `report` on each entry so a
  // tapped row can show the submitted note/ratings/photos, and reverse the
  // order so the most recent month leads the list.
  const timeline: TimelineMonth[] = (() => {
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
  })();

  const alreadySubmitted = status?.submitted_this_month ?? false;
  const HISTORY_PREVIEW_COUNT = 5;
  const visibleTimeline = showAllHistory ? timeline : timeline.slice(0, HISTORY_PREVIEW_COUNT);
  // A month reached via "make up" is by definition a past Missing month, so
  // it's never already submitted - only fall back to the current month's
  // done/not-done state when no make-up month is active.
  const showDoneBox = !makeUpMonth && alreadySubmitted;
  const formTitle = makeUpMonth
    ? t('orphan_report.make_up_prompt', 'Submit Make-Up Report')
    : t('orphan_report.submit_prompt', 'Submit Your Monthly Report');
  const formMonthLabel = makeUpMonth?.name ?? currentMonthLabel;

  return (
    <View style={styles.flex}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Polyline points="15 5 8 12 15 19" stroke={EMERALD} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={styles.backText}>{t('common.back', 'Back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('orphan_report.header_title', 'Monthly Report')}</Text>
        <View style={styles.backBtn} />
      </View>

      {isLoading ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.card}>
            <Skeleton width={180} height={22} style={{ marginBottom: 8 }} />
            <Skeleton width={100} height={14} style={{ marginBottom: 20 }} />
            <Skeleton width={'100%'} height={90} style={{ marginBottom: 20, borderRadius: 14 }} />
            <View style={styles.ratingRow}>
              {[0, 1, 2, 3, 4].map((i) => (
                <SkeletonCircle key={i} size={44} />
              ))}
            </View>
          </View>
        </ScrollView>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={load}>
            <Text style={styles.retryText}>{t('common.try_again', 'Try again')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
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
          {/* Submission form card */}
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.iconChip}>
                <IconDoc color={EMERALD} />
              </View>
              <View style={styles.flex1}>
                <Text style={styles.cardTitle}>{formTitle}</Text>
                <Text style={styles.cardMonth}>{formMonthLabel}</Text>
              </View>
            </View>
            <View style={styles.divider} />

            {makeUpMonth ? (
              <View style={styles.makeUpBanner}>
                <Text style={styles.makeUpBannerText}>
                  {t('orphan_report.make_up_banner', 'Filling in a missed month - this will be recorded as {month}, not the current month.').replace('{month}', makeUpMonth.name)}
                </Text>
                <TouchableOpacity onPress={resetForm} hitSlop={8}>
                  <Text style={styles.makeUpCancel}>{t('common.cancel', 'Cancel')}</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {showDoneBox ? (
              <View style={styles.doneBox}>
                <Text style={styles.doneTitle}>{t('orphan_report.all_set', "You're all set for {month}").replace('{month}', currentMonthLabel)}</Text>
                <Text style={styles.doneBody}>
                  {t('orphan_report.already_submitted', 'Your report for this month is submitted. Check your submission history below.')}
                </Text>
              </View>
            ) : (
              <>
                <SectionHead
                  icon={<IconEdit color={EMERALD} />}
                  title={t('orphan_report.step_summary_title', 'How was your month?')}
                  subtitle={t('orphan_report.step_summary_subtitle', 'Tell us about your studies, activities, and how you are feeling.')}
                />
                <View style={styles.noteWrap}>
                  <TextInput
                    style={styles.noteInput}
                    placeholder={t('orphan_report.note_placeholder', 'Write a short note about your month...')}
                    placeholderTextColor={SUBTLE}
                    value={note}
                    onChangeText={(value) => setNote(value.slice(0, MAX_NOTE))}
                    multiline
                    maxLength={MAX_NOTE}
                  />
                  <Text style={styles.counter}>{note.length}/{MAX_NOTE}</Text>
                </View>

                <SectionHead
                  icon={<IconCap color={EMERALD} />}
                  title={t('orphan_report.academic_rating_title', 'Academic Rating')}
                  subtitle={t('orphan_report.academic_rating_subtitle', 'Rate your academic performance this month.')}
                />
                <RatingSelector
                  value={academicRating}
                  onChange={setAcademicRating}
                  labels={{
                    1: t('orphan_report.rating_poor', 'Poor'),
                    3: t('orphan_report.rating_average', 'Average'),
                    5: t('orphan_report.rating_excellent', 'Excellent'),
                  }}
                />

                <SectionHead
                  icon={<IconHeart color={EMERALD} />}
                  title={t('orphan_report.wellbeing_rating_title', 'Wellbeing Rating')}
                  subtitle={t('orphan_report.wellbeing_rating_subtitle', 'Rate your overall wellbeing this month.')}
                />
                <RatingSelector
                  value={wellbeingRating}
                  onChange={setWellbeingRating}
                  labels={{
                    1: t('orphan_report.rating_very_low', 'Very Low'),
                    3: t('orphan_report.rating_average', 'Average'),
                    5: t('orphan_report.rating_very_high', 'Very High'),
                  }}
                />

                <SectionHead
                  icon={<IconImage color={EMERALD} />}
                  title={t('orphan_report.photos_title', 'Add Photos (Optional)')}
                  subtitle={t('orphan_report.photos_subtitle', 'Add photos of your activities, achievements or study progress.')}
                />
                <TouchableOpacity
                  style={styles.dropzone}
                  onPress={pickPhotos}
                  activeOpacity={0.85}
                  disabled={photos.length >= MAX_PHOTOS}
                >
                  <IconImage color={EMERALD} />
                  <Text style={styles.dropTitle}>
                    {photos.length >= MAX_PHOTOS ? t('orphan_report.photo_limit_reached', 'Photo limit reached') : t('orphan_report.tap_to_add_photos', 'Tap to add photos')}
                  </Text>
                  <Text style={styles.dropSub}>{t('orphan_report.photo_limit_hint', 'You can select up to {n} images').replace('{n}', String(MAX_PHOTOS))}</Text>
                </TouchableOpacity>

                <View style={styles.thumbRow}>
                  {Array.from({ length: MAX_PHOTOS }).map((_, i) => {
                    const photo = photos[i];
                    if (photo) {
                      return (
                        <TouchableOpacity
                          key={photo.uri}
                          style={styles.thumb}
                          onPress={() => removePhoto(photo.uri)}
                          activeOpacity={0.8}
                        >
                          <Image source={{ uri: photo.uri }} style={styles.thumbImg} />
                          <View style={styles.thumbRemove}>
                            <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                              <Line x1={6} y1={6} x2={18} y2={18} stroke="#FFF" strokeWidth={2.6} strokeLinecap="round" />
                              <Line x1={18} y1={6} x2={6} y2={18} stroke="#FFF" strokeWidth={2.6} strokeLinecap="round" />
                            </Svg>
                          </View>
                        </TouchableOpacity>
                      );
                    }
                    return (
                      <TouchableOpacity
                        key={`slot-${i}`}
                        style={styles.thumbEmpty}
                        onPress={pickPhotos}
                        activeOpacity={0.7}
                      >
                        <IconPlus color={SUBTLE} />
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                  activeOpacity={0.9}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <IconSend color="#FFFFFF" />
                      <Text style={styles.submitButtonText}>{t('orphan_report.submit_report', 'Submit Report')}</Text>
                    </>
                  )}
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
                    onPress={() => (m.submitted ? setSelectedMonth(m) : openMakeUp(m))}
                  >
                    <View style={styles.timelineNodeCol}>
                      {m.submitted ? (
                        <View style={styles.timelineNodeFilled}>
                          <IconCheck color="#FFFFFF" size={13} />
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
                          <>
                            <Text style={styles.historySubmittedOn}>{t('orphan_report.submitted', 'Submitted')}</Text>
                            {m.submittedOn ? (
                              <View style={styles.timelineTimestampRow}>
                                <IconClock color={SUBTLE} />
                                <Text style={styles.timelineTimestampText}>{m.submittedOn}</Text>
                              </View>
                            ) : null}
                          </>
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
      )}

      <ReportDetailModal
        visible={!!selectedMonth}
        month={selectedMonth}
        onClose={() => setSelectedMonth(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: CANVAS },
  flex1: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', minWidth: 72 },
  backText: { color: EMERALD, fontSize: 16, fontWeight: '600', marginLeft: 2 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: INK },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  errorText: { color: DANGER, textAlign: 'center', marginBottom: 12 },
  retryButton: { backgroundColor: '#EEF0F2', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  retryText: { color: INK, fontWeight: '600' },
  scroll: { padding: 16, paddingBottom: 40 },
  pendingSyncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: EMERALD_SOFT,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  pendingSyncText: { flex: 1, fontSize: 13, color: EMERALD, fontWeight: '600' },

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
  sectionHead: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 4, marginBottom: 14 },
  sectionHeadInline: { flexDirection: 'row', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: INK },
  sectionSub: { fontSize: 13, color: SUBTLE, marginTop: 3, lineHeight: 18 },

  noteWrap: { marginBottom: 24 },
  noteInput: {
    backgroundColor: '#FBFCFD',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 30,
    fontSize: 15,
    color: INK,
    minHeight: 108,
    textAlignVertical: 'top',
  },
  counter: { position: 'absolute', right: 14, bottom: 10, fontSize: 12, color: SUBTLE },

  ratingRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  ratingCell: { alignItems: 'center', width: 56 },
  ratingCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    borderColor: '#E2E5E9',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  ...SHADOW.level1,
  },
  ratingCircleActive: { backgroundColor: EMERALD, borderColor: EMERALD },
  ratingNum: { fontSize: 16, fontWeight: '700', color: INK },
  ratingNumActive: { color: '#FFFFFF' },
  ratingLabel: { fontSize: 11, color: SUBTLE, marginTop: 8, textAlign: 'center' },
  ratingLabelSpacer: { height: 11, marginTop: 8 },

  dropzone: {
    borderWidth: 1.5,
    borderColor: '#BFE4CD',
    borderStyle: 'dashed',
    borderRadius: 16,
    backgroundColor: '#F4FBF6',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 22,
    marginBottom: 12,
  },
  dropTitle: { color: EMERALD, fontSize: 15, fontWeight: '700', marginTop: 8 },
  dropSub: { color: SUBTLE, fontSize: 12, marginTop: 3 },

  thumbRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  thumb: { width: 56, height: 56, borderRadius: 12, overflow: 'hidden' },
  thumbImg: { width: '100%', height: '100%' },
  thumbRemove: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbEmpty: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#F2F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  submitButton: {
    backgroundColor: EMERALD,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  doneBox: { paddingVertical: 8 },
  doneTitle: { fontSize: 16, fontWeight: '700', color: EMERALD, marginBottom: 6 },
  doneBody: { fontSize: 14, color: SUBTLE, lineHeight: 20 },

  makeUpBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: DANGER_SOFT,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 18,
  },
  makeUpBannerText: { flex: 1, fontSize: 12.5, color: DANGER, fontWeight: '600', lineHeight: 18 },
  makeUpCancel: { color: DANGER, fontSize: 13, fontWeight: '700' },

  historyHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  historyTitle: { fontSize: 17, fontWeight: '700', color: INK, marginLeft: 10 },
  historyHint: { fontSize: 12.5, color: SUBTLE, marginBottom: 10, marginLeft: 44 },
  viewAll: { color: EMERALD, fontSize: 14, fontWeight: '600' },
  emptyHistory: { fontSize: 13, color: SUBTLE, paddingVertical: 14, lineHeight: 19 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
  historyHeadIconChip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
  },

  calChip: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  calChipDark: { backgroundColor: INK },
  calChipMissing: { backgroundColor: DANGER_SOFT },
  historyMonth: { fontSize: 15, fontWeight: '700', color: INK },
  historySubmittedOn: { fontSize: 12.5, color: EMERALD, fontWeight: '600', marginTop: 2 },
  historyMissing: { fontSize: 12.5, color: DANGER, fontWeight: '600', marginTop: 2 },

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
  ...SHADOW.level1,
  },
  timelineCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
  ...SHADOW.level1,
  },
  timelineCardHighlighted: {
    backgroundColor: '#F4FAF7',
    borderColor: '#DCEEE3',
  },
  timelineTimestampRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5, gap: 5 },
  timelineTimestampText: { fontSize: 11.5, color: SUBTLE, fontWeight: '500' },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 8,
  },
  statusBadgeOnTime: { backgroundColor: EMERALD_SOFT },
  statusBadgePending: { backgroundColor: DANGER_SOFT },
  statusBadgeText: { fontSize: 11.5, fontWeight: '700' },
  statusBadgeTextOnTime: { color: EMERALD },
  statusBadgeTextPending: { color: DANGER },
  chevron: { fontSize: 20, color: '#C4C9CF', fontWeight: '400', marginLeft: 6 },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(12,16,14,0.45)',
    justifyContent: 'flex-end',
  },
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
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
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
