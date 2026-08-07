import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useLocale } from '../../context/LocaleContext';
import { COLORS } from '../../theme/glass';
import { CARD_W, GAP } from './deckMetrics';

const EMERALD = COLORS.emerald;
const EMERALD_SOFT = COLORS.emeraldSoft;
const SUBTLE = COLORS.subtle;

function CheckIcon() {
  return (
    <Svg width={30} height={30} viewBox="0 0 24 24" fill="none">
      <Path d="M4 12.5l5 5L20 6.5" stroke={EMERALD} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/**
 * The deck's own end-of-feed card - appended as the last item once pagination
 * is exhausted (see FeedScreen.tsx's deckData), instead of a pill overlaid on
 * top of the last post. Reached the same way every other card is: swipe to it.
 *
 * `active` (whether this card is the one currently snapped into view) drives
 * a one-shot entrance animation each time the reader swipes onto it, instead
 * of the card just sitting there fully drawn from the first frame.
 */
export default function CaughtUpCard({ height, active }: { height: number; active?: boolean }) {
  const { t } = useLocale();

  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.9)).current;
  const iconScale = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    if (!active) {
      cardOpacity.setValue(0);
      cardScale.setValue(0.9);
      iconScale.setValue(0);
      textOpacity.setValue(0);
      textTranslateY.setValue(10);
      return;
    }

    // Short staggered overlap (80ms offset, 220ms steps) instead of a
    // strict sequence - the old 300+350+350 fully-sequential steps took a
    // full second to finish landing, which read as slow to reach "All
    // caught up". Staggering keeps the same staged entrance feel (card,
    // then icon, then text) while the whole thing settles in ~380ms.
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
  }, [active, cardOpacity, cardScale, iconScale, textOpacity, textTranslateY]);

  return (
    <Animated.View
      style={[
        styles.card,
        { width: CARD_W, height, opacity: cardOpacity, transform: [{ scale: cardScale }] },
      ]}
    >
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
  // No card chrome (background/border/shadow) on purpose - this is the end
  // of the deck, not another post, so it reads as a plain state message
  // sitting on the canvas rather than one more card in the stack.
  card: {
    marginRight: GAP,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
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
