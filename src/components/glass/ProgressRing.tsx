import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

/**
 * Simple circular progress indicator built on react-native-svg (already a
 * dependency everywhere in this app) rather than pulling in a charting
 * library for one ring. Pass 0-100; the ring itself is just two stacked
 * <Circle> strokes with a dash offset trick, no external chart lib needed.
 */
export default function ProgressRing({
  percent,
  size = 88,
  strokeWidth = 9,
  color,
  trackColor,
  label,
  labelColor,
}: {
  percent: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  trackColor: string;
  label?: string;
  labelColor?: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.centerWrap}>
          <Text style={[styles.percentText, { color: labelColor ?? color, fontSize: size * 0.24 }]}>{Math.round(clamped)}%</Text>
          {label ? <Text style={[styles.labelText, { color: labelColor ?? color }]}>{label}</Text> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  percentText: { fontWeight: '800' },
  labelText: { fontSize: 9, fontWeight: '600', marginTop: 1 },
});
