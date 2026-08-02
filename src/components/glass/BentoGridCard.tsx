import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AcademicGlassTheme } from '../../screens/teachers/academicGlassTheme';
import { RADIUS } from '../../theme/glass';

/**
 * Spatial list card for admin catalog screens (Enrollment Stages, Fee
 * Types, Subjects, Classes, ...): an icon tile + title + optional meta
 * line + status badge, laid out in a wrapping 2-column bento grid instead
 * of a flat single-column list of text rows. Pairs with
 * BentoGrid below as the container.
 */

export default function BentoGridCard({
  icon,
  title,
  subtitle,
  badgeText,
  badgeTone = 'neutral',
  meta,
  onPress,
  theme,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string | null;
  badgeText?: string | null;
  badgeTone?: 'accent' | 'success' | 'danger' | 'neutral';
  meta?: string | null;
  onPress?: () => void;
  theme: AcademicGlassTheme;
}) {
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const badgeColors =
    badgeTone === 'accent'
      ? { color: theme.accent, bg: theme.accentSoft }
      : badgeTone === 'success'
      ? { color: theme.success, bg: theme.successSoft }
      : badgeTone === 'danger'
      ? { color: theme.danger, bg: theme.dangerSoft }
      : { color: theme.textSecondary, bg: theme.surfaceVariant };

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onPress} disabled={!onPress}>
      <View style={styles.iconWrap}>{icon}</View>
      {badgeText ? (
        <Text style={[styles.badge, { color: badgeColors.color, backgroundColor: badgeColors.bg }]} numberOfLines={1}>
          {badgeText}
        </Text>
      ) : null}
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
      {meta ? (
        <Text style={styles.meta} numberOfLines={1}>
          {meta}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

// Two-column wrapping container - just a flex-wrap row with each card
// pinned to ~47% width, leaving a gap for the grid gutter.
export function BentoGrid({ children }: { children: React.ReactNode }) {
  return <View style={gridStyles.grid}>{children}</View>;
}

const gridStyles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
});

const makeStyles = (theme: AcademicGlassTheme) =>
  StyleSheet.create({
    card: {
      width: '47%',
      minHeight: 132,
      backgroundColor: theme.surface,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
      ...theme.elevation2,
    },
    iconWrap: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: theme.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    badge: {
      position: 'absolute',
      top: 14,
      right: 14,
      fontSize: 10,
      fontWeight: '700',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      overflow: 'hidden',
      textTransform: 'uppercase',
    },
    title: { fontSize: 15, fontWeight: '700', color: theme.textPrimary, marginBottom: 4 },
    subtitle: { fontSize: 12.5, color: theme.textSecondary, marginBottom: 2 },
    meta: { fontSize: 11.5, color: theme.textMuted, marginTop: 2 },
  });
