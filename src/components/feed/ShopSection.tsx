import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { useLocale } from '../../context/LocaleContext';
import { BRAND, COLORS, RADIUS, SHADOW } from '../../theme/glass';

const EMERALD = COLORS.emerald;
const EMERALD_SOFT = COLORS.emeraldSoft;
const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;

function BagIcon({ color = EMERALD, size = 26 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={7} width={16} height={13} rx={2} stroke={color} strokeWidth={1.8} />
      <Path d="M8 7V6a4 4 0 0 1 8 0v1" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

interface ShopItem {
  key: string;
  nameKey: string;
  nameFallback: string;
  descKey: string;
  descFallback: string;
  price: string;
}

const SHOP_ITEMS: ShopItem[] = [
  { key: 'uniform', nameKey: 'shop.item_uniform', nameFallback: 'School Uniform Set', descKey: 'shop.item_uniform_desc', descFallback: 'Complete bundle, all grade levels', price: '₱850' },
  { key: 'books', nameKey: 'shop.item_books', nameFallback: 'Islamic Studies Textbooks', descKey: 'shop.item_books_desc', descFallback: "Qur'an, Hadith & Fiqh, this term", price: '₱450' },
  { key: 'supplies', nameKey: 'shop.item_supplies', nameFallback: 'School Supplies Kit', descKey: 'shop.item_supplies_desc', descFallback: 'Notebooks, pens & essentials', price: '₱250' },
  { key: 'bottle', nameKey: 'shop.item_bottle', nameFallback: 'Water Bottle & Lunch Bag', descKey: 'shop.item_bottle_desc', descFallback: 'Branded reusable set', price: '₱180' },
];

/**
 * Sample/preview grid for the Shop section - no real catalog or checkout
 * exists yet, so tapping an item just says so. Its own vertical scroll,
 * independent of Home's horizontal post deck and Charity's own list.
 */
export default function ShopSection() {
  const { t } = useLocale();

  return (
    <FlatList
      data={SHOP_ITEMS}
      keyExtractor={(item) => item.key}
      numColumns={2}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <Text style={styles.intro}>
          {t('shop.intro', "Browse school merch, books, and supplies - right from the app. Coming soon!")}
        </Text>
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.tile}
          activeOpacity={0.85}
          onPress={() =>
            Alert.alert(t('shop.coming_soon_title', 'Coming soon'), t('shop.coming_soon_desc', 'Shop purchases aren’t available yet.'))
          }
        >
          <View style={styles.iconWrap}>
            <BagIcon />
          </View>
          <Text style={styles.tileName} numberOfLines={2}>
            {t(item.nameKey, item.nameFallback)}
          </Text>
          <Text style={styles.tileDesc} numberOfLines={2}>
            {t(item.descKey, item.descFallback)}
          </Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{item.price}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{t('shop.coming_soon_badge', 'Soon')}</Text>
            </View>
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  intro: { fontSize: 13.5, color: SUBTLE, lineHeight: 19, marginBottom: 16 },
  row: { gap: 12 },
  tile: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 12,
    ...SHADOW.level1,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  tileName: { fontSize: 14, fontWeight: '800', color: INK, marginBottom: 3 },
  tileDesc: { fontSize: 11.5, color: SUBTLE, lineHeight: 15, marginBottom: 10 },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  price: { fontSize: 14, fontWeight: '800', color: EMERALD },
  badge: { backgroundColor: BRAND.gold + '29', paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.pill },
  badgeText: { fontSize: 10, fontWeight: '700', color: BRAND.gold },
});
