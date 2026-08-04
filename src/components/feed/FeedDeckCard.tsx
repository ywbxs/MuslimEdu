import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import PostCard from '../PostCard';
import { Post } from '../../services/postService';
import { COLORS, RADIUS, SHADOW } from '../../theme/glass';
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
 * "peeking card" pager. The radius/clip/shadow live on this outer View
 * (not inside PostCard) so Android doesn't clip the shadow - PostCard
 * renders as plain transparent content via containerStyle.
 *
 * A long post (lots of text + a full image grid) can exceed the deck's
 * fixed card height on small devices, so the content scrolls vertically
 * inside the card - directionalLockEnabled keeps a diagonal drag from
 * stealing the pager's horizontal swipe.
 */
export default function FeedDeckCard({ post, height, ...handlers }: Props) {
  return (
    <View style={[styles.card, { width: CARD_W, height }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        directionalLockEnabled
        nestedScrollEnabled
        bounces={false}
      >
        <PostCard post={post} containerStyle={styles.postCard} contentWidth={CARD_CONTENT_W} {...handlers} />
      </ScrollView>
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
    ...SHADOW.level2,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 4 },
  postCard: {
    marginHorizontal: 0,
    marginTop: 0,
    borderRadius: 0,
    backgroundColor: 'transparent',
  },
});
