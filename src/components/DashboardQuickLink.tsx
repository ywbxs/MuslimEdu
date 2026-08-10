/**
 * DashboardQuickLink
 *
 * Phase 2 - makes already-shipped features reachable.
 *
 * Weighted assessment grades and the Materials library are both registered in
 * RootNavigator and fully functional, but NO dashboard has a button that
 * navigates to them, so to a real user they do not exist. This is the shared
 * card used to surface them on the teacher / student / admin dashboards.
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
  title: string;
  subtitle?: string;
  /** single glyph or emoji; swap for your icon component if the design system has one */
  glyph?: string;
  tint?: string;
  badge?: string | number | null;
  onPress: () => void;
  disabled?: boolean;
}

const DashboardQuickLink: React.FC<Props> = ({
  title,
  subtitle,
  glyph = '>',
  tint = '#1E927E',
  badge = null,
  onPress,
  disabled = false,
}) => (
  <TouchableOpacity
    style={[styles.card, disabled && styles.cardDisabled]}
    onPress={onPress}
    disabled={disabled}
    activeOpacity={0.7}
    accessibilityRole="button"
    accessibilityLabel={title}
  >
    <View style={[styles.iconWrap, { backgroundColor: `${tint}1A` }]}>
      <Text style={[styles.glyph, { color: tint }]}>{glyph}</Text>
    </View>

    <View style={styles.body}>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      {subtitle ? (
        <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text>
      ) : null}
    </View>

    {badge !== null && badge !== undefined && badge !== '' ? (
      <View style={[styles.badge, { backgroundColor: tint }]}>
        <Text style={styles.badgeText}>{badge}</Text>
      </View>
    ) : (
      <Text style={styles.chevron}>{'>'}</Text>
    )}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  cardDisabled: { opacity: 0.5 },
  iconWrap: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  glyph: { fontSize: 19, fontWeight: '700' },
  body: { flex: 1, paddingHorizontal: 12 },
  title: { fontSize: 14.5, fontWeight: '700', color: '#1F2937' },
  subtitle: { fontSize: 12, color: '#8A9199', marginTop: 2, lineHeight: 16 },
  badge: { minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  chevron: { color: '#C4C9CF', fontSize: 18, fontWeight: '700' },
});

export default DashboardQuickLink;
