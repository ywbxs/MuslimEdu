import { Dimensions } from 'react-native';

/**
 * Sibling to deckMetrics.ts, not an extension of it - deckMetrics.ts is
 * deliberately edge-to-edge/one-post-per-screen (EDGE/GAP/PEEK/END_PAD all
 * 0, see its own header comment), the opposite of what this nested widget
 * carousel needs: a multi-card, visibly-peeking-next-card layout.
 *
 * This carousel lives INSIDE one slot of the outer post deck (see
 * FeedScreen.tsx's `{ kind: 'widgets' }` item), so its own CARD_W is a
 * fraction of the screen, not the full width.
 */
const SCREEN_W = Dimensions.get('window').width;

export const EDGE = 16;
export const GAP = 12;

export const CARD_W = Math.round(SCREEN_W * 0.84);
export const SNAP = CARD_W + GAP;
export const END_PAD = 16;
