import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useLocale } from '../../context/LocaleContext';
import { COLORS, RADIUS, SHADOW } from '../../theme/glass';

const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const CHARITY_PINK = '#DB4C77';
const CHARITY_PINK_SOFT = 'rgba(219,76,119,0.12)';

function HeartHandIcon({ color = CHARITY_PINK, size = 26 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 20s-7-4.35-9.33-8.9C1.4 8.03 3 5 6 5c1.7 0 3 1 3.5 2.2C10 6 11.3 5 13 5c3 0 4.6 3.03 3.33 6.1C14 15.65 12 20 12 20z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

interface CharityCause {
  key: string;
  titleKey: string;
  titleFallback: string;
  descKey: string;
  descFallback: string;
}

const CAUSES: CharityCause[] = [
  {
    key: 'orphan',
    titleKey: 'charity.cause_orphan',
    titleFallback: 'Orphan Sponsorship Fund',
    descKey: 'charity.cause_orphan_desc',
    descFallback: "Support a child's education and daily needs.",
  },
  {
    key: 'iftar',
    titleKey: 'charity.cause_iftar',
    titleFallback: 'Ramadan Food Drive',
    descKey: 'charity.cause_iftar_desc',
    descFallback: 'Provide iftar meals to families in need.',
  },
  {
    key: 'building',
    titleKey: 'charity.cause_building',
    titleFallback: 'School Building Fund',
    descKey: 'charity.cause_building_desc',
    descFallback: 'Help expand classrooms for growing enrollment.',
  },
  {
    key: 'scholarship',
    titleKey: 'charity.cause_scholarship',
    titleFallback: 'Scholarship Fund',
    descKey: 'charity.cause_scholarship_desc',
    descFallback: 'Fund tuition for deserving students.',
  },
];

/**
 * Sample/preview list for the Charity section - no real donation flow
 * exists yet, so tapping a cause just says so. Its own vertical scroll,
 * independent of Home's horizontal post deck and Shop's own grid.
 */
export default function CharitySection() {
  const { t } = useLocale();

  return (
    <FlatList
      data={CAUSES}
      keyExtractor={(item) => item.key}
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <Text style={styles.intro}>
          {t('charity.intro', 'Give back and support causes in your community. Coming soon!')}
        </Text>
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.85}
          onPress={() =>
            Alert.alert(t('charity.coming_soon_title', 'Coming soon'), t('charity.coming_soon_desc', 'Donations aren’t available yet.'))
          }
        >
          <View style={styles.iconWrap}>
            <HeartHandIcon />
          </View>
          <View style={styles.textCol}>
            <Text style={styles.title}>{t(item.titleKey, item.titleFallback)}</Text>
            <Text style={styles.desc}>{t(item.descKey, item.descFallback)}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{t('charity.coming_soon_badge', 'Soon')}</Text>
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  intro: { fontSize: 13.5, color: SUBTLE, lineHeight: 19, marginBottom: 16 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 12,
    ...SHADOW.level1,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: CHARITY_PINK_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  textCol: { flex: 1 },
  title: { fontSize: 14.5, fontWeight: '800', color: INK, marginBottom: 3 },
  desc: { fontSize: 12, color: SUBTLE, lineHeight: 16 },
  badge: { backgroundColor: CHARITY_PINK_SOFT, paddingHorizontal: 9, paddingVertical: 4, borderRadius: RADIUS.pill, marginLeft: 8 },
  badgeText: { fontSize: 10, fontWeight: '700', color: CHARITY_PINK },
});
