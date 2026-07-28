import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

const SIZE = 52;
const STROKE = 5;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const MAX_RATING = 5;

interface RatingGaugeProps {
  label: string;
  value: number | null;
  color: string;
  trackColor?: string;
}

// Circular 1-5 rating readout, replacing the plain "Academic: 5" text line.
// Renders an empty ring (no progress) when value is null, same as the old
// "—" fallback for a report with no rating recorded.
export default function RatingGauge({ label, value, color, trackColor = '#E3E7E1' }: RatingGaugeProps) {
  const fraction = value ? Math.max(0, Math.min(value, MAX_RATING)) / MAX_RATING : 0;
  const dashOffset = CIRCUMFERENCE * (1 - fraction);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.ringBox}>
        <Svg width={SIZE} height={SIZE}>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={trackColor}
            strokeWidth={STROKE}
            fill="none"
          />
          {value !== null && (
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              stroke={color}
              strokeWidth={STROKE}
              fill="none"
              strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              rotation={-90}
              originX={SIZE / 2}
              originY={SIZE / 2}
            />
          )}
        </Svg>
        <View style={styles.ringInner} pointerEvents="none">
          <Text style={styles.ringText}>{value !== null ? `${value}/5` : '—'}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#F3F5F2', borderRadius: 16, padding: 12, alignItems: 'flex-start' },
  label: { fontSize: 10.5, fontWeight: '700', color: '#7A8078', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 },
  ringBox: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  ringInner: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  ringText: { fontSize: 12.5, fontWeight: '700', color: '#14171A' },
});
