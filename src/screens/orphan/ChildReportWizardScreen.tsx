import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path, Line, Circle } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { fetchReportStatus, submitReport, PickedPhoto } from '../../services/orphanService';
import ReportStepWizard, { WizardStep } from '../../components/ReportStepWizard';
import { NoteInput, RatingSelector, PhotoPicker } from '../../components/ReportFormControls';

const EMERALD = '#0F9D58';
const INK = '#1C1C1E';
const SUBTLE = '#8A9099';

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
  const monthLabel = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;

  const handleSubmit = async () => {
    if (!token || !academicRating || !wellbeingRating) return;
    setIsSubmitting(true);
    try {
      await submitReport(token, { note, academic_rating: academicRating, wellbeing_rating: wellbeingRating }, photos);
      Alert.alert('Report submitted', 'Your monthly report has been sent to your school admin.');
      setNote('');
      setAcademicRating(null);
      setWellbeingRating(null);
      setPhotos([]);
      setStepIndex(0);
      await load();
    } catch (err) {
      Alert.alert('Something went wrong', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps: WizardStep[] = useMemo(
    () => [
      {
        id: 'summary',
        icon: <IconEdit />,
        title: 'Monthly Summary',
        subtitle: 'Share how this month went — activities, progress, and anything your school admin should know.',
        content: <NoteInput value={note} onChange={setNote} />,
        isValid: true,
      },
      {
        id: 'academic',
        icon: <IconCap />,
        title: 'Academic Rating',
        subtitle: 'Rate overall academic progress this month.',
        content: (
          <RatingSelector
            value={academicRating}
            onChange={setAcademicRating}
            labels={{ 1: 'Needs Improve.', 3: 'Average', 5: 'Excellent' }}
          />
        ),
        isValid: !!academicRating,
      },
      {
        id: 'wellbeing',
        icon: <IconHeart />,
        title: 'Wellbeing Rating',
        subtitle: 'Rate overall wellbeing and engagement this month.',
        content: (
          <RatingSelector
            value={wellbeingRating}
            onChange={setWellbeingRating}
            labels={{ 1: 'Low', 3: 'Average', 5: 'Very High' }}
          />
        ),
        isValid: !!wellbeingRating,
      },
      {
        id: 'photos',
        icon: <IconImage />,
        title: 'Add Photos',
        subtitle: 'Optional — add photos from this month (up to 5).',
        content: <PhotoPicker photos={photos} onChange={setPhotos} />,
        isValid: true,
      },
    ],
    [note, academicRating, wellbeingRating, photos],
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
        <Text style={styles.doneTitle}>You're all set</Text>
        <Text style={styles.doneBody}>Your report for {monthLabel} has already been submitted.</Text>
      </View>
    );
  }

  return (
    <ReportStepWizard
      headerTitle="Monthly Report"
      monthLabel={monthLabel}
      badgeLabel="Monthly Report"
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
