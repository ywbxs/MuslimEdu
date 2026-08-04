import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useLocale } from '../context/LocaleContext';
import { DISPLAY_SCALE_OPTIONS, useDisplayScale } from '../context/DisplayScaleContext';
import { COLORS, RADIUS, SHADOW } from '../theme/glass';

const EMERALD = COLORS.emerald;
const EMERALD_SOFT = COLORS.emeraldSoft;
const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;

function TextSizeIcon({ color = EMERALD, size = 20 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 7V5h11v2M9.5 5v14M7 19h5M15 12h5M17.5 12v7M16 19h3"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * "Accessibility" card shown in the shared Menu screen footer (so it
 * appears for every role without touching each dashboard). Lets a user
 * pick a display size that zooms the whole app - see DisplayScaleWrapper
 * for how the scale itself is applied.
 */
export default function AccessibilityCard() {
  const { t } = useLocale();
  const { scale, setScale } = useDisplayScale();

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.iconWrap}>
          <TextSizeIcon />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t('accessibility.title', 'Accessibility')}</Text>
          <Text style={styles.subtitle}>{t('accessibility.subtitle', 'Text & display size')}</Text>
        </View>
      </View>

      <View style={styles.optionsRow}>
        {DISPLAY_SCALE_OPTIONS.map((opt) => {
          const selected = Math.abs(opt.value - scale) < 0.001;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[styles.optionTile, selected && styles.optionTileSelected]}
              activeOpacity={0.8}
              onPress={() => setScale(opt.value)}
            >
              <Text style={[styles.optionLabelBig, { fontSize: 13 + opt.value * 5 }, selected && styles.optionLabelSelected]}>
                A
              </Text>
              <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                {t(`accessibility.size.${opt.key}`, opt.label)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 16,
    marginTop: 16,
    ...SHADOW.level2,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 16, fontWeight: '800', color: INK },
  subtitle: { fontSize: 12.5, color: SUBTLE, marginTop: 1 },

  optionsRow: { flexDirection: 'row', gap: 8 },
  optionTile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.canvas,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  optionTileSelected: { backgroundColor: EMERALD_SOFT, borderColor: EMERALD },
  optionLabelBig: { fontWeight: '800', color: INK, marginBottom: 4 },
  optionLabel: { fontSize: 11, fontWeight: '700', color: SUBTLE },
  optionLabelSelected: { color: EMERALD },
});
