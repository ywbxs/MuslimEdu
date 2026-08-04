import React from 'react';
import { View, StyleSheet } from 'react-native';
import PostCard from '../PostCard';
import { Post } from '../../services/postService';
import { COLORS, RADIUS } from '../../theme/glass';
import { CARD_W, CARD_CONTENT_W, GAP } from './deckMetrics';

interface Props {
  post: Post;
  height: number;
  onToggleLike: (post: Post) => void;
  onPressComment: (post: Post) => void;
  onPressRepost: (post: Post) => void;
  onPressImage?: (images: string[], index: number) => void;
  onDelete?: (post: Post) => void;
  onEdit?: (post: Post) => void;
  onChangePrivacy?: (post: Post, privacy: Post['privacy']) => void;
  onPressAuthor?: (userId: number) => void;
}

/**
 * Fixed-footprint wrapper around PostCard for the feed's horizontal
 * "peeking card" pager. The radius/clip/border live on this outer View
 * (not inside PostCard) - PostCard renders as plain transparent content
 * via containerStyle. Border only, no shadow - matches the classic post
 * card's own flat look instead of a floating/elevated one.
 *
 * Every card is the exact same height, and there's no inner scroll -
 * navigating between posts is swipe-only, side to side. A long post's
 * body text is capped (see PostCard's clipContent/bodyNumberOfLines) and
 * its content area clips instead of scrolling, so a short post and a long
 * post look like the same card, not a variable-height one that sometimes
 * needs its own scrollbar.
 */
export default function FeedDeckCard({ post, height, ...handlers }: Props) {
  return (
    <View style={[styles.card, { width: CARD_W, height }]}>
      <PostCard post={post} containerStyle={styles.postCard} contentWidth={CARD_CONTENT_W} clipContent bodyNumberOfLines={4} {...handlers} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginRight: GAP,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  postCard: {
    flex: 1,
    marginHorizontal: 0,
    marginTop: 0,
    borderRadius: 0,
    backgroundColor: 'transparent',
  },
});
