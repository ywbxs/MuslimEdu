import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path, Line, Circle } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { fetchReportStatus, submitReport, PickedPhoto } from '../../services/orphanService';
import ReportStepWizard, { WizardStep } from '../../components/ReportStepWizard';
import { NoteInput, RatingSelector, PhotoPicker } from '../../components/ReportFormControls';

const EMERALD = '#0F9D58';
const INK = '#1C1C1E';
const SUBTLE = '#8A9099';

const MONTH_KEYS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function IconEdit() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M4 20h4L18 10l-4-4L4 16v4z" stroke={EMERALD} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}
function IconCap() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M2 9l10-4 10 4-10 4L2 9z" stroke={EMERALD} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}
function IconHeart() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M12 20s-7-4.35-7-9.5A3.5 3.5 0 0 1 12 7a3.5 3.5 0 0 1 7 3.5C19 15.65 12 20 12 20z" stroke={EMERALD} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}
function IconImage() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={EMERALD} strokeWidth={1.8} />
    </Svg>
  );
}

/**
 * CHILD / ORPHAN monthly report submission — step wizard.
 * This is deliberately its own screen (not shared with TeacherOrphanReportScreen)
 * because the fields, endpoints, and payload shape are different: academic +
 * wellbeing ratings here vs. teaching effectiveness / classroom engagement /
 * professional growth for a teacher-orphan.
 */
export default function ChildReportWizardScreen() {
  const navigation = useNavigation();
  const { token } = useAuth();
  const { t } = useLocale();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  const [note, setNote] = useState('');
  const [academicRating, setAcademicRating] = useState<number | null>(null);
  const [wellbeingRating, setWellbeingRating] = useState<number | null>(null);
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [stepIndex, setStepIndex] = useState(0);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await fetchReportStatus(token);
      setAlreadySubmitted(data.submitted_this_month);
    } catch {
      // non-fatal - the wizard still works, submit will surface any real error
    }
  }, [token]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const now = new Date();
  const monthLabel = `${t(`child_report_wizard.month_${MONTH_KEYS[now.getMonth()]}`, MONTH_NAMES[now.getMonth()])} ${now.getFullYear()}`;

  const handleSubmit = async () => {
    if (!token || !academicRating || !wellbeingRating || photos.length === 0) return;
    setIsSubmitting(true);
    try {
      await submitReport(token, { note, academic_rating: academicRating, wellbeing_rating: wellbeingRating }, photos);
      Alert.alert(t('child_report_wizard.submitted_title', 'Report submitted'), t('child_report_wizard.submitted_body', 'Your monthly report has been sent to your school admin.'));
      setNote('');
      setAcademicRating(null);
      setWellbeingRating(null);
      setPhotos([]);
      setStepIndex(0);
      await load();
    } catch (err) {
      Alert.alert(t('child_report_wizard.error_title', 'Something went wrong'), err instanceof Error ? err.message : t('common.try_again_full', 'Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps: WizardStep[] = useMemo(
    () => [
      {
        id: 'summary',
        icon: <IconEdit />,
        title: t('child_report_wizard.summary_title', 'Monthly Summary'),
        subtitle: t('child_report_wizard.summary_subtitle', 'Share how this month went — activities, progress, and anything your school admin should know.'),
        content: <NoteInput value={note} onChange={setNote} />,
        isValid: true,
      },
      {
        id: 'academic',
        icon: <IconCap />,
        title: t('child_report_wizard.academic_title', 'Academic Rating'),
        subtitle: t('child_report_wizard.academic_subtitle', 'Rate overall academic progress this month.'),
        content: (
          <RatingSelector
            value={academicRating}
            onChange={setAcademicRating}
            labels={{ 1: t('child_report_wizard.needs_improve', 'Needs Improve.'), 3: t('child_report_wizard.average', 'Average'), 5: t('child_report_wizard.excellent', 'Excellent') }}
          />
        ),
        isValid: !!academicRating,
      },
      {
        id: 'wellbeing',
        icon: <IconHeart />,
        title: t('child_report_wizard.wellbeing_title', 'Wellbeing Rating'),
        subtitle: t('child_report_wizard.wellbeing_subtitle', 'Rate overall wellbeing and engagement this month.'),
        content: (
          <RatingSelector
            value={wellbeingRating}
            onChange={setWellbeingRating}
            labels={{ 1: t('child_report_wizard.low', 'Low'), 3: t('child_report_wizard.average', 'Average'), 5: t('child_report_wizard.very_high', 'Very High') }}
          />
        ),
        isValid: !!wellbeingRating,
      },
      {
        id: 'photos',
        icon: <IconImage />,
        title: t('child_report_wizard.photos_title', 'Add Photos'),
        subtitle: t('child_report_wizard.photos_subtitle_required', 'Required — add at least one photo from this month (up to 5).'),
        content: <PhotoPicker photos={photos} onChange={setPhotos} required />,
        // Photos are required to submit - the wizard's Submit button
        // stays disabled until at least one is attached.
        isValid: photos.length > 0,
      },
    ],
    [note, academicRating, wellbeingRating, photos, t],
  );

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={EMERALD} />
      </View>
    );
  }

  if (alreadySubmitted) {
    return (
      <View style={styles.center}>
        <Text style={styles.doneTitle}>{t('child_report_wizard.all_set', "You're all set")}</Text>
        <Text style={styles.doneBody}>{t('child_report_wizard.already_submitted', 'Your report for {month} has already been submitted.').replace('{month}', monthLabel)}</Text>
      </View>
    );
  }

  return (
    <ReportStepWizard
      headerTitle={t('child_report_wizard.header_title', 'Monthly Report')}
      monthLabel={monthLabel}
      badgeLabel={t('child_report_wizard.header_title', 'Monthly Report')}
      steps={steps}
      currentStepIndex={stepIndex}
      onStepChange={setStepIndex}
      onBackPress={() => navigation.goBack()}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  doneTitle: { fontSize: 18, fontWeight: '700', color: INK, marginBottom: 6 },
  doneBody: { fontSize: 14, color: SUBTLE, textAlign: 'center' },
});
