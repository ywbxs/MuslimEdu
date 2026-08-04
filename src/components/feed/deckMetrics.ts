import { Dimensions } from 'react-native';

/**
 * Shared geometry for the feed's horizontal full-screen pager
 * (FeedScreen.tsx + FeedDeckCard.tsx) - one source of truth so the FlatList's
 * snap math and each card's own width always agree.
 *
 * Module-level Dimensions.get, matching the existing pattern in
 * ImageViewerScreen.tsx/PostImageGrid.tsx - no re-layout on rotation, same
 * tradeoff already accepted elsewhere in this app.
 *
 * Each post fills the full screen width edge-to-edge (Instagram-style, no
 * card margin/peek) - swiping moves one full post at a time.
 */
const SCREEN_W = Dimensions.get('window').width;

export const EDGE = 0;
export const GAP = 0;
export const PEEK = 0;

export const CARD_W = SCREEN_W;
export const SNAP = CARD_W;
export const END_PAD = 0;

// Must match PostCard's own styles.card.paddingHorizontal.
export const CARD_PAD_H = 18;
export const CARD_CONTENT_W = CARD_W - CARD_PAD_H * 2;
