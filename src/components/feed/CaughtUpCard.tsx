import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Check } from 'lucide-react-native';
import { useLocale } from '../../context/LocaleContext';
import { COLORS, RADIUS, SHADOW } from '../../theme/glass';

const EMERALD = COLORS.emerald;
const EMERALD_SOFT = COLORS.emeraldSoft;
const SUBTLE = COLORS.subtle;

function CheckIcon() {
  return <Check color={EMERALD} size={30} strokeWidth={2.6} />;
}

/**
 * The feed's own end-of-list card - appended once pagination is exhausted
 * (see FeedScreen.tsx's deckData), the last thing reached scrolling down
 * the vertical feed, instead of a pill overlaid on top of the last post.
 *
 * `visible` (whether this card has actually scrolled into view, tracked by
 * FeedScreen's onViewableItemsChanged) drives a one-shot entrance
 * animation the first time it's reached, instead of the card just sitting
 * there fully drawn from the first frame.
 */
export default function CaughtUpCard({ visible }: { visible?: boolean }) {
  const { t } = useLocale();

  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.9)).current;
  const iconScale = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(10)).current;
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    if (!visible || hasAnimatedRef.current) return;
    hasAnimatedRef.current = true;

    // Short staggered overlap (80ms offset, 220ms steps) instead of a
    // strict sequence - settles in ~380ms total (staged card, then icon,
    // then text) rather than reading as slow to reach "All caught up".
    Animated.stagger(80, [
      Animated.parallel([
        Animated.timing(cardOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(cardScale, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.back(1.4)),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(iconScale, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.back(1.7)),
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(textOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(textTranslateY, { toValue: 0, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
    ]).start();
  }, [visible, cardOpacity, cardScale, iconScale, textOpacity, textTranslateY]);

  return (
    <Animated.View style={[styles.card, { opacity: cardOpacity, transform: [{ scale: cardScale }] }]}>
      <Animated.View style={[styles.iconWrap, { transform: [{ scale: iconScale }] }]}>
        <CheckIcon />
      </Animated.View>
      <Animated.Text style={[styles.title, { opacity: textOpacity, transform: [{ translateY: textTranslateY }] }]}>
        {t('feed.caught_up', 'All caught up')}
      </Animated.Text>
      <Animated.Text style={[styles.subtitle, { opacity: textOpacity, transform: [{ translateY: textTranslateY }] }]}>
        {t('feed.caught_up_desc', "You've seen every post for now - check back later for more.")}
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 24,
    borderRadius: RADIUS.lg,
    paddingVertical: 32,
    paddingHorizontal: 32,
    ...SHADOW.level1,
  },
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: '800', color: EMERALD, marginBottom: 8 },
  subtitle: { fontSize: 13.5, color: SUBTLE, textAlign: 'center', lineHeight: 19 },
});
