// ============================================================================
// Material Design 3 token system — seeded from the existing brand color
// (#1FAE64, "emerald", already used app-wide) rather than Google's default
// purple, so this reads as this app's own theme, not a generic M3 demo.
//
// Tone ramps below are a hand-tuned approximation of what the real M3/HCT
// color algorithm (https://m3.material.io/styles/color/system/how-the-system-works)
// would produce for this hue - 13 tonal stops (0/10/20/30/40/50/60/70/80/90/
// 95/99/100) per palette, with roles assigned exactly per the M3 spec's
// light/dark mapping tables. If this app ever adds
// @material/material-color-utilities, these ramps can be regenerated from
// the seed programmatically instead of by hand - the ROLE mapping below
// would not need to change.
//
// This file defines tokens only (color roles, type scale, shape scale). It
// does not style any screen - screens migrate to it one folder at a time,
// each still going through a single useM3Theme() hook so light/dark and any
// future re-tuning stays centralized.
// ============================================================================

// ---- Tonal palettes (0 = black, 100 = white) --------------------------------

const primaryTones = {
  0: '#000000', 10: '#00210F', 20: '#003919', 30: '#005225',
  40: '#146C43', 50: '#1FAE64', 60: '#3FC97F', 70: '#66E29A',
  80: '#8FF7B7', 90: '#B8FFD1', 95: '#D8FFE4', 99: '#F3FFF4', 100: '#FFFFFF',
};

// Secondary: a low-chroma green-gray, used for less prominent accents
// (filter chips, secondary actions) so the app has tonal variety instead of
// leaning on the primary green for every single accent.
const secondaryTones = {
  0: '#000000', 10: '#0D1F16', 20: '#22352A', 30: '#394C40',
  40: '#516557', 50: '#6A7E6F', 60: '#849889', 70: '#9FB3A3', 80: '#BACFBE',
  90: '#D6EBDA', 95: '#E4F9E8', 99: '#F3FFF4', 100: '#FFFFFF',
};

// Tertiary: warm gold, already used app-wide (BRAND.gold, #D4A64A) for
// highlights/awards/premium-status content - kept as a real third color
// role instead of another green so status/celebratory content is legible.
const tertiaryTones = {
  0: '#000000', 10: '#271900', 20: '#402D00', 30: '#5C4200',
  40: '#795900', 50: '#977000', 60: '#B68A1E', 70: '#D4A64A', 80: '#F0C371',
  90: '#FFDEA1', 95: '#FFEFD6', 99: '#FFFBF2', 100: '#FFFFFF',
};

const errorTones = {
  0: '#000000', 10: '#410002', 20: '#690005', 30: '#93000A',
  40: '#BA1A1A', 50: '#DE3730', 60: '#FF5449', 70: '#FF897D', 80: '#FFB4AB',
  90: '#FFDAD6', 95: '#FFEDEA', 99: '#FFFBFF', 100: '#FFFFFF',
};

// Neutral: for surfaces/backgrounds/outlines. A faint green tint (not pure
// gray) so it still reads as part of the same palette as primary.
const neutralTones = {
  0: '#000000', 4: '#0B120E', 6: '#0F1611', 10: '#191D1A', 12: '#1D211D',
  17: '#272B27', 20: '#2D312D', 22: '#31352F', 24: '#353A34', 30: '#43473F',
  40: '#5B5F56', 50: '#74786E', 60: '#8E9287', 70: '#A9ACA1', 80: '#C4C8BC',
  87: '#D7DBCD', 90: '#E0E4D6', 92: '#E7EAE0', 94: '#EDF0E6', 95: '#F0F3E9',
  96: '#F3F6EC', 98: '#F9FCF1', 99: '#FCFFF4', 100: '#FFFFFF',
};

const neutralVariantTones = {
  0: '#000000', 10: '#191D19', 20: '#2E322C', 30: '#444840', 40: '#5C6058',
  50: '#747870', 60: '#8E9289', 70: '#A9ADA3', 80: '#C4C8BE', 90: '#E0E4D9',
  95: '#EEF2E6', 99: '#FCFFF4',
};

// ---- Role mapping (M3 spec: light / dark) -----------------------------------

