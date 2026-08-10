import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Skeleton, SkeletonCircle } from '../Skeleton';
import { RADIUS } from '../../theme/glass';

const HAIRLINE = 'rgba(13,30,28,0.08)';
const SKELETON_BASE = '#E7E9EC';

// Line widths vary post to post instead of every skeleton row being the
// same length - reads as "text of some length is coming", not a repeated
// gray bar. Last line is always shortest, matching how a real paragraph
// trails off - same idea as PostCard's own varied-length content.
const CONTENT_WIDTHS: `${number}%`[] = ['92%', '68%', '45%'];

/**
 * Loading placeholder shaped exactly like PostCard's classic layout (avatar
 * + name/meta header, content lines, optional image block, action-bar
 * icons) - drop these in wherever the feed shows PostCard so there's no
 * layout jump when real posts swap in, same principle as Skeleton.tsx's
 * own doc comment. Mirrors PostCard's real geometry (48px avatar, content
 * marginTop 14/lineHeight 22, hairline-bordered action bar with 3 icons)
 * rather than a generic block, since a skeleton that doesn't match the
 * loaded shape defeats the point of using one over a spinner.
 */
export default function PostCardSkeleton({
  withImage = false,
  style,
}: {
  withImage?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.header}>
        <SkeletonCircle size={48} baseColor={SKELETON_BASE} />
        <View style={styles.headerText}>
          <Skeleton width="45%" height={14} borderRadius={5} baseColor={SKELETON_BASE} />
          <Skeleton width="28%" height={11} borderRadius={5} baseColor={SKELETON_BASE} style={{ marginTop: 8 }} />
        </View>
      </View>

      <View style={styles.content}>
        {CONTENT_WIDTHS.map((w, i) => (
          <Skeleton
            key={i}
            width={w}
            height={13}
            borderRadius={5}
            baseColor={SKELETON_BASE}
            style={i > 0 ? { marginTop: 9 } : undefined}
          />
        ))}
      </View>

      {withImage && <Skeleton width="100%" height={200} borderRadius={RADIUS.md} baseColor={SKELETON_BASE} style={styles.image} />}

      <View style={styles.actionBar}>
        <SkeletonCircle size={22} baseColor={SKELETON_BASE} />
        <SkeletonCircle size={22} baseColor={SKELETON_BASE} style={styles.actionGap} />
        <SkeletonCircle size={22} baseColor={SKELETON_BASE} style={styles.actionGap} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
  },
  header: { flexDirection: 'row', alignItems: 'center' },
  headerText: { marginLeft: 12, flex: 1 },
  content: { marginTop: 14 },
  image: { marginTop: 12 },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
  },
  actionGap: { marginLeft: 20 },
});
