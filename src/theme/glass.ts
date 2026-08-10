// ============================================================================
// DESIGN TOKENS — solid-surface "premium light" system (see DESIGN_SYSTEM.md)
// ----------------------------------------------------------------------------
// White cards on a light canvas, soft layered shadows, green as the single
// accent. No real blur anywhere - @react-native-community/blur doesn't
// reliably respect rounded-corner clipping on Android, so every "glass"
// surface (including surface="hero" panels) approximates frosted glass
// with an opaque-enough translucent fill instead. Module kept as `theme/glass` (with the
// `theme/spatial` back-compat shim re-exporting it) so existing imports keep
// working while each screen is migrated phase by phase.
// ============================================================================
import { Platform } from 'react-native';

export const BRAND = {
  emerald: '#2BCBB0',
  emeraldLight: '#2AB4DB',
  emeraldDeep: '#1E927E',
  gold: '#D4A64A',
};

// Background wash stops (used by <GlassBackground variant="canvas"/>) — a
// near-white page background with a whisper of green, not a mesh.
export const MESH = {
  base: ['#0B3D2E', '#2BCBB0', '#E9F7EF'] as const,
  baseAngle: { start: { x: 0.1, y: 0 }, end: { x: 0.9, y: 1 } },
  blobs: [
    { color: 'rgba(43,203,176, 0.55)', size: 260, top: -80, left: -60 },
    { color: 'rgba(212, 166, 74, 0.35)', size: 220, top: 120, left: 250 },
    { color: 'rgba(43,203,176, 0.45)', size: 300, top: 480, left: -100 },
  ],
};

export const GLASS = {
  // Only used by surface="hero" panels (nav/overlays that want real blur).
  fill: 'rgba(255,255,255,0.14)',
  fillStrong: 'rgba(255,255,255,0.22)',
  fillSubtle: 'rgba(255,255,255,0.08)',
  fillOnLight: 'rgba(255,255,255,0.9)',
  fillOnLightStrong: '#FFFFFF',
  border: 'rgba(255,255,255,0.35)',
  borderSoft: 'rgba(255,255,255,0.22)',
  borderOnLight: '#E5E7EB',
  tint: Platform.OS === 'ios' ? 'light' : ('light' as const),
  blurAmount: {
    subtle: 18,
    md: 32,
    strong: 50,
  },
};

export const COLORS = {
  emerald: BRAND.emerald,
  emeraldSoft: 'rgba(43,203,176,0.12)',
  ink: '#111827',
  subtle: '#6B7280',
  onGlass: '#FFFFFF',
  onGlassSubtle: 'rgba(255,255,255,0.78)',
  surface: '#FFFFFF',
  canvas: '#F7FAF8',
  border: '#E5E7EB',
  danger: '#EF4444',
  success: '#1E927E',
};

export const RADIUS = {
  sm: 14,
  md: 20,
  lg: 28,
  xl: 32,
  pill: 999,
};

// Soft, slightly colored elevation — reads as light paper, not hard shadow.
export const SHADOW = {
  level1: {
    shadowColor: '#0B3D2E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  level2: {
    shadowColor: '#0B3D2E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 5,
  },
  level3: {
    shadowColor: '#0B3D2E',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 10,
  },
  glow: {
    shadowColor: BRAND.emerald,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 8,
  },
};

export const SPACING = {
  xs: 4,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const TYPE = {
  display: { fontSize: 30, fontWeight: '800' as const, letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3 },
  subtitle: { fontSize: 16, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  caption: { fontSize: 12.5, fontWeight: '500' as const },
};
