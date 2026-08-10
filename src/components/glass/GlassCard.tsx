import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
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
 * layered shadow. `surface="hero"` is for nav bars and overlays that sit on
 * top of imagery/dark heroes and want a frosted look.
 *
 * Neither uses a real BlurView - `@react-native-community/blur` doesn't
 * reliably respect this view's rounded-corner clipping on Android (it can
 * render as an unclipped rectangle instead of a blurred fill), so every
 * "glass" surface in this app approximates frosted glass with an opaque-
 * enough translucent fill instead - same tradeoff already used by
 * MainTabs.tsx's tab bar.
 */
export default function GlassCard({
  children,
  style,
  surface = 'light',
  radius = RADIUS.lg,
  padded = true,
  elevated = true,
  contentStyle,
}: GlassCardProps) {
  const isHero = surface === 'hero';
  const border = isHero ? GLASS.border : COLORS.border;

  return (
    <View
      style={[
        { borderRadius: radius, overflow: 'hidden', borderWidth: 1, borderColor: border },
        elevated && SHADOW.level2,
        style,
      ]}
    >
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: isHero ? 'rgba(20,32,29,0.72)' : COLORS.surface },
        ]}
      />
      <View style={[padded && styles.padded, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  padded: {
    padding: 18,
  },
});
