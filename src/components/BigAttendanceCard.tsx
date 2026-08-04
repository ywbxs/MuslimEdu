import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, PanResponder, Dimensions } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import LinearGradient from 'react-native-linear-gradient';
import UserAvatar from './UserAvatar';
import { COLORS, RADIUS, SHADOW } from '../theme/glass';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const SURFACE = COLORS.surface;

export type SwipeDirection = 'right' | 'left' | 'up' | 'down';

export interface DirectionMeta {
  code: string;
  label: string;
  color: string;
}

// Present/Absent/Excused/Late cover the 4 quick-swipe directions by default -
// same mapping as before, used whenever a caller doesn't pass its own
// (school-configured) directionMeta.
const DEFAULT_DIRECTION_META: Record<SwipeDirection, DirectionMeta> = {
  right: { code: 'present', label: 'Present', color: '#0F9D58' },
  left: { code: 'absent', label: 'Absent', color: '#E5484D' },
  up: { code: 'excused', label: 'Excused', color: '#4C6EF5' },
  down: { code: 'late', label: 'Late', color: '#B8860B' },
};

// Lightens a "#RRGGBB" color into a soft translucent fill for badges/stamps,
// so a dynamically-configured status color (from AttendanceStatusConfig)
// always has a matching soft background without needing a second color
// stored per status.
function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const SWIPE_THRESHOLD = 100;
const TAP_SLOP = 6;
const FLIGHT_DISTANCE = SCREEN_WIDTH * 1.15;
const FLIGHT_DURATION = 220;
const HEADER_HEIGHT = 64;

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
  // Maps the 4 swipe directions to the school's configured statuses (falls
  // back to the present/absent/excused/late defaults above if omitted).
  directionMeta?: Partial<Record<SwipeDirection, DirectionMeta>>;
  onSwipeComplete: (direction: SwipeDirection, code: string) => void;
  onPress: () => void;
}

/**
 * One full-size, one-at-a-time attendance card - styled like the school's ID
 * card (gradient header band, avatar overlapping the header/body boundary)
 * so the manual swipe-attendance flow visually matches the printed/exported
 * ID card instead of looking like a plain unrelated profile card - marked by
 * swiping the whole card off screen (like a photo gallery / Tinder-style
 * deck) instead of a row in a scrolling list. Same 4-direction swipe-to-
 * status gesture and tap-for-detail-sheet behavior as before, just at deck-
 * card scale with a fly-off exit animation - see TeacherAttendanceRosterScreen
 * for how the parent advances to the next student once onSwipeComplete fires.
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
  directionMeta,
  onSwipeComplete,
  onPress,
}: BigAttendanceCardProps) {
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const [previewDirection, setPreviewDirection] = useState<SwipeDirection | null>(null);
  const [isFlying, setIsFlying] = useState(false);

  const meta: Record<SwipeDirection, DirectionMeta> = {
    right: directionMeta?.right ?? DEFAULT_DIRECTION_META.right,
    left: directionMeta?.left ?? DEFAULT_DIRECTION_META.left,
    up: directionMeta?.up ?? DEFAULT_DIRECTION_META.up,
    down: directionMeta?.down ?? DEFAULT_DIRECTION_META.down,
  };

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
          onSwipeComplete(direction as SwipeDirection, meta[direction as SwipeDirection].code);
        });
      },
      onPanResponderTerminate: () => {
        setPreviewDirection(null);
        Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, friction: 7 }).start();
      },
    }),
  ).current;

  const preview = previewDirection ? meta[previewDirection] : null;
  const badgeColor = preview?.color ?? statusColor ?? SUBTLE;
  const badgeSoft = preview ? withAlpha(preview.color, 0.12) : statusSoft ?? '#F1F3F2';
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

      <LinearGradient colors={['#0B3D2E', '#0F9D58', '#22C55E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerBand} />

      <View style={styles.photoWrap}>
        <UserAvatar name={name} photo={photo} size={120} dotColor={null} ringColor="#FFFFFF" />
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
    overflow: 'hidden',
    paddingBottom: 22,
    paddingHorizontal: 22,
    ...SHADOW.level3,
  },
  headerBand: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HEADER_HEIGHT,
  },
  photoWrap: { marginTop: HEADER_HEIGHT - 60, marginBottom: 16 },
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
