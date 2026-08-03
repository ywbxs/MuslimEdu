import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, PanResponder, Dimensions } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import UserAvatar from './UserAvatar';
import { COLORS, RADIUS, SHADOW } from '../theme/glass';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const SURFACE = COLORS.surface;

export type SwipeDirection = 'right' | 'left' | 'up' | 'down';

// Present/Absent/Excused/Late cover the 4 quick-swipe directions - same
// mapping as SwipeableAttendanceCard (the old inline-list card), kept
// identical so muscle memory carries over between the two views.
const DIRECTION_META: Record<SwipeDirection, { label: string; color: string; soft: string }> = {
  right: { label: 'Present', color: '#0F9D58', soft: '#E7F5EC' },
  left: { label: 'Absent', color: '#E5484D', soft: '#FCEDED' },
  up: { label: 'Excused', color: '#4C6EF5', soft: '#EAEDFC' },
  down: { label: 'Late', color: '#B8860B', soft: '#FBF2DE' },
};

const SWIPE_THRESHOLD = 100;
const TAP_SLOP = 6;
const FLIGHT_DISTANCE = SCREEN_WIDTH * 1.15;
const FLIGHT_DURATION = 220;

function IconPin({ color, size = 15 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Circle cx={12} cy={9.5} r={2.4} stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}
function IconCake({ color, size = 15 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 21v-6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6M4 21h16M4 17c1.5 1 2.5-1 4 0s2.5 1 4 0 2.5-1 4 0 2.5 1 4 0M12 9V5M9 5c0-1.5 3-1.5 3-3 0 1.5 3 1.5 3 3" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export interface BigAttendanceCardProps {
  name: string;
  photo: string | null;
  subtitle?: string | null;
  address?: string | null;
  age?: number | null;
  statusLabel: string | null; // e.g. "Present" - null when not yet marked
  statusColor?: string | null;
  statusSoft?: string | null;
  onSwipeComplete: (direction: SwipeDirection) => void;
  onPress: () => void;
}

/**
 * One full-size, one-at-a-time attendance card - photo, name, address, age
 * and a status badge, marked by swiping the whole card off screen (like a
 * photo gallery / Tinder-style deck) instead of a row in a scrolling list.
 * Same 4-direction swipe-to-status gesture and tap-for-detail-sheet
 * behavior as SwipeableAttendanceCard, just at deck-card scale with a fly-
 * off exit animation - see TeacherAttendanceRosterScreen for how the parent
 * advances to the next student once onSwipeComplete fires.
 *
 * Built with RN's built-in PanResponder + Animated (no gesture-handler/
 * reanimated dependency), matching the rest of this app's swipe gestures.
 */
export default function BigAttendanceCard({
  name,
  photo,
  subtitle,
  address,
  age,
  statusLabel,
  statusColor,
  statusSoft,
  onSwipeComplete,
  onPress,
}: BigAttendanceCardProps) {
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const [previewDirection, setPreviewDirection] = useState<SwipeDirection | null>(null);
  const [isFlying, setIsFlying] = useState(false);

  const rotate = pan.x.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: ['-12deg', '0deg', '12deg'],
  });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isFlying,
      onMoveShouldSetPanResponder: (_evt, gesture) =>
        !isFlying && (Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2),
      onPanResponderMove: (_evt, gesture) => {
        pan.setValue({ x: gesture.dx, y: gesture.dy });

        if (Math.abs(gesture.dx) > Math.abs(gesture.dy)) {
          if (gesture.dx > SWIPE_THRESHOLD) setPreviewDirection('right');
          else if (gesture.dx < -SWIPE_THRESHOLD) setPreviewDirection('left');
          else setPreviewDirection(null);
        } else {
          if (gesture.dy < -SWIPE_THRESHOLD) setPreviewDirection('up');
          else if (gesture.dy > SWIPE_THRESHOLD) setPreviewDirection('down');
          else setPreviewDirection(null);
        }
      },
      onPanResponderRelease: (_evt, gesture) => {
        const isTap = Math.abs(gesture.dx) < TAP_SLOP && Math.abs(gesture.dy) < TAP_SLOP;
        setPreviewDirection(null);

        if (isTap) {
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, friction: 7 }).start();
          onPress();
          return;
        }

        const horizontal = Math.abs(gesture.dx) > Math.abs(gesture.dy);
        let direction: SwipeDirection | null = null;
        if (horizontal && gesture.dx > SWIPE_THRESHOLD) direction = 'right';
        else if (horizontal && gesture.dx < -SWIPE_THRESHOLD) direction = 'left';
        else if (!horizontal && gesture.dy < -SWIPE_THRESHOLD) direction = 'up';
        else if (!horizontal && gesture.dy > SWIPE_THRESHOLD) direction = 'down';

        if (!direction) {
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, friction: 7 }).start();
          return;
        }

        setIsFlying(true);
        const target =
          direction === 'right'
            ? { x: FLIGHT_DISTANCE, y: gesture.dy }
            : direction === 'left'
            ? { x: -FLIGHT_DISTANCE, y: gesture.dy }
            : direction === 'up'
            ? { x: gesture.dx, y: -FLIGHT_DISTANCE }
            : { x: gesture.dx, y: FLIGHT_DISTANCE };

        Animated.timing(pan, { toValue: target, duration: FLIGHT_DURATION, useNativeDriver: false }).start(() => {
          onSwipeComplete(direction as SwipeDirection);
        });
      },
      onPanResponderTerminate: () => {
        setPreviewDirection(null);
        Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, friction: 7 }).start();
      },
    }),
  ).current;

  const preview = previewDirection ? DIRECTION_META[previewDirection] : null;
  const badgeColor = preview?.color ?? statusColor ?? SUBTLE;
  const badgeSoft = preview?.soft ?? statusSoft ?? '#F1F3F2';
  const badgeText = preview?.label ?? statusLabel ?? 'Swipe to mark';

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.card,
        preview ? { borderColor: preview.color, borderWidth: 2 } : null,
        { transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate }] },
      ]}
    >
      {preview ? (
        <View style={[styles.stamp, { borderColor: preview.color }]}>
          <Text style={[styles.stampText, { color: preview.color }]}>{preview.label.toUpperCase()}</Text>
        </View>
      ) : null}

      <View style={styles.photoWrap}>
        <UserAvatar name={name} photo={photo} size={136} dotColor={null} ringColor="#FFFFFF" />
      </View>

      <Text style={styles.name} numberOfLines={1}>{name}</Text>
      {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}

      <View style={styles.infoWrap}>
        {address ? (
          <View style={styles.infoRow}>
            <IconPin color={SUBTLE} />
            <Text style={styles.infoText} numberOfLines={1}>{address}</Text>
          </View>
        ) : null}
        {age != null ? (
          <View style={styles.infoRow}>
            <IconCake color={SUBTLE} />
            <Text style={styles.infoText}>{age} years old</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.badge, { backgroundColor: badgeSoft }]}>
        <Text style={[styles.badgeText, { color: badgeColor }]} numberOfLines={1}>{badgeText}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: SCREEN_WIDTH - 40,
    alignSelf: 'center',
    backgroundColor: SURFACE,
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 22,
    paddingHorizontal: 22,
    ...SHADOW.level3,
  },
  photoWrap: { marginBottom: 16 },
  name: { fontSize: 21, fontWeight: '800', color: INK, textAlign: 'center' },
  subtitle: { fontSize: 13, color: SUBTLE, marginTop: 3, textAlign: 'center' },
  infoWrap: { width: '100%', marginTop: 18, gap: 10 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontSize: 14, color: INK, fontWeight: '500', flexShrink: 1 },
  badge: {
    marginTop: 20,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  badgeText: { fontSize: 13, fontWeight: '700' },
  stamp: {
    position: 'absolute',
    top: 24,
    right: 24,
    borderWidth: 3,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    transform: [{ rotate: '18deg' }],
    zIndex: 10,
  },
  stampText: { fontSize: 15, fontWeight: '800', letterSpacing: 0.6 },
});
