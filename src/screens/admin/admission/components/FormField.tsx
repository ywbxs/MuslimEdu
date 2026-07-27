import React, { useRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { md3 } from '../theme';

function EyeIcon({ off, size = 18 }: { off: boolean; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {off ? (
        <Path
          d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M6.5 6.7C3.9 8.3 2 12 2 12s3.6 7 10 7c1.8 0 3.4-.4 4.7-1.1M9.9 5.2C10.6 5.1 11.3 5 12 5c6.4 0 10 7 10 7-.5.9-1.4 2.2-2.6 3.4"
          stroke={md3.color.onSurfaceVariant}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <>
          <Path
            d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"
            stroke={md3.color.onSurfaceVariant}
            strokeWidth={2}
            strokeLinejoin="round"
          />
          <Circle cx={12} cy={12} r={3} stroke={md3.color.onSurfaceVariant} strokeWidth={2} />
        </>
      )}
    </Svg>
  );
}

export interface FormFieldProps {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  required?: boolean;
  error?: string | null;
  helper?: string;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  secure?: boolean;
  multiline?: boolean;
  autoCapitalize?: 'none' | 'words' | 'sentences' | 'characters';
}

export default function FormField({
  label,
  value,
  onChangeText,
  required,
  error,
  helper,
  placeholder,
  keyboardType = 'default',
  secure,
  multiline,
  autoCapitalize,
}: FormFieldProps) {
  const [focused, setFocused] = useState(false);
  const [reveal, setReveal] = useState(false);
  const borderAnim = useRef(new Animated.Value(0)).current;

  const hasError = !!error;

  const animateTo = (toValue: number) => {
    Animated.timing(borderAnim, { toValue, duration: md3.motion.fast, useNativeDriver: false }).start();
  };

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [hasError ? md3.color.error : md3.color.outlineVariant, hasError ? md3.color.error : md3.color.primary],
  });

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, hasError && styles.labelError]}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <Animated.View
        style={[
          styles.inputRow,
          multiline && styles.inputRowMultiline,
          { borderColor: hasError ? md3.color.error : borderColor, borderWidth: focused || hasError ? 2 : 1 },
        ]}
      >
        <TextInput
          style={[styles.input, multiline && styles.inputMultiline]}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => {
            setFocused(true);
            animateTo(1);
          }}
          onBlur={() => {
            setFocused(false);
            animateTo(0);
          }}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize ?? (secure ? 'none' : 'words')}
          secureTextEntry={secure && !reveal}
          multiline={multiline}
          numberOfLines={multiline ? 4 : 1}
          placeholder={placeholder ?? label}
          placeholderTextColor={md3.color.onSurfaceVariant}
        />
        {secure ? (
          <TouchableOpacity
            onPress={() => setReveal((v) => !v)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.trailingIcon}
          >
            <EyeIcon off={!reveal} />
          </TouchableOpacity>
        ) : null}
      </Animated.View>
      {hasError ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helper ? (
        <Text style={styles.helperText}>{helper}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 18 },
  label: {
    fontSize: md3.type.labelMedium.fontSize,
    fontWeight: md3.type.labelMedium.fontWeight,
    color: md3.color.onSurfaceVariant,
    marginBottom: 6,
  },
  labelError: { color: md3.color.error },
  required: { color: md3.color.error },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: md3.color.surfaceContainerLow,
    borderRadius: md3.shape.sm,
    paddingHorizontal: 14,
  },
  inputRowMultiline: { alignItems: 'flex-start' },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: md3.type.bodyLarge.fontSize,
    color: md3.color.onSurface,
  },
  inputMultiline: { minHeight: 92, textAlignVertical: 'top', paddingTop: 14 },
  trailingIcon: { paddingLeft: 8, paddingVertical: 10 },
  errorText: {
    fontSize: md3.type.bodyMedium.fontSize,
    color: md3.color.error,
    marginTop: 6,
    marginLeft: 2,
  },
  helperText: {
    fontSize: md3.type.bodyMedium.fontSize,
    color: md3.color.onSurfaceVariant,
    marginTop: 6,
    marginLeft: 2,
    lineHeight: 17,
  },
});
