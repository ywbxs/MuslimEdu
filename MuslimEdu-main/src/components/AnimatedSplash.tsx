import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, StatusBar, Easing, useWindowDimensions } from 'react-native';
import Svg, { Defs, RadialGradient, LinearGradient, Stop, Rect, Circle } from 'react-native-svg';

/* ------------------------------------------------------------------ *
 * Animated splash for MuslimEdu (no Expo, no extra deps).
 *
 * Green gradient background (#16A34A -> #15803D) with a soft radial glow
 * behind the logo. The logo fades in, springs from 0.8x -> 1.0x, floats
 * gently, and pulses a soft glow. When `ready` flips true (auth/session
 * check done), the whole splash crossfades out via onFinish.
 *
 * Uses only react-native-svg (already in the project) and the RN Animated
 * API, so it runs on the native driver at 60fps.
 * ------------------------------------------------------------------ */

const AnimatedRect = Animated.createAnimatedComponent(Rect);

interface AnimatedSplashProps {
  /** Flip true once the app has finished initializing / checking auth. */
  ready: boolean;
  /** Called after the fade-out completes so the parent can unmount it. */
  onFinish: () => void;
  /** The logo image source, e.g. require('../assets/images/app-icon.png'). */
  logo: any;
}

export default function AnimatedSplash({ ready, onFinish, logo }: AnimatedSplashProps) {
  const { width, height } = useWindowDimensions();

  // Entrance
  const opacity = useRef(new Animated.Value(0)).current; // logo fade in
  const scale = useRef(new Animated.Value(0.8)).current; // logo spring 0.8 -> 1

  // Idle loops
  const float = useRef(new Animated.Value(0)).current; // vertical drift
  const glow = useRef(new Animated.Value(0)).current; // glow pulse
  const bgShift = useRef(new Animated.Value(0)).current; // subtle bg gradient drift

  // Exit
  const screenOpacity = useRef(new Animated.Value(1)).current; // whole splash fade out

  // --- Entrance sequence ---------------------------------------------------
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 550,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        tension: 60,
        useNativeDriver: true,
      }),
    ]).start();

    // Gentle floating (2-4px)
    Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ).start();

    // Soft glow pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    ).start();

    // Subtle background drift (not native-driven: animates SVG rect opacity)
    Animated.loop(
      Animated.sequence([
        Animated.timing(bgShift, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(bgShift, { toValue: 0, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ]),
    ).start();
  }, [opacity, scale, float, glow, bgShift]);

  // --- Exit crossfade once ready ------------------------------------------
  useEffect(() => {
    if (!ready) return;
    // Small min-hold so the entrance doesn't get cut off if auth is instant.
    const t = setTimeout(() => {
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 420,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) onFinish();
      });
    }, 350);
    return () => clearTimeout(t);
  }, [ready, screenOpacity, onFinish]);

  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [3, -3] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] });
  const glowScale = glow.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.12] });
  const bgOverlayOpacity = bgShift.interpolate({ inputRange: [0, 1], outputRange: [0, 0.18] });

  const logoSize = Math.min(width * 0.32, 148);
  const glowSize = logoSize * 2.6;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.container, { opacity: screenOpacity }]}>
      <StatusBar barStyle="light-content" backgroundColor="#16A34A" translucent />

      {/* Base + drifting gradient background */}
      <Svg style={StyleSheet.absoluteFill} width={width} height={height}>
        <Defs>
          <LinearGradient id="bgBase" x1="0" y1="0" x2="0.3" y2="1">
            <Stop offset="0" stopColor="#16A34A" />
            <Stop offset="1" stopColor="#15803D" />
          </LinearGradient>
          <LinearGradient id="bgDrift" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#1EB85A" />
            <Stop offset="1" stopColor="#0F6E36" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill="url(#bgBase)" />
        <AnimatedRect x="0" y="0" width={width} height={height} fill="url(#bgDrift)" opacity={bgOverlayOpacity} />
      </Svg>

      {/* Radial glow behind the logo */}
      <Animated.View
        style={{
          position: 'absolute',
          width: glowSize,
          height: glowSize,
          opacity: glowOpacity,
          transform: [{ scale: glowScale }],
        }}
        pointerEvents="none"
      >
        <Svg width={glowSize} height={glowSize}>
          <Defs>
            <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.55" />
              <Stop offset="0.5" stopColor="#BBF7D0" stopOpacity="0.18" />
              <Stop offset="1" stopColor="#16A34A" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx={glowSize / 2} cy={glowSize / 2} r={glowSize / 2} fill="url(#glow)" />
        </Svg>
      </Animated.View>

      {/* Logo */}
      <Animated.Image
        source={logo}
        resizeMode="contain"
        style={{
          width: logoSize,
          height: logoSize,
          opacity,
          transform: [{ scale }, { translateY }],
        }}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16A34A',
    zIndex: 999,
  },
});
