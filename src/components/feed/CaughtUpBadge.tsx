import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useLocale } from '../../context/LocaleContext';
import { COLORS, RADIUS } from '../../theme/glass';

const EMERALD = COLORS.emerald;
const EMERALD_SOFT = COLORS.emeraldSoft;

function CheckIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M4 12.5l5 5L20 6.5" stroke={EMERALD} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/**
 * "All caught up for today" pill - shown once the reader has swiped past
 * every post made today in the feed deck (see FeedScreen.tsx's caughtUp
 * calc). Renders nothing until first shown, so it never reserves layout
 * space in the header.
 */
export default function CaughtUpBadge({ visible }: { visible: boolean }) {
  const { t } = useLocale();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.6)).current;
  const everShown = useRef(false);

  useEffect(() => {
    if (!visible) return;
    everShown.current = true;
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1.08, useNativeDriver: true, speed: 24 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 24 }),
    ]).start();
  }, [visible, opacity, scale]);

  if (!visible && !everShown.current) return null;

  return (
    <Animated.View style={[styles.badge, { opacity, transform: [{ scale }] }]}>
      <CheckIcon />
      <Text style={styles.label}>{t('feed.caught_up', 'All caught up')}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 34,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 12,
    backgroundColor: EMERALD_SOFT,
    borderWidth: 1.5,
    borderColor: EMERALD,
    gap: 6,
  },
  label: { fontSize: 12, fontWeight: '700', color: EMERALD },
});
