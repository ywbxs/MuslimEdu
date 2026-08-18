import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  BackHandler,
} from 'react-native';
import { X } from 'lucide-react-native';
import { COLORS, RADIUS, GLASS, BRAND } from '../../theme/glass';
import { WizardStepHeader } from './WizardKit';

const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const HAIRLINE = COLORS.border;
const GLASS_SURFACE_STRONG = GLASS.fillOnLightStrong;
// A real pixel cap, not a Yoga percentage - '88%' needs an ancestor with a
// definite height to resolve against, and the backdrop this sits in doesn't
// give one, so the percentage resolved unreliably and clipped content (the
// second field in a step would just never render) instead of the ScrollView
// below scrolling to reveal it.
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
 * (Teacher/Cashier/Registrar).
 *
 * Deliberately NOT built on RN's <Modal>. A <Modal> renders into a
 * *separate* native Android Dialog window, not the Activity's own window -
 * and Android's keyboard resize behavior for a secondary Dialog window is
 * notoriously unreliable (well past a RN-specific quirk; it's a long-
 * standing platform pain point independent of KeyboardAvoidingView's
 * behavior prop, edge-to-edge, or any padding math layered on top - none of
 * that has anything real to react to when the window it's measuring never
 * meaningfully resizes). Every *other* keyboard-avoiding screen in this app
 * (SchoolRegistrationScreen, AdmissionScreen, etc.) is a plain full-screen
 * view with KeyboardAvoidingView at the screen level, in the Activity's own
 * window - and those work. So this sheet is just an absolutely-positioned
 * full-screen overlay rendered as the last child of whatever screen owns it
 * (AdminTeacherListScreen / RegistrarAccountsScreen / CashierAccountsScreen
 * all already render it last, so it paints on top of everything else there
 * by normal paint order - no elevation/zIndex needed), with the exact same
 * KeyboardAvoidingView pattern that already works everywhere else. Only
 * mounted while `visible`, so there's no separate window's worth of native
 * back-button handling to replace - just a BackHandler subscription for the
 * Android hardware back button, which <Modal> used to give for free via
 * onRequestClose.
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

  useEffect(() => {
    if (!visible || Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleClose();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, finishing]);

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

  if (!visible || !current) return null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleClose} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  // flex:1 so KeyboardAvoidingView's "height" behavior has the full backdrop
  // height as a stable reference frame to shrink from, and justifyContent
  // keeps the sheet pinned to the bottom - same as every other Modal-free
  // KeyboardAvoidingView in this app.
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
