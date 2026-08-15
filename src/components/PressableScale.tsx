import React, { useRef } from 'react';
import { Animated, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';

type Props = Omit<PressableProps, 'style'> & {
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

// Feedback lands the instant a finger touches down (onPressIn), not after
// the tap commits on release - a pressed control should never feel like
// it's waiting on you. Scaling down on press-in and springing back on
// release/cancel is the same tactile pattern iOS uses for its own controls.
export default function PressableScale({ scaleTo = 0.92, style, children, onPressIn, onPressOut, ...rest }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Pressable
      style={style}
      onPressIn={(e) => {
        Animated.spring(scale, { toValue: scaleTo, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }).start();
        onPressOut?.(e);
      }}
      {...rest}
    >
      {/* Layout (flex/position/size) lives on the Pressable itself above, so
          this component drops into flex layouts (e.g. a row of evenly-spaced
          tab items) exactly like a plain View would - only the scale
          transform lives here. */}
      <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>
    </Pressable>
  );
}
