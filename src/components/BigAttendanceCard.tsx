import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, PanResponder, Dimensions } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';
import UserAvatar from './UserAvatar';
import { COLORS, RADIUS, SHADOW } from '../theme/glass';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;

export type SwipeDirection = 'right' | 'left' | 'up' | 'down';

// Present/Absent/Excused/Late cover the 4 quick-swipe directions - same
// mapping as the quick-mark chip bar on TeacherAttendanceRosterScreen, kept
// identical so muscle memory carries over between the two ways of marking.
const DIRECTION_META: Record<SwipeDirection, { label: string; color: string; soft: string }> = {
  right: { label: 'Present', color: '#0F9D58', soft: '#E7F5EC' },
  left: { label: 'Absent', color: '#E5484D', soft: '#FCEDED' },
  up: { label: 'Excused', color: '#4C6EF5', soft: '#EAEDFC' },
  down: { label: 'Late', color: '#B8860B', soft: '#FBF2DE' },
};

// Same deep-emerald gradient as CARD_THEMES[0] in StudentIdCard.tsx, so the
// card a teacher swipes through during manual attendance reads as "the same
// real ID card" rather than a plain, unrelated list-row card.
const CARD_GRADIENT: [string, string, string] = ['#0B3D2E', '#0F9D58', '#22C55E'];

const SWIPE_THRESHOLD = 100;
const TAP_SLOP = 6;
const FLIGHT_DISTANCE = SCREEN_WIDTH * 1.15;
const FLIGHT_DURATION = 220;

function IconPin({ color, size = 13 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Circle cx={12} cy={9.5} r={2.4} stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}
function IconCake({ color, size = 13 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 21v-6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6M4 21h16M4 17c1.5 1 2.5-1 4 0s2.5 1 4 0 2.5-1 4 0 2.5 1 4 0M12 9V5M9 5c0-1.5 3-1.5 3-3 0 1.5 3 1.5 3 3" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconLock({ color = '#FFFFFF', size = 22 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={5} y={11} width={14} height={9} rx={2} stroke={color} strokeWidth={2} />
      <Path d="M8 11V8a4 4 0 0 1 8 0v3" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={12} y1={15} x2={12} y2={17} stroke={color} strokeWidth={2} strokeLinecap="round" />
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
  schoolName?: string | null;
  onSwipeComplete: (direction: SwipeDirection) => void;
  onPress: () => void;
  // True once the roster has been saved/"done" for this date - the card
  // stops responding to swipes/taps (a locked padlock badge shows instead
  // of the status pill) until the teacher unlocks it to fix a mistake.
  disabled?: boolean;
}

/**
 * One full-size, one-at-a-time attendance card styled like the school's
 * real Student ID card (same gradient/kicker-label look as
 * components/StudentIdCard.tsx) instead of a plain white card - photo,
 * name, ID code, address and age, marked by swiping the whole card off
 * screen (like a photo gallery / Tinder-style deck). Same 4-direction
 * swipe-to-status gesture and tap-for-detail-sheet behavior as before, just
 * re-skinned; see TeacherAttendanceRosterScreen for how the parent advances
 * to the next student once onSwipeComplete fires, and for the lock/unlock
 * flow that sets `disabled`.
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
  schoolName,
  onSwipeComplete,
  onPress,
  disabled = false,
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
      onStartShouldSetPanResponder: () => !isFlying && !disabled,
      onMoveShouldSetPanResponder: (_evt, gesture) =>
        !isFlying && !disabled && (Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2),
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
  const badgeColor = preview?.color ?? statusColor ?? 'rgba(255,255,255,0.85)';
  const badgeSoft = preview?.soft ?? statusSoft ?? 'rgba(255,255,255,0.16)';
  const badgeText = preview?.label ?? statusLabel ?? 'Swipe to mark';
  const badgeTextColor = preview || statusColor ? (preview ? preview.color : '#FFFFFF') : '#FFFFFF';

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.cardShadow,
        { transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate }] },
      ]}
    >
      <LinearGradient
        colors={CARD_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, preview ? { borderColor: preview.color, borderWidth: 2 } : null]}
      >
        {preview ? (
          <View style={[styles.stamp, { borderColor: preview.color }]}>
            <Text style={[styles.stampText, { color: preview.color }]}>{preview.label.toUpperCase()}</Text>
          </View>
        ) : null}

        {disabled ? (
          <View style={styles.lockOverlay}>
            <IconLock />
          </View>
        ) : null}

        <View style={styles.kickerWrap}>
          <Text style={styles.kicker}>{schoolName ? schoolName.toUpperCase() : 'STUDENT ID CARD'}</Text>
        </View>

        <View style={styles.photoWrap}>
          <UserAvatar name={name} photo={photo} size={124} dotColor={null} ringColor="rgba(255,255,255,0.7)" />
        </View>

        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}

        <View style={styles.infoWrap}>
          {address ? (
            <View style={styles.infoRow}>
              <IconPin color="rgba(255,255,255,0.85)" />
              <Text style={styles.infoText} numberOfLines={1}>{address}</Text>
            </View>
          ) : null}
          {age != null ? (
            <View style={styles.infoRow}>
              <IconCake color="rgba(255,255,255,0.85)" />
              <Text style={styles.infoText}>{age} years old</Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.badge, { backgroundColor: disabled ? 'rgba(255,255,255,0.16)' : badgeSoft }]}>
          <Text style={[styles.badgeText, { color: disabled ? '#FFFFFF' : badgeTextColor }]} numberOfLines={1}>
            {disabled ? 'Locked' : badgeText}
          </Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cardShadow: {
    width: SCREEN_WIDTH - 40,
    alignSelf: 'center',
    borderRadius: RADIUS.xl,
    ...SHADOW.level3,
  },
  card: {
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 22,
    paddingHorizontal: 22,
    overflow: 'hidden',
  },
  kickerWrap: { marginBottom: 16 },
  kicker: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  photoWrap: { marginBottom: 16 },
  name: { fontSize: 21, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 3, textAlign: 'center', fontWeight: '600' },
  infoWrap: { width: '100%', marginTop: 18, gap: 10 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontSize: 14, color: '#FFFFFF', fontWeight: '500', flexShrink: 1 },
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
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  stampText: { fontSize: 15, fontWeight: '800', letterSpacing: 0.6 },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(11,13,16,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
});
