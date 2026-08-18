import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { CircleCheck } from 'lucide-react-native';
import { BRAND, COLORS } from '../../theme/glass';

/**
 * Small shared bits for the app's pre-auth signup wizards
 * (SchoolRegistrationScreen, AlumniRegistrationScreen) - just the
 * interactive chrome (primary button, step progress), not full styling,
 * since each wizard's actual form content differs enough to keep its own
 * local StyleSheet.
 */

export function CheckCircleIcon({ color = BRAND.emerald, size = 64 }: { color?: string; size?: number }) {
  return <CircleCheck color={color} size={size} strokeWidth={1.8} />;
}

export function WizardGradientButton({
  label,
  onPress,
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <TouchableOpacity activeOpacity={0.88} onPress={onPress} disabled={disabled || loading} style={btn.wrap}>
      <LinearGradient
        colors={[BRAND.emeraldLight, BRAND.emeraldDeep]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[btn.gradient, (disabled || loading) && btn.disabled]}
      >
        {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={btn.text}>{label}</Text>}
      </LinearGradient>
    </TouchableOpacity>
  );
}

export function WizardStepHeader({ step, labels }: { step: number; labels: string[] }) {
  return (
    <View style={stepHeader.row}>
      {labels.map((label, i) => {
        const num = i + 1;
        const done = num < step;
        const active = num === step;
        return (
          <React.Fragment key={label}>
            <View style={stepHeader.item}>
              <View style={[stepHeader.circle, (done || active) && stepHeader.circleActive]}>
                {done ? (
                  <CheckCircleIcon color="#FFFFFF" size={16} />
                ) : (
                  <Text style={[stepHeader.circleText, active && stepHeader.circleTextActive]}>{num}</Text>
                )}
              </View>
              <Text style={[stepHeader.label, active && stepHeader.labelActive]}>{label}</Text>
            </View>
            {i < labels.length - 1 && <View style={[stepHeader.connector, done && stepHeader.connectorActive]} />}
          </React.Fragment>
        );
      })}
    </View>
  );
}

export function WizardFieldLabel({ children, required }: { children: string; required?: boolean }) {
  return (
    <Text style={form.label}>
      {children}
      {required ? <Text style={form.required}> *</Text> : null}
    </Text>
  );
}

export const form = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '700', color: COLORS.ink, marginTop: 16, marginBottom: 8 },
  required: { color: '#E24C4C' },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.ink,
    backgroundColor: COLORS.surface,
  },
  inputMultiline: { minHeight: 72, textAlignVertical: 'top' },
  errorText: { color: '#E24C4C', fontSize: 12.5, marginTop: 8 },
});

const btn = StyleSheet.create({
  wrap: { borderRadius: 999 },
  gradient: {
    height: 54,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BRAND.emeraldDeep,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 6,
  },
  disabled: { opacity: 0.5 },
  text: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});

const stepHeader = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 24, paddingVertical: 14 },
  item: { alignItems: 'center', width: 56 },
  circle: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#EDEFF0', alignItems: 'center', justifyContent: 'center' },
  // BRAND.emeraldDeep, not BRAND.emerald - white check/digit on the raw
  // accent (#1FAE64) measures 2.88:1, below WCAG AA's 4.5:1 minimum for
  // text/icons. Deep emerald measures 5.42:1. Same fix for the active
  // label text and the connector, so the whole stepper reads as one
  // consistent accent instead of two different greens.
  circleActive: { backgroundColor: BRAND.emeraldDeep },
  circleText: { fontSize: 12, fontWeight: '700', color: COLORS.subtle },
  circleTextActive: { color: '#FFFFFF' },
  label: { fontSize: 10.5, color: COLORS.subtle, marginTop: 4, textAlign: 'center' },
  labelActive: { color: BRAND.emeraldDeep, fontWeight: '700' },
  connector: { flex: 1, height: 2, backgroundColor: '#EDEFF0', marginTop: 12, marginHorizontal: -6 },
  connectorActive: { backgroundColor: BRAND.emeraldDeep },
});
