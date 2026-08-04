import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Alert, StyleProp, ViewStyle } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import UserAvatar from './UserAvatar';
import RoleTag from './RoleTag';
import PostImageGrid from './PostImageGrid';
import ExpandableText from './ExpandableText';
import { Post } from '../services/postService';
import { COLORS, RADIUS, SHADOW } from '../theme/glass';

const EMERALD = COLORS.emerald;
const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const HEART_RED = '#E0245E';

function HeartIcon({ filled, color, size = 22 }: { filled: boolean; color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'}>
      <Path
        d="M12 20.5C12 20.5 3.5 15.4 3.5 9.4 3.5 6.6 5.7 4.5 8.4 4.5c1.6 0 3.1.8 3.6 2.1.5-1.3 2-2.1 3.6-2.1 2.7 0 4.9 2.1 4.9 4.9 0 6-8.5 11.1-8.5 11.1z"
        stroke={color}
        strokeWidth={filled ? 0 : 1.9}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
function CommentIcon({ color, size = 21 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 5h16a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 20 17H9l-4.5 3.5V6.5A1.5 1.5 0 0 1 6 5z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
function RepostIcon({ color, size = 21 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="m2 9 3-3 3 3" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
      <Path
        d="M13 18H7a2 2 0 0 1-2-2V6"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="m22 15-3 3-3-3" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
      <Path
        d="M11 6h6a2 2 0 0 1 2 2v10"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
function MoreIcon({ color = SUBTLE, size = 18 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Circle cx={12} cy={5} r={1.8} />
      <Circle cx={12} cy={12} r={1.8} />
      <Circle cx={12} cy={19} r={1.8} />
    </Svg>
  );
}
function PrivacyIcon({ privacy }: { privacy: string }) {
  const c = SUBTLE;
  if (privacy === 'private') {
    return (
      <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
        <Path d="M6 10V8a6 6 0 0 1 12 0v2" stroke={c} strokeWidth={2} strokeLinecap="round" />
        <Path d="M5 10h14v10H5z" stroke={c} strokeWidth={2} strokeLinejoin="round" />
      </Svg>
    );
  }
  if (privacy === 'school') {
    return (
      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
        <Path d="M12 3l10 5-10 5L2 8l10-5z" stroke={c} strokeWidth={1.8} strokeLinejoin="round" />
        <Path d="M6 10.5V15c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.5" stroke={c} strokeWidth={1.8} strokeLinecap="round" />
      </Svg>
    );
  }
  // public
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={c} strokeWidth={1.8} />
      <Path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" stroke={c} strokeWidth={1.5} />
    </Svg>
  );
}

function timeAgo(dateStr: string): string {
  const then = new Date(dateStr).getTime();
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return 'now';
  const m = Math.floor(diffSec / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

interface Props {
  post: Post;
  onToggleLike: (post: Post) => void;
  onPressComment: (post: Post) => void;
  onPressRepost: (post: Post) => void;
  onPressImage?: (images: string[], index: number) => void;
  onDelete?: (post: Post) => void;
  onEdit?: (post: Post) => void;
  onChangePrivacy?: (post: Post, privacy: Post['privacy']) => void;
  onPressAuthor?: (userId: number) => void;
  // Overrides the outer card's own margins/radius/background - used by the
  // feed deck card, which owns its own fixed-size wrapper (with the radius,
  // clip and shadow) and needs PostCard to render as plain transparent
  // content inside it. Omit to keep today's standalone vertical-card look.
  containerStyle?: StyleProp<ViewStyle>;
  // Forwarded to PostImageGrid (own + quoted images) - omit to keep the
  // default full-width image grid sizing.
  contentWidth?: number;
  // Used by the feed deck card (fixed-height, swipe-only pager): body text,
  // own images, and the quoted-repost box render inside a flex:1,
  // overflow:hidden region instead of the card's normal auto-height flow,
  // so a long post's excess content clips instead of growing the card or
  // needing its own scroll - the header and action bar (like/comment/
  // repost) stay put and always visible either way. Omit to keep the
  // default unclipped, auto-height card used everywhere else (moderation
  // queue, profile modal).
  clipContent?: boolean;
  // Only meaningful with clipContent - caps the body text with a plain
  // numberOfLines instead of ExpandableText's interactive "See more"
  // (expanding in place would just get clipped again in a fixed-height
  // card, so there's nothing useful for it to do there).
  bodyNumberOfLines?: number;
}

const PRIVACY_MENU_OPTIONS: { key: Post['privacy']; label: string }[] = [
  { key: 'public', label: 'Public' },
  { key: 'school', label: 'School' },
  { key: 'private', label: 'Only me' },
];

export default function PostCard({
  post,
  onToggleLike,
  onPressComment,
  onPressRepost,
  onPressImage,
  onDelete,
  onEdit,
  onChangePrivacy,
  onPressAuthor,
  containerStyle,
  contentWidth,
  clipContent,
  bodyNumberOfLines,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const handleHeart = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.3, useNativeDriver: true, speed: 30 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20 }),
    ]).start();
    onToggleLike(post);
  };

  const openPrivacyMenu = () => {
    if (!onChangePrivacy) return;
    Alert.alert('Who can see this?', undefined, [
      ...PRIVACY_MENU_OPTIONS.filter((opt) => opt.key !== post.privacy).map((opt) => ({
        text: opt.label,
        onPress: () => onChangePrivacy(post, opt.key),
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const openPostMenu = () => {
    if (!post.is_mine) return;
    const buttons: any[] = [];
    if (onEdit) buttons.push({ text: 'Edit post', onPress: () => onEdit(post) });
    if (onChangePrivacy) buttons.push({ text: 'Change privacy', onPress: openPrivacyMenu });
    if (onDelete) {
      buttons.push({
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Delete post?', 'This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => onDelete(post) },
          ]),
      });
    }
    buttons.push({ text: 'Cancel', style: 'cancel' as const });
    Alert.alert('Post options', undefined, buttons);
  };

  const quoted = post.repost_of;
  const heartColor = post.is_liked ? HEART_RED : SUBTLE;

  return (
    <View style={[styles.card, containerStyle]}>
      {/* Repost banner */}
      {quoted && (
        <View style={styles.repostBanner}>
          <RepostIcon color={SUBTLE} size={14} />
          <Text style={styles.repostBannerText}>{post.author?.name ?? 'Someone'} reposted</Text>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerLeft}
          onPress={() => post.author?.id && onPressAuthor?.(post.author.id)}
          activeOpacity={0.85}
        >
          <UserAvatar name={post.author?.name ?? ''} photo={post.author?.photo} size={48} />
          <View style={styles.headerText}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{post.author?.name ?? 'Unknown'}</Text>
              <RoleTag role={post.author?.role} />
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.time}>{timeAgo(post.created_at)}</Text>
              <Text style={styles.dot}>  </Text>
              <PrivacyIcon privacy={post.privacy} />
            </View>
          </View>
        </TouchableOpacity>

        {post.is_mine && (onEdit || onDelete || onChangePrivacy) && (
          <TouchableOpacity style={styles.moreButton} onPress={openPostMenu} hitSlop={8}>
            <MoreIcon />
          </TouchableOpacity>
        )}
      </View>

      {/* Body text + images + quoted post - wrapped so clipContent can clip
          this region alone (flex:1, overflow:hidden) without affecting the
          header above or the action bar below, which always stay fully
          visible in a fixed-height card. */}
      <View style={clipContent ? styles.clippedContent : undefined}>
        {/* Body text */}
        {!!post.content &&
          (clipContent ? (
            <Text style={styles.content} numberOfLines={bodyNumberOfLines ?? 4}>
              {post.content}
            </Text>
          ) : (
            <ExpandableText text={post.content} style={styles.content} />
          ))}

        {/* Own images */}
        {!quoted && post.images.length > 0 && (
          <View style={styles.imageWrap}>
            <PostImageGrid images={post.images} width={contentWidth} onPressImage={(i) => onPressImage?.(post.images, i)} />
          </View>
        )}

        {/* Quoted original post */}
        {quoted && (
          <TouchableOpacity
            style={styles.quoteBox}
            activeOpacity={0.85}
            onPress={() => quoted.author?.id && onPressAuthor?.(quoted.author.id)}
          >
            <View style={styles.quoteHeader}>
              <UserAvatar name={quoted.author?.name ?? ''} photo={quoted.author?.photo} size={22} />
              <Text style={styles.quoteName}>{quoted.author?.name ?? 'Unknown'}</Text>
              <RoleTag role={quoted.author?.role} />
              <Text style={styles.time}>· {timeAgo(quoted.created_at)}</Text>
            </View>
            {!!quoted.content && (
              <Text style={styles.quoteContent} numberOfLines={clipContent ? 3 : undefined}>
                {quoted.content}
              </Text>
            )}
            {quoted.images.length > 0 && (
              <View style={{ marginTop: 8 }}>
                <PostImageGrid
                  images={quoted.images}
                  width={contentWidth != null ? contentWidth - 28 : undefined}
                  onPressImage={(i) => onPressImage?.(quoted.images, i)}
                />
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Action bar - grouped on the right side of the divider */}
      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.action} onPress={() => onPressRepost(post)} activeOpacity={0.7}>
          <RepostIcon color={EMERALD} />
          <Text style={[styles.actionCount, { color: EMERALD }]}>
            {post.reposts_count > 0 ? post.reposts_count : ''}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.action} onPress={() => onPressComment(post)} activeOpacity={0.7}>
          <CommentIcon color={SUBTLE} />
          <Text style={styles.actionCount}>{post.comments_count > 0 ? post.comments_count : ''}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionLast} onPress={handleHeart} activeOpacity={0.7}>
          <Animated.View style={{ transform: [{ scale }] }}>
            <HeartIcon filled={post.is_liked} color={heartColor} />
          </Animated.View>
          <Text style={[styles.actionCount, post.is_liked && { color: HEART_RED }]}>
            {post.likes_count > 0 ? post.likes_count : ''}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 8,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: RADIUS.lg,
  },
  // flex:1 + overflow:hidden - only applied when clipContent is set (via
  // the wrapping View in the render above), so the header/action bar
  // (siblings, not flexed) keep their own natural size and this region
  // alone absorbs and clips whatever's left in the fixed-height card.
  clippedContent: { flex: 1, overflow: 'hidden' },
  repostBanner: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginLeft: 4 },
  repostBannerText: { fontSize: 12, color: SUBTLE, marginLeft: 6, fontWeight: '600' },
  header: { flexDirection: 'row', alignItems: 'center' },
  headerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  moreButton: { padding: 6, marginLeft: 6 },
  headerText: { marginLeft: 12, flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '700', color: INK },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  time: { fontSize: 12.5, color: SUBTLE },
  dot: { fontSize: 12, color: SUBTLE },
  content: { fontSize: 15.5, color: INK, lineHeight: 22, marginTop: 14 },
  imageWrap: { marginTop: 12, alignItems: 'center' },
  quoteBox: {
    marginTop: 12,
    backgroundColor: COLORS.canvas,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: 14,
  },
  quoteHeader: { flexDirection: 'row', alignItems: 'center' },
  quoteName: { fontSize: 13, fontWeight: '700', color: INK, marginLeft: 8, marginRight: 6 },
  quoteContent: { fontSize: 14, color: INK, marginTop: 8, lineHeight: 19 },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 14,
    paddingTop: 12,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  action: { flexDirection: 'row', alignItems: 'center', marginRight: 28 },
  actionLast: { flexDirection: 'row', alignItems: 'center' },
  actionCount: { fontSize: 13.5, color: SUBTLE, marginLeft: 8, fontWeight: '600', minWidth: 10 },
});
