// Back-compat shim: the design system now lives in ./glass.ts (glassmorphism
// spatial UI). Old screens that still `import { COLORS, RADIUS, SHADOW } from
// '../../theme/spatial'` keep working untouched while each screen is migrated
// phase by phase. New/migrated screens should import from './glass' directly.
export { COLORS, RADIUS, SHADOW, SPACING, GLASS, MESH, BRAND, TYPE } from './glass';
