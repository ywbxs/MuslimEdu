import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Check } from 'lucide-react-native';
import { useLocale } from '../../context/LocaleContext';
import { AcademicGlassTheme } from '../../screens/teachers/academicGlassTheme';
import { RADIUS } from '../../theme/glass';
import GlassBackground from './GlassBackground';

/**
 * Big-card step wizard, extracted from AdminClassScheduleScreen's
 * ScheduleEditSheet so any admin form can get the same "one focused step at
 * a time, progress dots, review-before-save" spatial UI instead of a long
 * flat scrolling form. Unlike the original (a bottom modal sheet), this is a
 * full screen - meant to be the whole content of a Stack.Screen (e.g.
 * EnrollmentStageFormScreen), not an in-place modal.
 */

export interface WizardStep {
  id: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  isValid: boolean;
  content: React.ReactNode;
}

function IconChevronLeft({ color }: { color: string }) {
  return <ChevronLeft color={color} size={22} strokeWidth={2.4} />;
}
function IconCheck({ color }: { color: string }) {
  return <Check color={color} size={14} strokeWidth={3} />;
}

export default function WizardShell({
  title,
  steps,
  onCancel,
  onFinish,
  finishLabel,
  saving,
  theme,
}: {
  title: string;
  steps: WizardStep[];
  onCancel: () => void;
  onFinish: () => void;
  finishLabel?: string;
  saving?: boolean;
  theme: AcademicGlassTheme;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useLocale();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [stepIndex, setStepIndex] = useState(0);

  // If the step list shrinks (e.g. conditional steps), don't leave the
  // wizard pointed past the end.
  useEffect(() => {
    if (stepIndex > steps.length - 1) setStepIndex(Math.max(0, steps.length - 1));
  }, [steps.length, stepIndex]);

  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === steps.length - 1;
  const step = steps[stepIndex];

  const goNext = () => {
    if (!step || !step.isValid) return;
    if (isLastStep) {
      onFinish();
    } else {
      setStepIndex(stepIndex + 1);
    }
  };
  const goBack = () => {
    if (isFirstStep) onCancel();
    else setStepIndex(stepIndex - 1);
  };

  if (!step) return null;

  return (
    <View style={styles.container}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={onCancel} hitSlop={10} style={styles.backButton}>
          <IconChevronLeft color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, styles.headerTitleFlex]} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {saving ? (
        <View style={styles.savingWrap}>
          <ActivityIndicator color={theme.accent} />
        </View>
      ) : (
        <>
          <View style={styles.progressRow}>
            {steps.map((s, idx) => {
              const done = idx < stepIndex;
              const active = idx === stepIndex;
              return (
                <React.Fragment key={s.id}>
                  <TouchableOpacity
                    disabled={idx > stepIndex}
                    onPress={() => idx < stepIndex && setStepIndex(idx)}
                    style={[styles.progressDot, active && styles.progressDotActive, done && styles.progressDotDone]}
                  >
                    {done ? <IconCheck color={theme.onAccent} /> : <Text style={[styles.progressDotText, active && styles.progressDotTextActive]}>{idx + 1}</Text>}
                  </TouchableOpacity>
                  {idx < steps.length - 1 && <View style={[styles.progressLine, done && styles.progressLineDone]} />}
                </React.Fragment>
              );
            })}
          </View>
          <Text style={styles.progressCaption}>
            {t('wizard.step_caption', 'Step {current} of {total}')
              .replace('{current}', String(stepIndex + 1))
              .replace('{total}', String(steps.length))}
            {' · '}
            {step.title}
          </Text>

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.stepCard}>
              {step.icon ? <View style={styles.stepIconWrap}>{step.icon}</View> : null}
              <Text style={styles.stepTitle}>{step.title}</Text>
              {step.subtitle ? <Text style={styles.stepSubtitle}>{step.subtitle}</Text> : null}
              <View style={styles.stepBody}>{step.content}</View>
            </View>

            <View style={styles.navRow}>
              <TouchableOpacity style={styles.navBackBtn} onPress={goBack} activeOpacity={0.85}>
                <Text style={styles.navBackText}>{isFirstStep ? t('common.cancel', 'Cancel') : t('common.back', 'Back')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.navNextBtn, !step.isValid && styles.navNextBtnDisabled]}
                onPress={goNext}
                activeOpacity={0.85}
                disabled={!step.isValid}
              >
                <Text style={styles.navNextText}>{isLastStep ? finishLabel ?? t('common.save', 'Save') : t('common.next', 'Next')}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </>
      )}
    </View>
  );
}

const makeStyles = (theme: AcademicGlassTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerTitle: { fontSize: 20, fontWeight: '700', color: theme.textPrimary },
    headerTitleFlex: { flex: 1, marginLeft: 8 },
    backButton: { width: 32 },
    headerSpacer: { width: 32 },
    savingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    progressRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 18 },
    progressDot: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: theme.background,
      borderWidth: 1.5,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    progressDotActive: { borderColor: theme.accent, backgroundColor: theme.accentSoft },
    progressDotDone: { borderColor: theme.accent, backgroundColor: theme.accent },
    progressDotText: { fontSize: 12.5, fontWeight: '700', color: theme.textSecondary },
    progressDotTextActive: { color: theme.accent },
    progressLine: { flex: 1, height: 2, backgroundColor: theme.border, marginHorizontal: 4 },
    progressLineDone: { backgroundColor: theme.accent },
    progressCaption: {
      color: theme.textSecondary,
      fontSize: 12.5,
      fontWeight: '600',
      paddingHorizontal: 20,
      marginTop: 10,
      marginBottom: 4,
    },

    content: { padding: 20, paddingBottom: 40 },
    // The "big wizard card" - each step renders as one large elevated
    // spatial card rather than fields floating on the bare background.
    stepCard: {
      backgroundColor: theme.surface,
      borderRadius: RADIUS.xl ?? 24,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 22,
      ...theme.elevation2,
    },
    stepIconWrap: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: theme.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    stepTitle: { fontSize: 20, fontWeight: '800', color: theme.textPrimary, marginBottom: 6 },
    stepSubtitle: { fontSize: 13.5, color: theme.textSecondary, lineHeight: 19, marginBottom: 18 },
    stepBody: {},

    navRow: { flexDirection: 'row', gap: 10, marginTop: 24 },
    navBackBtn: {
      flex: 1,
      borderRadius: RADIUS.md ?? 14,
      borderWidth: 1.5,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 15,
    },
    navBackText: { color: theme.textPrimary, fontWeight: '700', fontSize: 14.5 },
    navNextBtn: {
      flex: 2,
      borderRadius: RADIUS.md ?? 14,
      backgroundColor: theme.accent,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 15,
    },
    navNextBtnDisabled: { opacity: 0.45 },
    navNextText: { color: theme.onAccent, fontWeight: '700', fontSize: 14.5 },
  });
