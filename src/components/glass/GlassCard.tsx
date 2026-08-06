import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { COLORS, GLASS, RADIUS, SHADOW } from '../../theme/glass';

interface GlassCardProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** 'light' (default) = solid white card for normal content. 'hero' = real frosted blur, for nav/overlays only. */
  surface?: 'light' | 'hero';
  intensity?: number;
  radius?: number;
  padded?: boolean;
  elevated?: boolean;
  /**
   * Style for the inner wrapper the children actually sit in. Only needed
   * when that wrapper has to stretch rather than size to its content - e.g.
   * `{ flex: 1 }` so a ScrollView child gets a bounded height and can
   * actually scroll. Omit for the normal content-sized card.
   */
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * The atomic building block of the redesign. `surface="light"` (default,
 * nearly every screen) is a plain solid white card — hairline border, soft
 * layered shadow, no blur. `surface="hero"` is reserved for nav bars and
 * overlays that sit on top of imagery/dark heroes and want real frosted blur.
 */
export default function GlassCard({
  children,
  style,
  surface = 'light',
  intensity,
  radius = RADIUS.lg,
  padded = true,
  elevated = true,
  contentStyle,
}: GlassCardProps) {
  const isHero = surface === 'hero';
  const border = isHero ? GLASS.border : COLORS.border;
  const blurAmount = intensity ?? GLASS.blurAmount.md;

  return (
    <View
      style={[
        { borderRadius: radius, overflow: 'hidden', borderWidth: 1, borderColor: border },
        elevated && SHADOW.level2,
        style,
      ]}
    >
      {isHero ? (
        <>
          <BlurView
            blurType="dark"
            blurAmount={blurAmount}
            reducedTransparencyFallbackColor={GLASS.fill}
            style={StyleSheet.absoluteFill}
          />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: GLASS.fill }]} />
        </>
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.surface }]} />
      )}
      <View style={[padded && styles.padded, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  padded: {
    padding: 18,
  },
});
