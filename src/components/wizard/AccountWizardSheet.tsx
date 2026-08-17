import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X } from 'lucide-react-native';
import { COLORS, RADIUS, GLASS, BRAND } from '../../theme/glass';

const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const HAIRLINE = COLORS.border;
const GLASS_SURFACE_STRONG = GLASS.fillOnLightStrong;

function CloseIcon({ color }: { color: string }) {
  return <X size={18} color={color} strokeWidth={2.2} />;
}

export interface WizardStepDef {
  key: string;
  label: string;
  render: () => React.ReactNode;
}

/**
 * A multi-step bottom sheet for the "Add {role}" account-creation forms
 * (Teacher/Cashier/Registrar) - was one long ungrouped list of label+
 * TextInput pairs in a single scroll, with no visible border/background
 * on the inputs (just placeholder text floating with nothing marking it
 * as a field). Reusable across all three since they collect the exact
 * same field set (identity, account credentials, contact info); the
 * step-name-plus-segmented-track progress header is the same shape
 * InstitutionProfileScreen's wizard uses, not the numbered-circle-row
 * pattern (that one both reads as more generic and doesn't fit many
 * steps on a phone width without clipping).
 *
 * Steps only ever validate+advance locally; the caller's `onFinish` is
 * the only thing that hits the network, on the last step.
 */
export default function AccountWizardSheet({
  visible,
  onClose,
  title,
  steps,
  validateStep,
  onFinish,
  finishing,
  finishLabel,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  steps: WizardStepDef[];
  validateStep: (stepIndex: number) => string | null;
  onFinish: () => void;
  finishing: boolean;
  finishLabel: string;
}) {
  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setStep(0);
      setStepError(null);
    }
  }, [visible]);

  const isLastStep = step === steps.length - 1;
  const current = steps[step];

  const handleClose = () => {
    if (finishing) return;
    onClose();
  };

  const goNext = () => {
    const err = validateStep(step);
    if (err) {
      setStepError(err);
      return;
    }
    setStepError(null);
    if (isLastStep) {
      onFinish();
    } else {
      setStep((s) => Math.min(steps.length - 1, s + 1));
    }
  };

  const goBack = () => {
    setStepError(null);
    setStep((s) => Math.max(0, s - 1));
  };

  if (!current) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.flex1} activeOpacity={1} onPress={handleClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <Text style={styles.title}>{title}</Text>
              <TouchableOpacity onPress={handleClose} hitSlop={12} style={styles.closeBtn} disabled={finishing}>
                <CloseIcon color={SUBTLE} />
              </TouchableOpacity>
            </View>

            <View style={styles.progressTopRow}>
              <Text style={styles.progressStepName}>{current.label}</Text>
              <Text style={styles.progressStepCount}>
                Step {step + 1} of {steps.length}
              </Text>
            </View>
            <View style={styles.progressTrackRow}>
              {steps.map((s, i) => (
                <View key={s.key} style={[styles.progressSegment, i <= step && styles.progressSegmentFilled]} />
              ))}
            </View>

            <ScrollView style={styles.stepScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {current.render()}
            </ScrollView>

            {stepError ? <Text style={styles.stepErrorText}>{stepError}</Text> : null}

            <View style={styles.actions}>
              {step > 0 ? (
                <TouchableOpacity style={styles.backStepBtn} onPress={goBack} disabled={finishing} activeOpacity={0.85}>
                  <Text style={styles.backStepBtnText}>Back</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={[styles.continueBtn, finishing && styles.continueBtnDisabled]}
                onPress={goNext}
                disabled={finishing}
                activeOpacity={0.85}
              >
                {finishing ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.continueBtnText}>{isLastStep ? finishLabel : 'Continue'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(17,20,23,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: GLASS_SURFACE_STRONG,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingBottom: 20,
    maxHeight: '88%',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#DADDE1', alignSelf: 'center', marginTop: 10, marginBottom: 6 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 4 },
  title: { fontSize: 17, fontWeight: '700', color: INK },
  closeBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },

  progressTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 12, marginBottom: 8 },
  progressStepName: { fontSize: 14.5, fontWeight: '800', color: INK },
  progressStepCount: { fontSize: 12, fontWeight: '600', color: SUBTLE },
  progressTrackRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, marginBottom: 16 },
  progressSegment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: HAIRLINE },
  progressSegmentFilled: { backgroundColor: BRAND.emeraldDeep },

  stepScroll: { paddingHorizontal: 20 },
  stepErrorText: { color: COLORS.danger, fontSize: 12.5, textAlign: 'center', paddingHorizontal: 20, marginTop: 8 },

  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 16 },
  backStepBtn: {
    flex: 1,
    height: 52,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: HAIRLINE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backStepBtnText: { color: INK, fontSize: 15.5, fontWeight: '700' },
  continueBtn: {
    flex: 2,
    backgroundColor: BRAND.emeraldDeep,
    borderRadius: RADIUS.pill,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBtnDisabled: { opacity: 0.6 },
  continueBtnText: { color: '#FFFFFF', fontSize: 15.5, fontWeight: '700' },
});

export const wizardFieldStyles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: INK, marginBottom: 8, marginTop: 14 },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: HAIRLINE,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: INK,
  },
});
