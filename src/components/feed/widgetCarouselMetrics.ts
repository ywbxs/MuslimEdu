import { useWindowDimensions } from 'react-native';

/**
 * Sibling to deckMetrics.ts, not an extension of it - deckMetrics.ts is
 * deliberately edge-to-edge/one-post-per-screen (EDGE/GAP/PEEK/END_PAD all
 * 0, see its own header comment), the opposite of what this nested widget
 * carousel needs: a multi-card, visibly-peeking-next-card layout.
 *
 * This carousel lives INSIDE one slot of the outer post deck (see
 * FeedScreen.tsx's `{ kind: 'widgets' }` item), so its own CARD_W is a
 * fraction of the screen, not the full width.
 *
 * A hook (not a module-level constant computed once from Dimensions.get)
 * so card width stays correct across any device size and re-derives if the
 * window itself changes size - Android's split-screen/multi-window mode
 * can resize an app's window without a full relaunch, which a one-time
 * Dimensions.get() read would miss entirely.
 */
export const EDGE = 16;
export const GAP = 12;
export const END_PAD = 16;

export function useWidgetCardMetrics() {
  const { width: screenW } = useWindowDimensions();
  const cardW = Math.round(screenW * 0.84);
  return { CARD_W: cardW, SNAP: cardW + GAP, EDGE, GAP, END_PAD };
}