export interface M3Colors {
  primary: string; onPrimary: string; primaryContainer: string; onPrimaryContainer: string;
  secondary: string; onSecondary: string; secondaryContainer: string; onSecondaryContainer: string;
  tertiary: string; onTertiary: string; tertiaryContainer: string; onTertiaryContainer: string;
  error: string; onError: string; errorContainer: string; onErrorContainer: string;
  background: string; onBackground: string;
  surface: string; onSurface: string;
  surfaceVariant: string; onSurfaceVariant: string;
  outline: string; outlineVariant: string;
  // Tonal-elevation surfaces (M3 uses surface tint overlay + these container
  // steps instead of drop shadows to communicate elevation).
  surfaceContainerLowest: string; surfaceContainerLow: string; surfaceContainer: string;
  surfaceContainerHigh: string; surfaceContainerHighest: string;
  inverseSurface: string; inverseOnSurface: string; inversePrimary: string;
  shadow: string; scrim: string;
  // App-specific semantic aliases layered on top of the strict M3 roles, so
  // existing call sites (danger/warning/success) have a direct home instead
  // of every screen re-deriving them from error/tertiary/primary.
  warning: string; onWarning: string; warningContainer: string; onWarningContainer: string;
  success: string; onSuccess: string; successContainer: string; onSuccessContainer: string;
}

export const M3_LIGHT: M3Colors = {
  primary: primaryTones[40], onPrimary: primaryTones[100],
  primaryContainer: primaryTones[90], onPrimaryContainer: primaryTones[10],
  secondary: secondaryTones[40], onSecondary: secondaryTones[100],
  secondaryContainer: secondaryTones[90], onSecondaryContainer: secondaryTones[10],
  tertiary: tertiaryTones[40], onTertiary: tertiaryTones[100],
  tertiaryContainer: tertiaryTones[90], onTertiaryContainer: tertiaryTones[10],
  error: errorTones[40], onError: errorTones[100],
  errorContainer: errorTones[90], onErrorContainer: errorTones[10],
  background: neutralTones[98], onBackground: neutralTones[10],
  surface: neutralTones[98], onSurface: neutralTones[10],
  surfaceVariant: neutralVariantTones[90], onSurfaceVariant: neutralVariantTones[30],
  outline: neutralVariantTones[50], outlineVariant: neutralVariantTones[80],
  surfaceContainerLowest: neutralTones[100], surfaceContainerLow: neutralTones[96],
  surfaceContainer: neutralTones[94], surfaceContainerHigh: neutralTones[92],
  surfaceContainerHighest: neutralTones[90],
  inverseSurface: neutralTones[20], inverseOnSurface: neutralTones[95], inversePrimary: primaryTones[80],
  shadow: neutralTones[0], scrim: neutralTones[0],
  warning: tertiaryTones[50], onWarning: tertiaryTones[100],
  warningContainer: tertiaryTones[90], onWarningContainer: tertiaryTones[10],
  success: primaryTones[40], onSuccess: primaryTones[100],
  successContainer: primaryTones[90], onSuccessContainer: primaryTones[10],
};

export const M3_DARK: M3Colors = {
  primary: primaryTones[80], onPrimary: primaryTones[20],
  primaryContainer: primaryTones[30], onPrimaryContainer: primaryTones[90],
  secondary: secondaryTones[80], onSecondary: secondaryTones[20],
  secondaryContainer: secondaryTones[30], onSecondaryContainer: secondaryTones[90],
  tertiary: tertiaryTones[80], onTertiary: tertiaryTones[20],
  tertiaryContainer: tertiaryTones[30], onTertiaryContainer: tertiaryTones[90],
  error: errorTones[80], onError: errorTones[20],
  errorContainer: errorTones[30], onErrorContainer: errorTones[90],
  background: neutralTones[6], onBackground: neutralTones[90],
  surface: neutralTones[6], onSurface: neutralTones[90],
  surfaceVariant: neutralVariantTones[30], onSurfaceVariant: neutralVariantTones[80],
  outline: neutralVariantTones[60], outlineVariant: neutralVariantTones[30],
  surfaceContainerLowest: neutralTones[4], surfaceContainerLow: neutralTones[10],
  surfaceContainer: neutralTones[12], surfaceContainerHigh: neutralTones[17],
  surfaceContainerHighest: neutralTones[22],
  inverseSurface: neutralTones[90], inverseOnSurface: neutralTones[20], inversePrimary: primaryTones[40],
  shadow: neutralTones[0], scrim: neutralTones[0],
  warning: tertiaryTones[80], onWarning: tertiaryTones[20],
  warningContainer: tertiaryTones[30], onWarningContainer: tertiaryTones[90],
  success: primaryTones[80], onSuccess: primaryTones[20],
  successContainer: primaryTones[30], onSuccessContainer: primaryTones[90],
};

