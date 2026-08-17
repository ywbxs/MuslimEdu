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
  Dimensions,
} from 'react-native';
import { X } from 'lucide-react-native';
import { COLORS, RADIUS, GLASS, BRAND } from '../../theme/glass';
import { WizardStepHeader } from './WizardKit';

const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const HAIRLINE = COLORS.border;
const GLASS_SURFACE_STRONG = GLASS.fillOnLightStrong;
// A real pixel cap, not a Yoga percentage - '88%' needs an ancestor with a
// definite height to resolve against, and this sheet's parent
// (KeyboardAvoidingView, at rest with no keyboard open) doesn't have one,
// so the percentage was resolving unreliably and clipping content (the
// second field in a step would just never render) instead of the
// ScrollView below scrolling to reveal it.
const MAX_SHEET_HEIGHT = Dimensions.get('window').height * 0.88;

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
 * progress header reuses WizardStepHeader from WizardKit.tsx - the same
 * numbered-circle-plus-connector stepper SchoolRegistrationScreen and
 * AlumniRegistrationScreen already use - so every wizard in the app reads
 * as one consistent design instead of each screen inventing its own.
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
        {/* Absolutely positioned (not a flex sibling) so it doesn't compete
            with the KeyboardAvoidingView below for vertical space - see that
            view's comment for why it needs the full backdrop height to
            itself. Renders first, so the sheet still draws on top of it. */}
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleClose} />
        {/* behavior="height" computes its shrink amount as (its own last-
            measured layout height) minus (keyboard height). Without an
            explicit flex:1 here, that measured height was just this view's
            shrink-wrapped content height (i.e. the sheet's own height) -
            often *smaller* than the keyboard itself, so the subtraction
            went to ~0 and the whole sheet visually collapsed to just its
            handle/header the moment a field was focused. flex:1 gives it
            the full backdrop height as a stable reference instead;
            justifyContent keeps the sheet pinned to the bottom the same as
            before, and pointerEvents="box-none" lets taps in the now-larger
            empty area above the sheet still reach the dismiss overlay
            underneath. */}
        <KeyboardAvoidingView
          style={styles.keyboardAvoider}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          pointerEvents="box-none"
        >
          <View style={[styles.sheet, { maxHeight: MAX_SHEET_HEIGHT }]}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <Text style={styles.title}>{title}</Text>
              <TouchableOpacity onPress={handleClose} hitSlop={12} style={styles.closeBtn} disabled={finishing}>
                <CloseIcon color={SUBTLE} />
              </TouchableOpacity>
            </View>

            <WizardStepHeader step={step + 1} labels={steps.map((s) => s.label)} />

            <ScrollView
              style={styles.stepScroll}
              contentContainerStyle={styles.stepScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
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
  // flex:1 + justifyContent so this has a stable full-height layout frame
  // for "height" behavior's math (see the render-time comment) while still
  // keeping the sheet pinned to the bottom.
  keyboardAvoider: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(17,20,23,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: GLASS_SURFACE_STRONG,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingBottom: 20,
    // maxHeight itself is set inline (MAX_SHEET_HEIGHT, a real pixel
    // value) - see the constant's comment for why a Yoga percentage here
    // was unreliable.
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#DADDE1', alignSelf: 'center', marginTop: 10, marginBottom: 6 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 4 },
  title: { fontSize: 17, fontWeight: '700', color: INK },
  closeBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },

  // flexShrink lets this give up space to the header/step-indicator/
  // actions siblings above and below it instead of the sheet's maxHeight
  // just clipping whatever doesn't fit - the actual bug (a step's second
  // field silently not rendering) instead of a normal scrollable overflow.
  stepScroll: { flexShrink: 1, flexGrow: 0 },
  stepScrollContent: { paddingHorizontal: 20, paddingBottom: 4 },
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
