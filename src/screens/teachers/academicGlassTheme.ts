// -----------------------------------------------------------------------------
// Glassmorphism pass over academicTheme.ts (Phase 3 — Teacher / class /
// attendance screens).
//
// Same approach as `src/screens/admin/admission/theme.ts` in Phase 2: rather
// than replacing the Academic Management module's established accent/status
// palette, this derives a translucent "glass" surface set FROM it, so every
// screen that already reads `theme.background` / `theme.surface` /
// `theme.border` for its styling gets the frosted-glass look automatically
// once its root is wrapped in <GlassBackground>, with no per-style rewrite
// needed. Accent, status (success/warning/danger), and text colors are left
// untouched — the module's blue/emerald identity and dark-mode support both
// carry over unchanged.
//
// Usage in a screen (was `useAcademicTheme()` / `useAcademicTheme('emerald')`):
//   const theme = useAcademicGlassTheme();
//   const theme = useAcademicGlassTheme('emerald');
// `makeStyles(theme)` functions do not need to change — `theme.surface` etc.
// now resolve to rgba glass tokens instead of flat hex.
// -----------------------------------------------------------------------------

import { useAcademicTheme, AcademicTheme, statusColors as baseStatusColors } from './academicTheme';
import { COLORS, GLASS, SHADOW } from '../../theme/glass';

export type AcademicGlassTheme = AcademicTheme & {
  /** True glass shadow tokens, for screens composing GlassCard directly. */
  glow: typeof SHADOW.glow;
  elevation1: typeof SHADOW.level1;
  elevation2: typeof SHADOW.level2;
  elevation3: typeof SHADOW.level3;
};

/**
 * Same signature as `useAcademicTheme`, but returns glass (translucent)
 * surface/background/border tokens instead of flat ones. Pair with
 * <GlassBackground variant="canvas"> at the screen root so the transparency
 * has the mesh to sit on top of; on dark mode the mesh's dark end reads
 * correctly against the same translucent whites (kept deliberately —
 * matches how DashboardShell/MenuScreen already behave in dark mode).
 */
export function useAcademicGlassTheme(variant: 'blue' | 'emerald' = 'emerald'): AcademicGlassTheme {
  const base = useAcademicTheme(variant);

  return {
    ...base,
    // GlassBackground renders the subtle canvas wash; cards sit on top as
    // solid white surfaces (no blur) per the app-wide design system.
    background: 'transparent',
    surface: COLORS.surface,
    surfaceVariant: COLORS.surface,
    border: COLORS.border,
    borderStrong: COLORS.border,
    shadowColor: '#0B3D2E',
    glow: SHADOW.glow,
    elevation1: SHADOW.level1,
    elevation2: SHADOW.level2,
    elevation3: SHADOW.level3,
  };
}

// Re-exported so screens that only import `statusColors` alongside the theme
// don't need a second import path — status pill colors are left as flat
// soft-fill chips (success/warning/danger), which already read fine on
// glass; no glass-specific variant needed for these.
export const statusColors = baseStatusColors;
