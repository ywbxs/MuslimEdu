import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, PanResponder, TouchableWithoutFeedback } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import UserAvatar from './UserAvatar';
import { COLORS, RADIUS, SHADOW, SPACING } from '../theme/glass';

const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const SURFACE = COLORS.surface;

export type SwipeDirection = 'right' | 'left' | 'up' | 'down';

// Present/Absent/Excused/Late cover the 4 quick-swipe directions - Leave is
// rare enough to live behind a tap (see the detail sheet the parent screen
// opens via onPress) rather than needing its own fast path.
const DIRECTION_META: Record<SwipeDirection, { label: string; color: string; soft: string }> = {
  right: { label: 'Present', color: '#0F9D58', soft: '#E7F5EC' },
  left: { label: 'Absent', color: '#E5484D', soft: '#FCEDED' },
  up: { label: 'Excused', color: '#4C6EF5', soft: '#EAEDFC' },
  down: { label: 'Late', color: '#B8860B', soft: '#FBF2DE' },
};

const SWIPE_THRESHOLD = 56;
const TAP_SLOP = 6;
const MAX_TRANSLATE = 34;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function IconCheck({ color, size = 13 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 12.5l5 5L20 6" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconClock({ color, size = 13 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2.4} />
      <Path d="M12 7v5l3.5 2" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export interface SwipeableAttendanceCardProps {
  name: string;
  photo: string | null;
  subtitle?: string | null;
  statusLabel: string | null; // e.g. "Present" - null when not yet marked
  statusColor?: string | null;
  statusSoft?: string | null;
  onSwipe: (direction: SwipeDirection) => void;
  onPress: () => void;
}

/**
 * One bento-style attendance card: photo, name, section/class, and a
 * status badge, marked by swiping instead of tapping a row of tiny letter
 * buttons. Built with RN's built-in PanResponder + Animated (no
 * gesture-handler/reanimated dependency) - the card nudges a few px toward
 * the drag direction and previews the target status's color/label past the
 * swipe threshold, then springs back to rest; the actual status change is
 * reflected by the persistent badge, not by the card staying displaced (it
 * sits inline in a scrolling list, not a card deck).
 *
 * Tapping (a drag under TAP_SLOP) calls onPress instead of swiping - the
 * parent screen uses this to open a detail sheet for Leave + remarks, the
 * two things a 4-way swipe doesn't cover.
 */
export default function SwipeableAttendanceCard({
  name,
  photo,
  subtitle,
  statusLabel,
  statusColor,
  statusSoft,
  onSwipe,
  onPress,
}: SwipeableAttendanceCardProps) {
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const [previewDirection, setPreviewDirection] = useState<SwipeDirection | null>(null);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_evt, gesture) => Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2,
      onPanResponderMove: (_evt, gesture) => {
        const x = clamp(gesture.dx, -MAX_TRANSLATE, MAX_TRANSLATE);
        const y = clamp(gesture.dy, -MAX_TRANSLATE, MAX_TRANSLATE);
        pan.setValue({ x, y });

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
        Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, friction: 7 }).start();
        setPreviewDirection(null);

        if (isTap) {
          onPress();
          return;
        }

        const horizontal = Math.abs(gesture.dx) > Math.abs(gesture.dy);
        if (horizontal && gesture.dx > SWIPE_THRESHOLD) onSwipe('right');
        else if (horizontal && gesture.dx < -SWIPE_THRESHOLD) onSwipe('left');
        else if (!horizontal && gesture.dy < -SWIPE_THRESHOLD) onSwipe('up');
        else if (!horizontal && gesture.dy > SWIPE_THRESHOLD) onSwipe('down');
      },
      onPanResponderTerminate: () => {
        Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, friction: 7 }).start();
        setPreviewDirection(null);
      },
    }),
  ).current;

  const preview = previewDirection ? DIRECTION_META[previewDirection] : null;
  const badgeColor = preview?.color ?? statusColor ?? SUBTLE;
  const badgeSoft = preview?.soft ?? statusSoft ?? '#F1F3F2';
  const badgeText = preview?.label ?? statusLabel ?? 'Swipe to mark';

  return (
    <TouchableWithoutFeedback>
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.card,
          preview ? { backgroundColor: preview.soft, borderColor: preview.color } : null,
          { transform: [{ translateX: pan.x }, { translateY: pan.y }] },
        ]}
      >
        <UserAvatar name={name} photo={photo} size={52} dotColor={null} />
        <View style={styles.infoCol}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        <View style={[styles.badge, { backgroundColor: badgeSoft }]}>
          {statusLabel === 'Present' && !preview ? <IconCheck color={badgeColor} /> : null}
          {statusLabel === 'Late' && !preview ? <IconClock color={badgeColor} /> : null}
          <Text style={[styles.badgeText, { color: badgeColor }]} numberOfLines={1}>{badgeText}</Text>
        </View>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
    padding: SPACING.sm,
    marginBottom: SPACING.sm - 2,
    ...SHADOW.level1,
  },
  infoCol: { flex: 1, marginLeft: 12, marginRight: 8 },
  name: { fontSize: 14.5, fontWeight: '700', color: INK },
  subtitle: { fontSize: 12, color: SUBTLE, marginTop: 2 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
    maxWidth: 108,
  },
  badgeText: { fontSize: 11.5, fontWeight: '700' },
});