// ---- Type scale (M3: Display/Headline/Title/Body/Label × Large/Medium/Small) --

export const M3_TYPE = {
  displayLarge: { fontSize: 57, lineHeight: 64, fontWeight: '400' as const, letterSpacing: -0.25 },
  displayMedium: { fontSize: 45, lineHeight: 52, fontWeight: '400' as const, letterSpacing: 0 },
  displaySmall: { fontSize: 36, lineHeight: 44, fontWeight: '400' as const, letterSpacing: 0 },
  headlineLarge: { fontSize: 32, lineHeight: 40, fontWeight: '400' as const, letterSpacing: 0 },
  headlineMedium: { fontSize: 28, lineHeight: 36, fontWeight: '400' as const, letterSpacing: 0 },
  headlineSmall: { fontSize: 24, lineHeight: 32, fontWeight: '400' as const, letterSpacing: 0 },
  titleLarge: { fontSize: 22, lineHeight: 28, fontWeight: '500' as const, letterSpacing: 0 },
  titleMedium: { fontSize: 16, lineHeight: 24, fontWeight: '600' as const, letterSpacing: 0.15 },
  titleSmall: { fontSize: 14, lineHeight: 20, fontWeight: '600' as const, letterSpacing: 0.1 },
  bodyLarge: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const, letterSpacing: 0.5 },
  bodyMedium: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const, letterSpacing: 0.25 },
  bodySmall: { fontSize: 12, lineHeight: 16, fontWeight: '400' as const, letterSpacing: 0.4 },
  labelLarge: { fontSize: 14, lineHeight: 20, fontWeight: '600' as const, letterSpacing: 0.1 },
  labelMedium: { fontSize: 12, lineHeight: 16, fontWeight: '600' as const, letterSpacing: 0.5 },
  labelSmall: { fontSize: 11, lineHeight: 16, fontWeight: '600' as const, letterSpacing: 0.5 },
};

// ---- Shape scale (M3 corner radius tokens) ----------------------------------

export const M3_SHAPE = {
  none: 0, extraSmall: 4, small: 8, medium: 12, large: 16, extraLarge: 28, full: 999,
};

// ---- Spacing scale (4pt baseline grid, matches M3 layout guidance) ---------

export const M3_SPACE = { none: 0, xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };

export type M3Elevation = 0 | 1 | 2 | 3 | 4 | 5;

// M3 elevation = surface tint overlay (tonal, not shadow-based) + a light
// platform shadow for legibility on Android/iOS where true tint-on-blur
// compositing isn't practical in RN. surfaceAt() returns the correct
// *tonal* surface color for a given elevation; pair it with shadowAt() for
// the (secondary, optional) physical shadow.
export function surfaceAt(colors: M3Colors, level: M3Elevation): string {
  switch (level) {
    case 0: return colors.surface;
    case 1: return colors.surfaceContainerLow;
    case 2: return colors.surfaceContainer;
    case 3: return colors.surfaceContainerHigh;
    default: return colors.surfaceContainerHighest;
  }
}

const ANDROID_ELEVATION = { 0: 0, 1: 1, 2: 3, 3: 6, 4: 8, 5: 12 } as const;

export function shadowAt(colors: M3Colors, level: M3Elevation) {
  if (level === 0) return {};
  return {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: Math.ceil(ANDROID_ELEVATION[level] / 2) },
    shadowOpacity: 0.12,
    shadowRadius: ANDROID_ELEVATION[level],
    elevation: ANDROID_ELEVATION[level],
  };
}
