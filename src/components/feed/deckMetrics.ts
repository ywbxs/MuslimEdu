import { Dimensions } from 'react-native';

/**
 * Shared geometry for the feed's horizontal "peeking card" pager
 * (FeedScreen.tsx + FeedDeckCard.tsx) - one source of truth so the FlatList's
 * snap math and each card's own width always agree.
 *
 * Module-level Dimensions.get, matching the existing pattern in
 * ImageViewerScreen.tsx/PostImageGrid.tsx - no re-layout on rotation, same
 * tradeoff already accepted elsewhere in this app.
 */
const SCREEN_W = Dimensions.get('window').width;

export const EDGE = 16; // left gutter - also the resting left edge of every card
export const GAP = 12; // gap between cards
export const PEEK = 28; // how much of the next card peeks in from the right

export const CARD_W = SCREEN_W - EDGE - GAP - PEEK;
export const SNAP = CARD_W + GAP;

// Content width is EDGE + n*SNAP + END_PAD (the last item keeps its own
// marginRight: GAP). Setting END_PAD = PEEK makes the max scroll offset
// resolve to exactly (n-1)*SNAP - the last card parks flush at EDGE with
// zero slack and zero peek, which is exactly "no peek past the last post"
// with no special-casing needed.
export const END_PAD = PEEK;

// Must match PostCard's own styles.card.paddingHorizontal.
export const CARD_PAD_H = 18;
export const CARD_CONTENT_W = CARD_W - CARD_PAD_H * 2;
