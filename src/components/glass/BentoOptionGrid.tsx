import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { AcademicGlassTheme } from '../../screens/teachers/academicGlassTheme';

/**
 * Bento tile picker: each option is a spatial card (icon + name, elevated,
 * selected state gets a filled accent tile + check badge) laid out in a
 * wrapping grid, rather than a flat row of small text chips.
 *
 * Extracted from AdminClassScheduleScreen's ScheduleEditSheet (the original
 * "Redesign Add Schedule form pickers as bento tile grids" work) so the same
 * spatial-UI language can be reused by any form's option picker - enrollment
 * stages/fee types, class/subject forms, etc. - instead of copy-pasting the
 * tile styles into every screen.
 */

function IconSlash({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={8.5} stroke={color} strokeWidth={2} />
      <Line x1={6.5} y1={17.5} x2={17.5} y2={6.5} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function IconCheckSmall({ color }: { color: string }) {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12.5l4.5 4.5L19 7" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export interface BentoOption {
  id: number;
  name: string;
}

export default function BentoOptionGrid<T extends BentoOption>({
  label,
  options,
  value,
  onChange,
  allowNone,
  noneLabel = 'None',
  icon,
  theme,
  tileWidth = '30%',
}: {
  label?: string;
  options: T[];
  value: number | null;
  onChange: (id: number | null) => void;
  allowNone?: boolean;
  noneLabel?: string;
  icon: (color: string) => React.ReactNode;
  theme: AcademicGlassTheme;
  tileWidth?: string;
}) {
  const styles = useMemo(() => makeStyles(theme, tileWidth), [theme, tileWidth]);

  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.grid}>
        {allowNone ? (
          <TouchableOpacity
            style={[styles.tile, value === null && styles.tileActive]}
            onPress={() => onChange(null)}
            activeOpacity={0.85}
          >
            <View style={[styles.iconWrap, value === null && styles.iconWrapActive]}>
              <IconSlash color={value === null ? theme.onAccent : theme.textSecondary} />
            </View>
            <Text style={[styles.tileText, value === null && styles.tileTextActive]} numberOfLines={2}>
              {noneLabel}
            </Text>
            {value === null ? (
              <View style={styles.check}>
                <IconCheckSmall color={theme.onAccent} />
              </View>
            ) : null}
          </TouchableOpacity>
        ) : null}
        {options.map((opt) => {
          const active = opt.id === value;
          return (
            <TouchableOpacity
              key={opt.id}
              style={[styles.tile, active && styles.tileActive]}
              onPress={() => onChange(opt.id)}
              activeOpacity={0.85}
            >
              <View style={[styles.iconWrap, active && styles.iconWrapActive]}>{icon(active ? theme.onAccent : theme.accent)}</View>
              <Text style={[styles.tileText, active && styles.tileTextActive]} numberOfLines={2}>
                {opt.name}
              </Text>
              {active ? (
                <View style={styles.check}>
                  <IconCheckSmall color={theme.onAccent} />
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (theme: AcademicGlassTheme, tileWidth: string) =>
  StyleSheet.create({
    label: { fontSize: 12.5, fontWeight: '600', color: theme.textSecondary, marginBottom: 8 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    tile: {
      width: tileWidth as any,
      minHeight: 92,
      borderRadius: 16,
      backgroundColor: theme.surface,
      borderWidth: 1.5,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 6,
      ...theme.elevation1,
    },
    tileActive: { backgroundColor: theme.accent, borderColor: theme.accent, ...theme.elevation2 },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    iconWrapActive: { backgroundColor: 'rgba(255,255,255,0.22)' },
    tileText: { fontSize: 12, fontWeight: '700', color: theme.textPrimary, textAlign: 'center' },
    tileTextActive: { color: theme.onAccent },
    check: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: 'rgba(255,255,255,0.28)',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
