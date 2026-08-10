import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  StyleProp,
  ViewStyle,
  TextInputProps,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { BRAND, COLORS, GLASS, RADIUS, SHADOW, SPACING, TYPE } from '../../theme/glass';

// ---------------------------------------------------------------------------
// GlassButton — solid emerald gradient "primary", or frosted-glass "ghost".
// ---------------------------------------------------------------------------
export function GlassButton({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  style,
  radius,
}: {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Overrides the default pill (fully-rounded) shape, e.g. RADIUS.lg to match a card. */
  radius?: number;
}) {
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const radiusStyle = radius !== undefined ? { borderRadius: radius } : undefined;

  const content = (
    <View style={styles.btnInner}>
      {loading ? (
        <ActivityIndicator color={isPrimary || isDanger ? '#fff' : BRAND.emerald} />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.btnLabel,
              { color: isPrimary || isDanger ? '#fff' : BRAND.emerald },
            ]}
          >
            {label}
          </Text>
        </>
      )}
    </View>
  );

  if (isPrimary) {
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        disabled={disabled || loading}
        style={[styles.btnBase, SHADOW.glow, radiusStyle, disabled && styles.disabled, style]}
      >
        <LinearGradient
          colors={[BRAND.emeraldLight, BRAND.emerald, BRAND.emeraldDeep]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.gradientFill, radiusStyle]}
        >
          {content}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  if (isDanger) {
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        disabled={disabled || loading}
        style={[styles.btnBase, { backgroundColor: COLORS.danger }, radiusStyle, disabled && styles.disabled, style]}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.btnBase, styles.ghostBtn, radiusStyle, disabled && styles.disabled, style]}
    >
      {content}
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// GlassInput — frosted pill text field.
// ---------------------------------------------------------------------------
export function GlassInput({
  style,
  textStyle,
  ...props
}: TextInputProps & { style?: StyleProp<ViewStyle>; textStyle?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.inputWrap, style]}>
      <TextInput
        placeholderTextColor={COLORS.subtle}
        style={[styles.input, textStyle]}
        {...props}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// GlassPill — small frosted badge/chip.
// ---------------------------------------------------------------------------
export function GlassPill({
  label,
  active = false,
  onPress,
  tone = 'default',
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  tone?: 'default' | 'emerald' | 'gold' | 'danger';
}) {
  const toneColor =
    tone === 'emerald' ? BRAND.emerald : tone === 'gold' ? BRAND.gold : tone === 'danger' ? COLORS.danger : COLORS.ink;

  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper onPress={onPress} activeOpacity={0.8} style={[styles.pill, active && { backgroundColor: 'rgba(43,203,176,0.16)', borderColor: BRAND.emerald }]}>
      <Text style={[styles.pillText, { color: active ? BRAND.emerald : toneColor }]}>{label}</Text>
    </Wrapper>
  );
}

// ---------------------------------------------------------------------------
// GlassAvatar — photo or initial, in a frosted ring.
// ---------------------------------------------------------------------------
export function GlassAvatar({ size = 52, initial, uri }: { size?: number; initial: string; uri?: string | null }) {
  const { Image } = require('react-native');
  return (
    <View
      style={[
        styles.avatarRing,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: size - 4, height: size - 4, borderRadius: (size - 4) / 2 }} />
      ) : (
        <LinearGradient
          colors={[BRAND.emeraldLight, BRAND.emerald]}
          style={[styles.avatarFallback, { width: size - 4, height: size - 4, borderRadius: (size - 4) / 2 }]}
        >
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.38 }}>{initial}</Text>
        </LinearGradient>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  btnBase: {
    borderRadius: RADIUS.pill,
    overflow: 'hidden',
    height: 54,
  },
  gradientFill: {
    flex: 1,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: '100%',
  },
  btnLabel: {
    ...TYPE.subtitle,
  },
  disabled: {
    opacity: 0.5,
  },
  inputWrap: {
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
  },
  input: {
    height: 54,
    paddingHorizontal: SPACING.md,
    color: COLORS.ink,
    ...TYPE.body,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  pillText: {
    ...TYPE.caption,
    fontWeight: '700',
  },
  avatarRing: {
    borderWidth: 2,
    borderColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
