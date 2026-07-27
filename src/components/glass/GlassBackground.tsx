import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { MESH, COLORS } from '../../theme/glass';

const { width: W, height: H } = Dimensions.get('window');

/**
 * Edge-to-edge gradient mesh + soft floating color blobs. Renders once behind
 * the whole app (or per-screen) so glass surfaces on top always have
 * something with depth/color to refract. `variant="hero"` = tall saturated
 * mesh for Login/first-run; `variant="canvas"` = a calmer mostly-light wash
 * for regular in-app screens so foreground content stays readable.
 */
export default function GlassBackground({
  variant = 'canvas',
  children,
}: {
  variant?: 'hero' | 'canvas';
  children?: React.ReactNode;
}) {
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 9000, useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: 9000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [drift]);

  const translateY = drift.interpolate({ inputRange: [0, 1], outputRange: [0, 18] });
  const translateX = drift.interpolate({ inputRange: [0, 1], outputRange: [0, -14] });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {variant === 'hero' ? (
        <LinearGradient
          colors={MESH.base}
          start={MESH.baseAngle.start}
          end={MESH.baseAngle.end}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <LinearGradient
          colors={[COLORS.canvas, '#F1F8F3', COLORS.canvas]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.6, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}

      {variant === 'hero'
        ? MESH.blobs.map((b, i) => (
            <Animated.View
              key={i}
              pointerEvents="none"
              style={[
                styles.blob,
                {
                  width: b.size,
                  height: b.size,
                  borderRadius: b.size / 2,
                  top: b.top,
                  left: b.left,
                  backgroundColor: b.color,
                  transform: [
                    { translateY: i % 2 === 0 ? translateY : Animated.multiply(translateY, -1) },
                    { translateX: i % 2 === 0 ? translateX : Animated.multiply(translateX, -1) },
                  ],
                },
              ]}
            />
          ))
        : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  blob: {
    position: 'absolute',
  },
});
