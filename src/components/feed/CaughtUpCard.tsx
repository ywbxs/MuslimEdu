import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { CircleCheck } from 'lucide-react-native';
import { useLocale } from '../../context/LocaleContext';
import { COLORS } from '../../theme/glass';

const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;

/**
 * The feed's own end-of-list marker - appended once pagination is
 * exhausted (see FeedScreen.tsx's deckData), the last thing reached
 * scrolling down the vertical feed, instead of a pill overlaid on top of
 * the last post.
 *
 * Plain black outline icon directly on the feed's own background, no card
 * box around it - a flat "you're done" marker, not another post-shaped
 * tile competing with the actual feed content above it.
 *
 * `visible` (whether this has actually scrolled into view, tracked by
 * FeedScreen's onViewableItemsChanged) drives a one-shot entrance
 * animation the first time it's reached, followed by a continuous slow
 * breathing pulse on the icon so it stays visibly alive rather than
 * freezing the instant the entrance finishes.
 */
export default function CaughtUpCard({ visible }: { visible?: boolean }) {
  const { t } = useLocale();

  const iconScale = useRef(new Animated.Value(0)).current;
  const iconRotate = useRef(new Animated.Value(0)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(10)).current;
  const hasAnimatedRef = useRef(false);
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!visible || hasAnimatedRef.current) return;
    hasAnimatedRef.current = true;

    Animated.stagger(80, [
      Animated.parallel([
        Animated.timing(iconScale, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.back(1.8)),
          useNativeDriver: true,
        }),
        Animated.timing(iconRotate, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.back(1.8)),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(textOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(textTranslateY, { toValue: 0, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
    ]).start(() => {
      // A slow, subtle breathing loop once the entrance settles - keeps
      // the checkmark reading as "alive" instead of a static icon that
      // only ever moved once, on first reveal.
      pulseLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseScale, { toValue: 1.08, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(pulseScale, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      );
      pulseLoopRef.current.start();
    });

    return () => {
      pulseLoopRef.current?.stop();
    };
  }, [visible, iconScale, iconRotate, pulseScale, textOpacity, textTranslateY]);

  const spin = iconRotate.interpolate({ inputRange: [0, 1], outputRange: ['-30deg', '0deg'] });

  return (
    <View style={styles.wrap}>
      <Animated.View style={{ transform: [{ scale: Animated.multiply(iconScale, pulseScale) }, { rotate: spin }] }}>
        <CircleCheck color={INK} size={60} strokeWidth={1.6} />
      </Animated.View>
      <Animated.Text style={[styles.title, { opacity: textOpacity, transform: [{ translateY: textTranslateY }] }]}>
        {t('feed.caught_up', 'All caught up')}
      </Animated.Text>
      <Animated.Text style={[styles.subtitle, { opacity: textOpacity, transform: [{ translateY: textTranslateY }] }]}>
        {t('feed.caught_up_desc', "You've seen every post for now - check back later for more.")}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
  },
  title: { fontSize: 18, fontWeight: '800', color: INK, marginTop: 16, marginBottom: 8 },
  subtitle: { fontSize: 13.5, color: SUBTLE, textAlign: 'center', lineHeight: 19 },
});
