import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { md3 } from '../theme';
import { useLocale } from '../../../../context/LocaleContext';

export interface StepDef {
  key: string;
  title: string;
}

function CheckMark({ size = 12 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline
        points="5 13 10 18 19 7"
        stroke={md3.color.onPrimary}
        strokeWidth={3.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function StepDot({ index, active, done }: { index: number; active: boolean; done: boolean }) {
  const scale = useRef(new Animated.Value(active ? 1 : 0.94)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: active ? 1 : 0.94,
      useNativeDriver: true,
      friction: 6,
      tension: 80,
    }).start();
  }, [active, scale]);

  return (
    <Animated.View
      style={[
        styles.dot,
        done && styles.dotDone,
        active && styles.dotActive,
        { transform: [{ scale }] },
      ]}
    >
      {done ? (
        <CheckMark />
      ) : (
        <Text style={[styles.dotText, active && styles.dotTextActive]}>{index + 1}</Text>
      )}
    </Animated.View>
  );
}

export default function Stepper({ steps, activeIndex }: { steps: StepDef[]; activeIndex: number }) {
  const { t } = useLocale();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: activeIndex,
      duration: md3.motion.standard,
      useNativeDriver: false,
    }).start();
  }, [activeIndex, progress]);

  return (
    <View>
      <View style={styles.row}>
        {steps.map((s, i) => (
          <React.Fragment key={s.key}>
            <StepDot index={i} active={i === activeIndex} done={i < activeIndex} />
            {i < steps.length - 1 ? (
              <View style={styles.lineTrack}>
                <Animated.View
                  style={[
                    styles.lineFill,
                    {
                      width: progress.interpolate({
                        inputRange: [i, i + 1],
                        outputRange: ['0%', '100%'],
                        extrapolate: 'clamp',
                      }),
                    },
                  ]}
                />
              </View>
            ) : null}
          </React.Fragment>
        ))}
      </View>
      <Text style={styles.caption}>
        {t('stepper.step', 'Step')} {activeIndex + 1} {t('stepper.of', 'of')} {steps.length} · {steps[activeIndex]?.title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  dot: {
    width: 30,
    height: 30,
    borderRadius: md3.shape.full,
    backgroundColor: md3.color.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: md3.color.outlineVariant,
  },
  dotActive: {
    backgroundColor: md3.color.primaryContainer,
    borderColor: md3.color.primary,
    borderWidth: 2,
  },
  dotDone: { backgroundColor: md3.color.primary, borderColor: md3.color.primary },
  dotText: { fontSize: 12.5, fontWeight: '700', color: md3.color.onSurfaceVariant },
  dotTextActive: { color: md3.color.onPrimaryContainer },
  lineTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: md3.color.surfaceContainerHigh,
    marginHorizontal: 6,
    overflow: 'hidden',
  },
  lineFill: { height: '100%', backgroundColor: md3.color.primary, borderRadius: 2 },
  caption: {
    marginTop: 10,
    fontSize: md3.type.labelMedium.fontSize,
    fontWeight: md3.type.labelMedium.fontWeight,
    letterSpacing: md3.type.labelMedium.letterSpacing,
    color: md3.color.onSurfaceVariant,
    textTransform: 'uppercase',
  },
});
