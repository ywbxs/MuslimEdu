// -----------------------------------------------------------------------------
// Shared theme for the Academic Management module (Department, Curriculum,
// Class, Section, and the subject/schedule + enrollment screens under
// src/screens/teachers/). These screens already share one visual language —
// a blue accent (#3b82f6) on a light neutral surface, per the original
// ClassListScreen.tsx / CreateClassScreen.tsx conventions the rest of the
// module was built to match. This file turns that into a proper MD3-shaped
// light/dark pair so every screen in the module can pull from one place
// instead of each hardcoding its own hex values.
//
// Usage in a screen:
//   const theme = useAcademicTheme();
//   const styles = useMemo(() => makeStyles(theme), [theme]);
// where makeStyles(theme) replaces the screen's old `StyleSheet.create({...})`
// literal with a function that reads colors from `theme` instead of hex
// literals, still returning a StyleSheet.create() result.
// -----------------------------------------------------------------------------

import { useColorScheme } from 'react-native';
import { BRAND } from '../../theme/glass';

export type AcademicTheme = Omit<typeof lightAcademicTheme, 'scheme'> & {
  scheme: 'light' | 'dark';
};

const lightAcademicTheme = {
  scheme: 'light' as const,

  // Backgrounds / surfaces
  background: '#f9fafb',
  surface: '#ffffff',
  surfaceVariant: '#f3f4f6',
  border: '#e5e7eb',
  borderStrong: '#d1d5db',

  // Text
  textPrimary: '#1f2937',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  onAccent: '#ffffff',

  // Accent (module's established blue)
  accent: '#3b82f6',
  accentSoft: '#dbeafe',
  accentSoftText: '#1e40af',

  // Status
  success: '#059669',
  successSoft: '#d1fae5',
  warning: '#d97706',
  warningSoft: '#fef3c7',
  danger: '#ef4444',
  dangerSoft: '#fee2e2',
  neutralSoft: '#f3f4f6',
  neutralSoftText: '#6b7280',

  // Skeleton
  skeletonBase: '#e7e9ec',

  // Shadows (elevation) — RN shadow props, both platforms
  shadowColor: '#0b1220',
};

const darkAcademicTheme = {
  scheme: 'dark' as const,

  background: '#0f1115',
  surface: '#181b20',
  surfaceVariant: '#20242b',
  border: '#2a2f38',
  borderStrong: '#343a45',

  textPrimary: '#f2f4f7',
  textSecondary: '#a7adba',
  textMuted: '#7b8291',
  onAccent: '#ffffff',

  accent: '#5b9bf7',
  accentSoft: '#1c2c47',
  accentSoftText: '#9dc0fb',

  success: '#34d399',
  successSoft: '#0f2e24',
  warning: '#fbbf24',
  warningSoft: '#3a2c0c',
  danger: '#f87171',
  dangerSoft: '#3a1616',
  neutralSoft: '#20242b',
  neutralSoftText: '#a7adba',

  skeletonBase: '#2a2f38',

  shadowColor: '#000000',
};

// A second accent variant for the screens in this same module that were
// built against the app's emerald palette instead of the blue one
// (SectionStudentsScreen.tsx, AdminClassSubjectsScreen.tsx,
// AdminClassTeacherAssignScreen.tsx — see EMERALD/EMERALD_SOFT constants at
// the top of those files). Same shape, just a different accent + accentSoft
// pair, so those screens can adopt dark mode from here too without a switch
// in visual identity.
const emeraldLight: AcademicTheme = {
  ...lightAcademicTheme,
  accent: BRAND.emerald,
  accentSoft: 'rgba(43,203,176,0.12)',
  accentSoftText: BRAND.emeraldDeep,
};

const emeraldDark: AcademicTheme = {
  ...darkAcademicTheme,
  accent: BRAND.emeraldLight,
  accentSoft: '#12301f',
  accentSoftText: BRAND.emeraldLight,
};

/**
 * Returns the Academic Management module's theme for the device's current
 * light/dark setting. Falls back to light if the OS reports no preference.
 * Pass `variant: 'emerald'` for the screens built on the app's emerald
 * accent instead of this module's default blue.
 */
export function useAcademicTheme(variant: 'blue' | 'emerald' = 'emerald'): AcademicTheme {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  if (variant === 'emerald') {
    return isDark ? emeraldDark : emeraldLight;
  }

  return isDark ? darkAcademicTheme : lightAcademicTheme;
}

export function statusColors(theme: AcademicTheme, status: string | null | undefined) {
  switch (status) {
    case 'active':
      return { color: theme.success, backgroundColor: theme.successSoft };
    case 'archived':
    case 'inactive':
      return { color: theme.textSecondary, backgroundColor: theme.neutralSoft };
    default:
      return { color: theme.warning, backgroundColor: theme.warningSoft };
  }
}
