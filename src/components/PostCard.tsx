import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Alert,
  Modal,
  Image,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  StyleProp,
  ViewStyle,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import UserAvatar from './UserAvatar';
import RoleTag from './RoleTag';
import PostImageGrid from './PostImageGrid';
import ExpandableText from './ExpandableText';
import { Post } from '../services/postService';
import { BRAND, COLORS, RADIUS, SHADOW } from '../theme/glass';

const EMERALD = COLORS.emerald;
const EMERALD_SOFT = COLORS.emeraldSoft;
const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const HAIRLINE = COLORS.border;
const CANVAS = COLORS.canvas;
const DANGER = COLORS.danger;
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

function PencilIcon({ color }: { color: string }) {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
      <Path d="M4 20l1-4L16 5l3 3L8 19l-4 1z" stroke={color} strokeWidth={1.9} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}
function TrashIcon({ color }: { color: string }) {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
      <Path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function ChevronRightIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M9 5l6 7-6 7" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function CloseIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Line x1={5} y1={5} x2={17} y2={17} stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Line x1={17} y1={5} x2={5} y2={17} stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}
function CheckIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M4 12.5l5 5L20 6.5" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// A post with more than one photo gets its own horizontal swipe-through
// carousel inside the hero - separate from the vertical feed's own
// top-to-bottom scroll between posts (FeedScreen.tsx), the same way
// Instagram's multi-photo posts work. Sized off its own measured width
// rather than importing the deck's CARD_W, since PostCard is also used
// outside the deck (contentWidth prop) with a different width.
function HeroCarousel({
  images,
  onPressImage,
}: {
  images: string[];
  onPressImage?: (images: string[], index: number) => void;
}) {
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState(0);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!width) return;
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    setActive(Math.max(0, Math.min(images.length - 1, i)));
  };

  return (
    <View style={StyleSheet.absoluteFillObject} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          scrollEventThrottle={16}
        >
          {images.map((uri, i) => (
            <TouchableOpacity
              key={`${uri}-${i}`}
              activeOpacity={0.9}
              style={{ width }}
              onPress={() => onPressImage?.(images, i)}
            >
              <Image source={{ uri }} style={{ width, height: '100%' }} resizeMode="cover" />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      <View style={styles.carouselDots} pointerEvents="none">
        {images.map((_, i) => (
          <View key={i} style={[styles.carouselDot, i === active && styles.carouselDotActive]} />
        ))}
      </View>
    </View>
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
  // Used by the feed deck card (fixed-height, swipe-only pager): switches
  // to a big magazine-style card - a photo (or a plain color for a
  // text-only post) fills most of the fixed height with the post's text
  // overlaid at the bottom, and the author moves to a footer row below it.
  // Omit to keep the classic header-then-text card used everywhere else
  // (moderation queue, profile modal).
  clipContent?: boolean;
  // Only meaningful with clipContent - caps the headline text overlaid on
  // the hero to this many lines instead of the classic card's interactive
  // ExpandableText "See more" (expanding in place wouldn't fit over a
  // fixed-height photo, so there's nothing useful for it to do there).
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
  const [menuVisible, setMenuVisible] = useState(false);
  const [privacyVisible, setPrivacyVisible] = useState(false);
  // If the hero photo fails to load (broken/stale URL, upload that never
  // finished server-side), falling through to the gradient+text treatment
  // beats leaving a blank colored box with nothing on it at all.
  const [heroImageFailed, setHeroImageFailed] = useState(false);

  const handleHeart = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.3, useNativeDriver: true, speed: 30 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20 }),
    ]).start();
    onToggleLike(post);
  };

  const openPostMenu = () => {
    if (!post.is_mine) return;
    setMenuVisible(true);
  };

  const handleEditPress = () => {
    setMenuVisible(false);
    onEdit?.(post);
  };

  const handleChangePrivacyPress = () => {
    setMenuVisible(false);
    setPrivacyVisible(true);
  };

  const handlePrivacyPick = (privacy: Post['privacy']) => {
    setPrivacyVisible(false);
    onChangePrivacy?.(post, privacy);
  };

  const handleDeletePress = () => {
    setMenuVisible(false);
    Alert.alert('Delete post?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete?.(post) },
    ]);
  };

  const quoted = post.repost_of;
  const heartColor = post.is_liked ? HEART_RED : SUBTLE;

  // Magazine-style hero (feed deck only, see clipContent below): prefers this
  // post's own attached image, then falls back to the reposted post's image,
  // then to a plain color background for a text-only post - the card is
  // always "big", just filled with a photo or a color instead of blank space.
  const heroImages = post.images.length > 0 ? post.images : quoted && quoted.images.length > 0 ? quoted.images : [];
  const heroImage = heroImages.length > 0 ? heroImages[0] : null;
  const showHeroCarousel = heroImages.length > 1;
  const showHeroSingle = heroImages.length === 1 && !heroImageFailed;
  const showHeroImage = showHeroCarousel || showHeroSingle;
  const headlineText = post.content || quoted?.content || '';

  useEffect(() => {
    setHeroImageFailed(false);
  }, [heroImage]);

  return (
    <>
    <View style={[styles.card, containerStyle, clipContent && styles.cardMagazine]}>
      {clipContent ? (
        <>
          {/* Header - same shape as the classic card's header (avatar,
              name, role tag, time, privacy, more-options), sitting on top
              like a normal post instead of the byline moving below the
              photo. */}
          <View style={[styles.header, styles.headerMagazine]}>
            <TouchableOpacity
              style={styles.headerLeft}
              onPress={() => post.author?.id && onPressAuthor?.(post.author.id)}
              activeOpacity={0.85}
            >
              <UserAvatar name={post.author?.name ?? ''} photo={post.author?.photo} size={40} />
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

          {/* A caption only shows here when there's both a photo and text -
              a text-only post shows its text centered in the hero below
              instead, so it isn't duplicated. */}
          {heroImage && !!headlineText && (
            <Text style={styles.caption} numberOfLines={2}>
              {headlineText}
            </Text>
          )}

          {/* Compact attribution for the original post, when this is a repost. */}
          {quoted && (
            <TouchableOpacity
              style={styles.quoteCompact}
              activeOpacity={0.85}
              onPress={() => quoted.author?.id && onPressAuthor?.(quoted.author.id)}
            >
              <RepostIcon color={EMERALD} size={13} />
              <Text style={styles.quoteCompactText} numberOfLines={1}>
                {quoted.author?.name ?? 'Unknown'} · {quoted.content || 'shared a post'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Hero - fills the rest of the fixed-height card: the post's own
              photo if it has one, otherwise an auto-generated gradient with
              the post's text centered in it, so a text-only post is still
              "big" instead of a blank/mostly-empty card. */}
          <View style={styles.hero}>
            {showHeroCarousel ? (
              <HeroCarousel images={heroImages} onPressImage={onPressImage} />
            ) : showHeroSingle ? (
              <TouchableOpacity
                style={StyleSheet.absoluteFillObject}
                activeOpacity={0.9}
                onPress={() => onPressImage?.(heroImages, 0)}
              >
                <Image
                  source={{ uri: heroImage as string }}
                  style={StyleSheet.absoluteFillObject}
                  resizeMode="cover"
                  onError={() => setHeroImageFailed(true)}
                />
              </TouchableOpacity>
            ) : (
              <>
                <LinearGradient
                  colors={[BRAND.emeraldDeep, BRAND.emerald]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                />
                {!!headlineText && (
                  <Text style={styles.headlineCentered} numberOfLines={bodyNumberOfLines ?? 6}>
                    {headlineText}
                  </Text>
                )}
                {!headlineText && (
                  <Text style={styles.headlineCentered}>{'Photo unavailable'}</Text>
                )}
              </>
            )}
          </View>
        </>
      ) : (
        <>
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

          {/* Body text */}
          {!!post.content && <ExpandableText text={post.content} style={styles.content} />}

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
              {!!quoted.content && <Text style={styles.quoteContent}>{quoted.content}</Text>}
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
        </>
      )}

      {/* Action bar - grouped on the right side of the divider */}
      <View style={[styles.actionBar, clipContent && styles.actionBarMagazine]}>
        <TouchableOpacity style={styles.action} onPress={() => onPressRepost(post)} activeOpacity={0.7}>
          <RepostIcon color={EMERALD} size={26} />
          <Text style={[styles.actionCount, { color: EMERALD }]}>
            {post.reposts_count > 0 ? post.reposts_count : ''}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.action} onPress={() => onPressComment(post)} activeOpacity={0.7}>
          <CommentIcon color={SUBTLE} size={26} />
          <Text style={styles.actionCount}>{post.comments_count > 0 ? post.comments_count : ''}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionLast} onPress={handleHeart} activeOpacity={0.7}>
          <Animated.View style={{ transform: [{ scale }] }}>
            <HeartIcon filled={post.is_liked} color={heartColor} size={28} />
          </Animated.View>
          <Text style={[styles.actionCount, post.is_liked && { color: HEART_RED }]}>
            {post.likes_count > 0 ? post.likes_count : ''}
          </Text>
        </TouchableOpacity>
      </View>
    </View>

    {/* Post options - modern bottom sheet, replacing the old system Alert.alert
        dialog box. */}
    <Modal visible={menuVisible} transparent animationType="slide" onRequestClose={() => setMenuVisible(false)}>
      <View style={styles.sheetBackdrop}>
        <TouchableOpacity style={styles.sheetBackdropTouch} activeOpacity={1} onPress={() => setMenuVisible(false)} />
        <View style={styles.actionSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeaderRow}>
            <Text style={styles.sheetTitle}>Post options</Text>
            <TouchableOpacity onPress={() => setMenuVisible(false)} hitSlop={12} style={styles.sheetCloseBtn}>
              <CloseIcon color={SUBTLE} />
            </TouchableOpacity>
          </View>

          {onEdit && (
            <TouchableOpacity style={styles.sheetRow} activeOpacity={0.7} onPress={handleEditPress}>
              <View style={styles.sheetRowIconWrap}>
                <PencilIcon color={EMERALD} />
              </View>
              <Text style={styles.sheetRowLabel}>Edit post</Text>
              <ChevronRightIcon color="#C4C9CF" />
            </TouchableOpacity>
          )}
          {onChangePrivacy && (
            <TouchableOpacity style={styles.sheetRow} activeOpacity={0.7} onPress={handleChangePrivacyPress}>
              <View style={styles.sheetRowIconWrap}>
                <PrivacyIcon privacy={post.privacy} />
              </View>
              <Text style={styles.sheetRowLabel}>Change privacy</Text>
              <ChevronRightIcon color="#C4C9CF" />
            </TouchableOpacity>
          )}
          {onDelete && (
            <TouchableOpacity style={styles.sheetRow} activeOpacity={0.7} onPress={handleDeletePress}>
              <View style={[styles.sheetRowIconWrap, styles.sheetRowIconWrapDanger]}>
                <TrashIcon color={DANGER} />
              </View>
              <Text style={[styles.sheetRowLabel, { color: DANGER }]}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>

    {/* Who can see this - own bottom sheet, opened from Post options above. */}
    <Modal visible={privacyVisible} transparent animationType="slide" onRequestClose={() => setPrivacyVisible(false)}>
      <View style={styles.sheetBackdrop}>
        <TouchableOpacity style={styles.sheetBackdropTouch} activeOpacity={1} onPress={() => setPrivacyVisible(false)} />
        <View style={styles.actionSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeaderRow}>
            <Text style={styles.sheetTitle}>Who can see this?</Text>
            <TouchableOpacity onPress={() => setPrivacyVisible(false)} hitSlop={12} style={styles.sheetCloseBtn}>
              <CloseIcon color={SUBTLE} />
            </TouchableOpacity>
          </View>

          {PRIVACY_MENU_OPTIONS.map((opt) => {
            const active = opt.key === post.privacy;
            return (
              <TouchableOpacity key={opt.key} style={styles.sheetRow} activeOpacity={0.7} onPress={() => handlePrivacyPick(opt.key)}>
                <View style={styles.sheetRowIconWrap}>
                  <PrivacyIcon privacy={opt.key} />
                </View>
                <Text style={styles.sheetRowLabel}>{opt.label}</Text>
                {active && <CheckIcon color={EMERALD} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </Modal>
    </>
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
  // clipContent (feed deck) drops the base card's padding entirely - the
  // hero photo/color bleeds edge to edge, matching the outer FeedDeckCard
  // wrapper's own rounded corners instead of sitting inside a white margin.
  cardMagazine: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 },
  // Majority of the fixed-height card (flex:1 absorbs whatever's left below
  // the header/caption above and the action bar below), always filled with
  // either a photo or a plain color - never blank. backgroundColor is a
  // guaranteed solid fallback underneath the LinearGradient/Image - without
  // it, any failure to paint those (a slow image load, a gradient render
  // hiccup) leaves a blank white hero with invisible white text on top of
  // it, instead of just a plainer green while the nicer layer loads.
  hero: {
    flex: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: BRAND.emeraldDeep,
  },
  // Only shown for a text-only post (no image) - the auto-generated
  // gradient behind it is the entire point of the card, so the text is
  // centered in it rather than pinned to a corner.
  headlineCentered: { fontSize: 19, fontWeight: '800', color: '#FFFFFF', lineHeight: 25, textAlign: 'center' },
  // Page dots for a multi-photo post's HeroCarousel, bottom-center of the
  // hero - matches the classic Instagram carousel-post indicator.
  carouselDots: {
    position: 'absolute',
    bottom: 14,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  carouselDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  carouselDotActive: { backgroundColor: '#FFFFFF', width: 16 },
  // Only shown when a post has BOTH a photo and text, between the header
  // and the hero image - a text-only post shows its text centered in the
  // hero instead, so it's never shown twice.
  caption: { fontSize: 13.5, color: INK, lineHeight: 18, paddingHorizontal: 16, paddingTop: 8 },
  quoteCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  quoteCompactText: { flex: 1, fontSize: 12.5, color: SUBTLE, fontWeight: '600' },
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
  // cardMagazine drops the base card's own paddingHorizontal (see above),
  // so the action bar needs its own to stay clear of the rounded corners.
  actionBarMagazine: { paddingHorizontal: 16, paddingBottom: 12 },
  // Same reasoning - the header needs its own horizontal padding once the
  // card itself has none, plus a bit of top padding since there's no card
  // padding above it either.
  headerMagazine: { paddingHorizontal: 16, paddingTop: 14 },
  action: { flexDirection: 'row', alignItems: 'center', marginRight: 30 },
  actionLast: { flexDirection: 'row', alignItems: 'center' },
  actionCount: { fontSize: 14.5, color: SUBTLE, marginLeft: 8, fontWeight: '700', minWidth: 12 },

  // Post options / privacy bottom sheets - same visual language as the rest
  // of the app's action sheets (see ChildActionModal in ChildProfileSheet.tsx).
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(17,20,23,0.4)', justifyContent: 'flex-end' },
  sheetBackdropTouch: { flex: 1 },
  actionSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DADDE1',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: INK },
  sheetCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: CANVAS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
    gap: 12,
  },
  sheetRowIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetRowIconWrapDanger: { backgroundColor: 'rgba(239,68,68,0.1)' },
  sheetRowLabel: { flex: 1, fontSize: 15, fontWeight: '700', color: INK },
});
