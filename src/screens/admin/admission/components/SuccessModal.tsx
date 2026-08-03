import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated, Easing } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { md3 } from '../theme';
import { useLocale } from '../../../../context/LocaleContext';

function AnimatedCheck({ progress }: { progress: Animated.Value }) {
  return (
    <Svg width={56} height={56} viewBox="0 0 24 24" fill="none">
      <Polyline
        points="5 13 10 18 19 7"
        stroke={md3.color.onPrimary}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        // AnimatedProps isn't available on plain Svg without reanimated, so we
        // fade+scale the whole glyph instead of drawing it stroke-by-stroke -
        // still reads as a deliberate "pop in", just via opacity/scale.
        opacity={1}
      />
    </Svg>
  );
}

export default function AdmissionSuccessModal({
  visible,
  studentName,
  onViewStudent,
  onAdmitAnother,
}: {
  visible: boolean;
  studentName: string;
  onViewStudent: () => void;
  onAdmitAnother: () => void;
}) {
  const { t } = useLocale();
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.85)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0.4)).current;
  const checkScale = useRef(new Animated.Value(0.3)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      backdropOpacity.setValue(0);
      cardScale.setValue(0.85);
      cardOpacity.setValue(0);
      ringScale.setValue(0.4);
      checkScale.setValue(0.3);
      checkOpacity.setValue(0);

      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: md3.motion.fast,
          useNativeDriver: true,
        }),
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: md3.motion.standard,
          useNativeDriver: true,
        }),
        Animated.spring(cardScale, {
          toValue: 1,
          useNativeDriver: true,
          friction: 7,
          tension: 90,
        }),
        Animated.sequence([
          Animated.delay(120),
          Animated.spring(ringScale, {
            toValue: 1,
            useNativeDriver: true,
            friction: 6,
            tension: 100,
          }),
        ]),
        Animated.sequence([
          Animated.delay(220),
          Animated.parallel([
            Animated.timing(checkOpacity, {
              toValue: 1,
              duration: 180,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.spring(checkScale, {
              toValue: 1,
              useNativeDriver: true,
              friction: 5,
              tension: 140,
            }),
          ]),
        ]),
      ]).start();
    }
  }, [visible, backdropOpacity, cardScale, cardOpacity, ringScale, checkScale, checkOpacity]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onAdmitAnother}>
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Animated.View
          style={[
            styles.card,
            { opacity: cardOpacity, transform: [{ scale: cardScale }] },
          ]}
        >
          <Animated.View style={[styles.ring, { transform: [{ scale: ringScale }] }]}>
            <Animated.View
              style={[
                styles.checkFill,
                { opacity: checkOpacity, transform: [{ scale: checkScale }] },
              ]}
            >
              <AnimatedCheck progress={checkOpacity} />
            </Animated.View>
          </Animated.View>

          <Text style={styles.title}>{t('admission_success.title', 'Student admitted successfully.')}</Text>
          <Text style={styles.subtitle}>
            <Text style={styles.subtitleName}>{studentName}</Text> {t('admission_success.enrolled', 'is now enrolled in your school.')}
          </Text>

          <TouchableOpacity style={styles.filledButton} onPress={onViewStudent} activeOpacity={0.88}>
            <Text style={styles.filledButtonText}>{t('admission_success.view_student', 'View Student')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.outlinedButton} onPress={onAdmitAnother} activeOpacity={0.88}>
            <Text style={styles.outlinedButtonText}>{t('admission_success.admit_another', 'Admit Another Student')}</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    // Solid, not the theme's translucent glass scrim - this modal covers a
    // form the admin just filled in with real data (student code, phone,
    // password field), and glass surfaces let that text visibly bleed
    // through behind the confirmation card.
    backgroundColor: 'rgba(8, 15, 12, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    // Solid white, not md3.color.surface (translucent glass) - same
    // bleed-through reasoning as the backdrop above.
    backgroundColor: '#FFFFFF',
    borderRadius: md3.shape.xl,
    paddingTop: 36,
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
    ...md3.elevation.level3,
  },
  ring: {
    width: 96,
    height: 96,
    borderRadius: md3.shape.full,
    backgroundColor: md3.color.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  checkFill: {
    width: 68,
    height: 68,
    borderRadius: md3.shape.full,
    backgroundColor: md3.color.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: md3.type.titleLarge.fontSize,
    fontWeight: md3.type.titleLarge.fontWeight,
    color: md3.color.onSurface,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: md3.type.bodyLarge.fontSize,
    color: md3.color.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 26,
    lineHeight: 21,
  },
  subtitleName: { color: md3.color.onSurface, fontWeight: '700' },
  filledButton: {
    backgroundColor: md3.color.primary,
    borderRadius: md3.shape.full,
    paddingVertical: 15,
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
  },
  filledButtonText: {
    color: md3.color.onPrimary,
    fontSize: md3.type.labelLarge.fontSize,
    fontWeight: md3.type.labelLarge.fontWeight,
    letterSpacing: 0.2,
  },
  outlinedButton: {
    borderRadius: md3.shape.full,
    paddingVertical: 15,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1.5,
    borderColor: md3.color.outline,
  },
  outlinedButtonText: {
    color: md3.color.primary,
    fontSize: md3.type.labelLarge.fontSize,
    fontWeight: md3.type.labelLarge.fontWeight,
    letterSpacing: 0.2,
  },
});
