import { useColorScheme } from 'react-native';
import { M3Colors, M3_LIGHT, M3_DARK, M3_TYPE, M3_SHAPE, M3_SPACE, M3Elevation, surfaceAt, shadowAt } from './material3';

export interface M3Theme {
  colors: M3Colors;
  scheme: 'light' | 'dark';
  type: typeof M3_TYPE;
  shape: typeof M3_SHAPE;
  space: typeof M3_SPACE;
  /** Tonal-elevation surface color for a given level (M3 way of showing elevation). */
  surface: (level: M3Elevation) => string;
  /** Optional physical shadow to pair with surface() on top of the tonal shift. */
  shadow: (level: M3Elevation) => ReturnType<typeof shadowAt>;
}

/**
 * Single theme hook for the Material 3 redesign. Screens migrate to this one
 * folder at a time, replacing `useAcademicGlassTheme()` / `useAcademicTheme()`
 * calls - once every screen consumes this, the old glass/academic theme
 * files can be deleted rather than kept as a second parallel system.
 */
export function useM3Theme(): M3Theme {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = scheme === 'dark' ? M3_DARK : M3_LIGHT;

  return {
    colors,
    scheme,
    type: M3_TYPE,
    shape: M3_SHAPE,
    space: M3_SPACE,
    surface: (level) => surfaceAt(colors, level),
    shadow: (level) => shadowAt(colors, level),
  };
}
