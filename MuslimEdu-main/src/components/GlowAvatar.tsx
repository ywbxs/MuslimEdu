import React from 'react';
import { View, Image, StyleSheet, ImageSourcePropType } from 'react-native';

interface GlowAvatarProps {
  source: ImageSourcePropType;
  glowColor: string;
  size?: number;
  style?: object;
}

/**
 * Renders a circular avatar with a soft colored glow behind it, approximating
 * the blurred halo look from the reference design. Built with layered
 * semi-transparent circles rather than a native blur library, so it works
 * identically on Android and iOS with no extra native dependency/build risk.
 */
export default function GlowAvatar({ source, glowColor, size = 100, style }: GlowAvatarProps) {
  const glowSize = size * 1.6;

  return (
    <View style={[{ width: glowSize, height: glowSize }, styles.center, style]}>
      {/* Outer soft glow layers - decreasing opacity mimics a blur falloff */}
      <View
        style={[
          styles.glowLayer,
          { width: glowSize, height: glowSize, borderRadius: glowSize / 2, backgroundColor: glowColor, opacity: 0.18 },
        ]}
      />
      <View
        style={[
          styles.glowLayer,
          { width: glowSize * 0.8, height: glowSize * 0.8, borderRadius: (glowSize * 0.8) / 2, backgroundColor: glowColor, opacity: 0.28 },
        ]}
      />
      <View
        style={[
          styles.glowLayer,
          { width: size * 1.08, height: size * 1.08, borderRadius: (size * 1.08) / 2, backgroundColor: glowColor, opacity: 0.9 },
        ]}
      />
      <Image
        source={source}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  glowLayer: { position: 'absolute' },
});
