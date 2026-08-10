import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Line, Circle } from 'react-native-svg';
import { SHADOW } from '../theme/spatial';

const EMERALD = '#2BCBB0';
const EMERALD_SOFT = '#E5F8F5';
const INK = '#1C1C1E';
const SUBTLE = '#8A9099';
const HAIRLINE = '#EDEEF0';
const CANVAS = '#F6F7F9';

function IconChevronLeft() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M15 6l-6 6 6 6" stroke={EMERALD} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconDocOutline() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M6 3h8l4 4v14H6z" stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
      <Line x1={9} y1={12} x2={15} y2={12} stroke={INK} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function IconCalendar() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M4 5h16v16H4z" stroke={EMERALD} strokeWidth={1.8} strokeLinejoin="round" />
      <Line x1={4} y1={9} x2={20} y2={9} stroke={EMERALD} strokeWidth={1.8} />
    </Svg>
  );
}
function IconSend() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M21 3L10.5 13.5" stroke="#FFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M21 3l-6.5 18-4-8-8-4L21 3z" stroke="#FFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export interface WizardStep {
  id: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  content: React.ReactNode;
  isValid: boolean; // whether the user can move past this step
}

interface Props {
  headerTitle: string;
  monthLabel: string;
  badgeLabel: string;
  dueDateLabel?: string;
  daysLeftLabel?: string;
  steps: WizardStep[];
  currentStepIndex: number;
  onStepChange: (index: number) => void;
  onBackPress: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  footer?: React.ReactNode; // e.g. submission history, rendered only on the last step
}

