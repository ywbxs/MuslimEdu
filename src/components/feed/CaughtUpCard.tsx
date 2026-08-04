import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useLocale } from '../../context/LocaleContext';
import { COLORS, RADIUS, SHADOW } from '../../theme/glass';
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
 */
export default function CaughtUpCard({ height }: { height: number }) {
  const { t } = useLocale();
  return (
    <View style={[styles.card, { width: CARD_W, height }]}>
      <View style={styles.iconWrap}>
        <CheckIcon />
      </View>
      <Text style={styles.title}>{t('feed.caught_up', 'All caught up')}</Text>
      <Text style={styles.subtitle}>
        {t('feed.caught_up_desc', "You've seen every post for now - check back later for more.")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginRight: GAP,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    ...SHADOW.level2,
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
