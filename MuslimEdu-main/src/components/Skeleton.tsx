import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';

const SKELETON_BASE = '#E7E9EC';

/**
 * A pulsing placeholder block. Drop these into a layout shaped like the
 * real content (same positions/sizes) so there's no jump when the real
 * data swaps in - that's the whole point of a skeleton over a spinner.
 */
export function Skeleton({
  width,
  height,
  borderRadius = 8,
  style,
}: {
  width: number | `${number}%`;
  height: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: SKELETON_BASE, opacity: pulse },
        style,
      ]}
    />
  );
}

export function SkeletonCircle({
  size,
  style,
}: {
  size: number;
  style?: StyleProp<ViewStyle>;
}) {
  return <Skeleton width={size} height={size} borderRadius={size / 2} style={style} />;
}