export default function ReportStepWizard({
  headerTitle,
  monthLabel,
  badgeLabel,
  dueDateLabel,
  daysLeftLabel,
  steps,
  currentStepIndex,
  onStepChange,
  onBackPress,
  onSubmit,
  isSubmitting,
  footer,
}: Props) {
  const insets = useSafeAreaInsets();
  const step = steps[currentStepIndex];
  const isLastStep = currentStepIndex === steps.length - 1;
  const isFirstStep = currentStepIndex === 0;

  const goNext = () => {
    if (!step.isValid) return;
    if (isLastStep) {
      onSubmit();
    } else {
      onStepChange(currentStepIndex + 1);
    }
  };
  const goBack = () => {
    if (isFirstStep) {
      onBackPress();
    } else {
      onStepChange(currentStepIndex - 1);
    }
  };

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <TouchableOpacity onPress={goBack} hitSlop={10} style={styles.headerBackBtn}>
          <IconChevronLeft />
          <Text style={styles.headerBackText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{headerTitle}</Text>
        <View style={styles.headerIconChip}>
          <IconDocOutline />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero card */}
        <View style={styles.heroCard}>
          <View style={styles.heroIconChip}>
            <IconDocOutline />
          </View>
          <Text style={styles.heroLabel}>Report for</Text>
          <Text style={styles.heroMonth}>{monthLabel}</Text>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>{badgeLabel}</Text>
          </View>
        </View>

        {!!dueDateLabel && (
          <View style={styles.dueCard}>
            <View style={styles.dueIconChip}>
              <IconCalendar />
            </View>
            <View style={styles.flex1}>
              <Text style={styles.dueLabel}>Due Date</Text>
              <Text style={styles.dueValue}>{dueDateLabel}</Text>
              {!!daysLeftLabel && <Text style={styles.dueDays}>{daysLeftLabel}</Text>}
            </View>
          </View>
        )}

        {/* Step progress */}
        <View style={styles.progressRow}>
          {steps.map((s, idx) => {
            const done = idx < currentStepIndex;
            const active = idx === currentStepIndex;
            return (
              <React.Fragment key={s.id}>
                <View style={styles.progressDotWrap}>
                  <View
                    style={[
                      styles.progressDot,
                      active && styles.progressDotActive,
                      done && styles.progressDotDone,
                    ]}
                  >
                    <Text style={[styles.progressDotText, (active || done) && styles.progressDotTextActive]}>
                      {idx + 1}
                    </Text>
                  </View>
                </View>
                {idx < steps.length - 1 && (
                  <View style={[styles.progressLine, done && styles.progressLineDone]} />
                )}
              </React.Fragment>
            );
          })}
        </View>
        <Text style={styles.progressCaption}>
          Step {currentStepIndex + 1} of {steps.length} · {step.title}
        </Text>

        {/* Current step card */}
        <View style={styles.stepCard}>
          <View style={styles.sectionHead}>
            <View style={styles.iconChip}>{step.icon}</View>
            <View style={styles.flex1}>
              <Text style={styles.sectionTitle}>{step.title}</Text>
              <Text style={styles.sectionSub}>{step.subtitle}</Text>
            </View>
          </View>
          {step.content}
        </View>

        {isLastStep && footer}
      </ScrollView>

      <View style={styles.navBar}>
        {!isFirstStep && (
          <TouchableOpacity style={styles.navBackBtn} onPress={goBack} activeOpacity={0.85}>
            <Text style={styles.navBackText}>Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.navNextBtn, !step.isValid && styles.navNextBtnDisabled, isFirstStep && styles.navNextBtnFull]}
          onPress={goNext}
          activeOpacity={0.85}
          disabled={!step.isValid || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              {isLastStep && <IconSend />}
              <Text style={styles.navNextText}>{isLastStep ? 'Submit Report' : 'Next'}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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
  },
  headerBackBtn: { flexDirection: 'row', alignItems: 'center', width: 70 },
  headerBackText: { color: EMERALD, fontSize: 15, fontWeight: '600', marginLeft: 2 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: INK },
  headerIconChip: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  scrollContent: { paddingHorizontal: 16, paddingBottom: 24 },

  heroCard: {
    backgroundColor: '#14151A',
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
  },
  heroIconChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  heroLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 4 },
  heroMonth: { color: '#FFFFFF', fontSize: 26, fontWeight: '700', marginBottom: 10 },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  heroBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },

  dueCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    ...SHADOW.level1,
  },
  dueIconChip: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  dueLabel: { color: SUBTLE, fontSize: 12.5, marginBottom: 2 },
  dueValue: { color: INK, fontSize: 15.5, fontWeight: '700' },
  dueDays: { color: EMERALD, fontSize: 12.5, fontWeight: '600', marginTop: 2 },

  progressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  progressDotWrap: { alignItems: 'center' },
  progressDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: HAIRLINE,
    alignItems: 'center',
    justifyContent: 'center',
  ...SHADOW.level1,
  },
  progressDotActive: { borderColor: EMERALD, backgroundColor: EMERALD_SOFT },
  progressDotDone: { borderColor: EMERALD, backgroundColor: EMERALD },
  progressDotText: { fontSize: 12, fontWeight: '700', color: SUBTLE },
  progressDotTextActive: { color: EMERALD },
  progressLine: { flex: 1, height: 2, backgroundColor: HAIRLINE, marginHorizontal: 2 },
  progressLineDone: { backgroundColor: EMERALD },
  progressCaption: { color: SUBTLE, fontSize: 12.5, marginBottom: 14, fontWeight: '600' },

  stepCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    ...SHADOW.level1,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  iconChip: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sectionTitle: { fontSize: 15.5, fontWeight: '700', color: INK, marginBottom: 3 },
  sectionSub: { fontSize: 12.5, color: SUBTLE, lineHeight: 17 },

  navBar: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 28,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
  },
  navBackBtn: {
    flex: 1,
    marginRight: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: HAIRLINE,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
  },
  navBackText: { color: INK, fontWeight: '700', fontSize: 15 },
  navNextBtn: {
    flex: 2,
    borderRadius: 14,
    backgroundColor: EMERALD,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingVertical: 15,
  },
  navNextBtnFull: { flex: 1 },
  navNextBtnDisabled: { opacity: 0.5 },
  navNextText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15, marginLeft: 8 },
});
