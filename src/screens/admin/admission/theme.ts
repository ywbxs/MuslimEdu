// -----------------------------------------------------------------------------
// Material Design 3 tokens for the Student Admission wizard.
//
// The rest of the app uses a flat "EMERALD / EMERALD_SOFT / INK / SUBTLE"
// palette (see DashboardShell.tsx). Rather than replace that everywhere, this
// file derives a proper MD3 tonal palette FROM that same seed color (#1FAE64)
// so the wizard feels native to the rest of Manhaje while gaining the
// surface/elevation/state-layer vocabulary MD3 relies on.
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// Material Design 3 tokens for the Student Admission wizard — glassmorphism
// spatial UI pass. Surface colors are now translucent (rgba) instead of flat
// white, so every component built on `md3.color.surface*` automatically
// reads as frosted glass once it sits inside an opaque-tinted GlassCard/
// GlassBackground panel (see AdmissionScreen.tsx - no real blur, see
// theme/glass.ts for why). Elevation now reuses the app-wide glass shadow
// tokens for consistency.
// -----------------------------------------------------------------------------
import { SHADOW, GLASS } from '../../../theme/glass';

export const md3 = {
  color: {
    primary: '#1FAE64',
    onPrimary: '#FFFFFF',
    primaryContainer: 'rgba(31,174,100,0.16)',
    onPrimaryContainer: '#00391C',

    secondary: '#4C6358',
    secondaryContainer: 'rgba(31,174,100,0.12)',
    onSecondaryContainer: '#082017',

    surface: 'rgba(255,255,255,0.55)',
    surfaceDim: 'transparent',
    surfaceContainerLowest: 'rgba(255,255,255,0.72)',
    surfaceContainerLow: 'rgba(255,255,255,0.45)',
    surfaceContainer: 'rgba(255,255,255,0.4)',
    surfaceContainerHigh: 'rgba(255,255,255,0.55)',
    surfaceVariant: 'rgba(255,255,255,0.32)',

    onSurface: '#1A1C1B',
    onSurfaceVariant: '#414942',
    outline: GLASS.borderOnLight,
    outlineVariant: GLASS.borderOnLight,

    error: '#BA1A1A',
    onError: '#FFFFFF',
    errorContainer: 'rgba(186,26,26,0.12)',
    onErrorContainer: '#410002',

    scrim: 'rgba(10, 20, 15, 0.5)',
    inverseSurface: '#2E312D',
    inverseOnSurface: '#F0F1EC',
  },

  // MD3 type scale, trimmed to what this wizard needs.
  type: {
    headlineSmall: { fontSize: 24, fontWeight: '700' as const, letterSpacing: 0 },
    titleLarge: { fontSize: 20, fontWeight: '700' as const, letterSpacing: 0 },
    titleMedium: { fontSize: 16, fontWeight: '600' as const, letterSpacing: 0.1 },
    bodyLarge: { fontSize: 15.5, fontWeight: '400' as const, letterSpacing: 0.1 },
    bodyMedium: { fontSize: 13.5, fontWeight: '400' as const, letterSpacing: 0.15 },
    labelLarge: { fontSize: 14, fontWeight: '700' as const, letterSpacing: 0.1 },
    labelMedium: { fontSize: 12.5, fontWeight: '600' as const, letterSpacing: 0.3 },
    labelSmall: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.4 },
  },

  shape: {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 24,
    xl: 28,
    full: 999,
  },

  space: (n: number) => n * 4,

  elevation: {
    level1: SHADOW.level1,
    level2: SHADOW.level2,
    level3: SHADOW.level3,
    glow: SHADOW.glow,
  },

  motion: {
    fast: 150,
    standard: 240,
    emphasized: 380,
  },
};

export type MD3 = typeof md3;
