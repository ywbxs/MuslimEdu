import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import {
  Post,
  PostPrivacy,
  fetchFeed,
  toggleLike,
  deletePost,
  repost,
  updatePostPrivacy,
} from '../../services/postService';
import UserAvatar from '../../components/UserAvatar';
import UserProfileModal from '../../components/UserProfileModal';
import PostCard from '../../components/PostCard';
import PostCardSkeleton from '../../components/feed/PostCardSkeleton';
import CaughtUpCard from '../../components/feed/CaughtUpCard';
import CurrencyBalanceButton from '../../components/CurrencyBalanceButton';
import LanguageSwitcherButton from '../../components/LanguageSwitcherButton';
import WidgetCarousel from '../../components/feed/WidgetCarousel';
import { RADIUS } from '../../theme/glass';

// Teal/mint palette matching the login + feed mockup redesign - see
// LoginScreen.tsx's own local-palette precedent. CANVAS/CANVAS_SOFT drive a
// soft gradient backdrop instead of a flat color, same as login.
const EMERALD = '#2BCBB0';
const INK = '#0D1E1C';
const SUBTLE = '#6B8C88';
const CANVAS = '#E8F4F2';
const CANVAS_SOFT = '#F2FAF8';
const GLASS_BORDER = 'rgba(255,255,255,0.5)';
const GLASS_FILL = 'rgba(255,255,255,0.4)';

// ---- Inline icons (react-native-svg) --------------------------------------
function PhotoIcon({ color = EMERALD, size = 18 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={8.5} cy={9} r={1.4} fill={color} />
    </Svg>
  );
}

// Once pagination is exhausted, "All caught up" becomes its own card at the
// end of the vertical feed - reached the same way every other post is, by
// scrolling to it - rather than a pill overlaid on top of the last post.
//
// 'widgets' (Prayer Times + superadmin announcements, see WidgetCarousel.tsx)
// sits at a fixed, early-but-not-first position - once there are enough
// posts to have a "middle" at all, it's pinned to index WIDGETS_AFTER_POSTS
// rather than a count derived from posts.length, so it never becomes a
// moving/receding target as more posts paginate in later.
type DeckItem = { kind: 'post'; post: Post } | { kind: 'widgets' } | { kind: 'caughtUp' };
const WIDGETS_AFTER_POSTS = 2;

// Home used to be wrapped in an outer vertical FlatList (a Home/Shop/
// Charity pager) around this inner vertical FlatList (the actual posts).
// Two same-axis FlatLists nested like that is a known RN gotcha: the outer
// one intercepts scroll/touch gestures even with nothing to scroll to,
// which silently blocked the inner post list from scrolling at all. Shop
// and Charity were already disabled placeholders (hardcoded sample cards,
// no real feature behind them), so the pager was pure dead weight actively
// breaking the feed - removed rather than patched. If Shop/Charity come
// back, give them their own tab/screen instead of re-nesting a vertical
// pager around this list.

export default function FeedScreen() {
  const { token, user } = useAuth();
  const { t } = useLocale();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  // Admins and teachers can author new posts (or edit their own). Students
  // (and other non-staff roles) can still repost from the feed, but never
  // get a composer.
  const canPost = user?.role === 'admin' || user?.role === 'superadmin' || user?.role === 'teacher';

  const headerTitleText = t('feed.header_home', 'Home');

  // --- Home feed (the actual posts), vertical -----------------------
  const listRef = useRef<FlatList<DeckItem>>(null);

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);
  const [hasMore, setHasMore] = useState(true);
  const [nextBeforeId, setNextBeforeId] = useState<number | null>(null);
  const [profileUserId, setProfileUserId] = useState<number | null>(null);

  // Whether the "All caught up" card has actually scrolled into view yet -
  // drives its one-shot entrance animation (see CaughtUpCard.tsx).
  const [caughtUpVisible, setCaughtUpVisible] = useState(false);
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: { item: DeckItem }[] }) => {
    if (viewableItems.some((v) => v.item.kind === 'caughtUp')) setCaughtUpVisible(true);
  }).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const deckData: DeckItem[] = useMemo(() => {
    const items: DeckItem[] = posts.map((post) => ({ kind: 'post', post }));
    if (posts.length > 0) items.splice(Math.min(WIDGETS_AFTER_POSTS, posts.length), 0, { kind: 'widgets' });
    if (posts.length > 0 && !hasMore) items.push({ kind: 'caughtUp' });
    return items;
  }, [posts, hasMore]);

  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!token) return;
      if (!opts.silent) setLoading(true);
      try {
        const res = await fetchFeed(token);
        setPosts(res.posts);
        setHasMore(res.hasMore);
        setNextBeforeId(res.nextBeforeId);
        setCaughtUpVisible(false);
        listRef.current?.scrollToOffset({ offset: 0, animated: false });
      } catch (err: any) {
        Alert.alert(
          t('feed.load_error_title', 'Couldn’t load feed'),
          err?.message ?? t('common.try_again_full', 'Please try again.'),
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, t],
  );

  const onRefresh = () => {
    setRefreshing(true);
    load({ silent: true });
  };

  useEffect(() => {
    load();
  }, [load]);

  // No manual refresh button anymore - the feed reloads automatically every
  // time this screen regains focus (e.g. switching back to the Home tab),
  // which covers the same "see anything new" need.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onEndReached = useCallback(async () => {
    if (!token || loadingMoreRef.current || !hasMore || !nextBeforeId) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const res = await fetchFeed(token, nextBeforeId);
      setPosts((prev) => [...prev, ...res.posts]);
      setHasMore(res.hasMore);
      setNextBeforeId(res.nextBeforeId);
    } catch {
      // silent - user can pull to refresh or scroll again
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [token, hasMore, nextBeforeId]);

  const handleToggleLike = async (post: Post) => {
    if (!token) return;
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? { ...p, is_liked: !p.is_liked, likes_count: p.likes_count + (p.is_liked ? -1 : 1) }
          : p,
      ),
    );
    try {
      await toggleLike(token, post.id);
    } catch {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id ? { ...p, is_liked: post.is_liked, likes_count: post.likes_count } : p,
        ),
      );
    }
  };

  const handleComment = (post: Post) => {
    (navigation as any).navigate('PostComments', { postId: post.id });
  };

  // A new post (from posting or reposting) lands at the top - scroll back
  // there so what the reader is looking at doesn't silently move under them.
  const jumpToStart = () => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const handleRepost = (post: Post) => {
    if (!canPost) {
      Alert.alert(t('feed.repost_title', 'Repost'), t('feed.repost_confirm', 'Repost this to your feed?'), [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('feed.repost_action', 'Repost'),
          onPress: async () => {
            if (!token) return;
            try {
              const created = await repost(token, post.id);
              setPosts((prev) => [created, ...prev]);
              jumpToStart();
            } catch (err: any) {
              Alert.alert(
                t('feed.repost_error_title', 'Couldn’t repost'),
                err?.message ?? t('common.try_again_full', 'Please try again.'),
              );
            }
          },
        },
      ]);
      return;
    }
    Alert.alert(t('feed.repost_title', 'Repost'), undefined, [
      { text: t('common.cancel', 'Cancel'), style: 'cancel' },
      {
        text: t('feed.repost_action', 'Repost'),
        onPress: async () => {
          if (!token) return;
          try {
            const created = await repost(token, post.id);
            setPosts((prev) => [created, ...prev]);
            jumpToStart();
          } catch (err: any) {
            Alert.alert(
              t('feed.repost_error_title', 'Couldn’t repost'),
              err?.message ?? t('common.try_again_full', 'Please try again.'),
            );
          }
        },
      },
      {
        text: t('feed.repost_with_comment', 'Repost with comment'),
        onPress: () => (navigation as any).navigate('CreatePost', { repostOfId: post.id }),
      },
    ]);
  };

  const handleDelete = async (post: Post) => {
    if (!token) return;
    setPosts((prev) => prev.filter((p) => p.id !== post.id));
    try {
      await deletePost(token, post.id);
    } catch (err: any) {
      Alert.alert(
        t('feed.delete_error_title', 'Couldn’t delete'),
        err?.message ?? t('common.try_again_full', 'Please try again.'),
      );
      load();
    }
  };

  const handleEdit = (post: Post) => {
    (navigation as any).navigate('CreatePost', { editPost: post });
  };

  const handleChangePrivacy = async (post: Post, privacy: PostPrivacy) => {
    if (!token) return;
    const previousPrivacy = post.privacy;
    setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, privacy } : p)));
    try {
      await updatePostPrivacy(token, post.id, privacy);
    } catch (err: any) {
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, privacy: previousPrivacy } : p)),
      );
      Alert.alert(
        t('feed.privacy_error_title', 'Couldn’t update privacy'),
        err?.message ?? t('common.try_again_full', 'Please try again.'),
      );
    }
  };

  const openCompose = () => (navigation as any).navigate('CreatePost');

  const homeContent = (
    <>
      {canPost && (
        <TouchableOpacity style={styles.composer} activeOpacity={0.9} onPress={openCompose}>
          <UserAvatar name={user?.name ?? ''} photo={user?.photo} size={36} />
          <Text style={styles.composerPlaceholder} numberOfLines={1}>
            {t('feed.composer_placeholder', 'Share a photo...')}
          </Text>
          <TouchableOpacity style={styles.composerIconBtn} activeOpacity={0.7} onPress={openCompose} hitSlop={6}>
            <PhotoIcon />
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      <View style={styles.deckWrap}>
        {loading ? (
          <View style={styles.skeletonStack}>
            <PostCardSkeleton withImage style={styles.feedPostCard} />
            <PostCardSkeleton style={styles.feedPostCard} />
            <PostCardSkeleton withImage style={styles.feedPostCard} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={deckData}
            keyExtractor={(item) => (item.kind === 'post' ? String(item.post.id) : item.kind === 'widgets' ? 'widgets' : 'caught-up')}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={EMERALD} />}
            onEndReached={onEndReached}
            onEndReachedThreshold={0.5}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            renderItem={({ item }) =>
              item.kind === 'caughtUp' ? (
                <CaughtUpCard visible={caughtUpVisible} />
              ) : item.kind === 'widgets' ? (
                <WidgetCarousel />
              ) : (
                <PostCard
                  post={item.post}
                  onToggleLike={handleToggleLike}
                  onPressComment={handleComment}
                  onPressRepost={handleRepost}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                  onChangePrivacy={handleChangePrivacy}
                  onPressAuthor={setProfileUserId}
                  onPressImage={(images, imgIndex) =>
                    (navigation as any).navigate('ImageViewer', { images, initialIndex: imgIndex })
                  }
                  containerStyle={styles.feedPostCard}
                />
              )
            }
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.footerLoading}>
                  <ActivityIndicator color={EMERALD} />
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.centerFill}>
                <Text style={styles.emptyText}>{t('feed.empty', 'No posts yet. Be the first to share something!')}</Text>
              </View>
            }
          />
        )}
      </View>
    </>
  );

  return (
    <View style={styles.flex}>
      <LinearGradient
        colors={[CANVAS_SOFT, CANVAS]}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>{headerTitleText}</Text>
        <View style={styles.headerActions}>
          <LanguageSwitcherButton />
          <CurrencyBalanceButton />
        </View>
      </View>

      <View style={styles.outerWrap}>{homeContent}</View>

      <UserProfileModal
        userId={profileUserId}
        visible={profileUserId !== null}
        onClose={() => setProfileUserId(null)}
        onOpenComments={(post) => {
          setProfileUserId(null);
          handleComment(post);
        }}
        onOpenProfile={setProfileUserId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: CANVAS },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 34, fontWeight: '800', color: INK, letterSpacing: -0.5 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  // Wraps the Home/Shop/Charity vertical pager - fills whatever's left
  // below the header.
  outerWrap: { flex: 1 },

  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    overflow: 'hidden',
  },
  composerPlaceholder: { flex: 1, fontSize: 14.5, color: SUBTLE },
  composerIconBtn: { padding: 4 },

  // Edge-to-edge translucent row instead of PostCard's default floating
  // rounded card - matches the feed mockup's flat, hairline-divided list.
  // Only applied here (via containerStyle); PostCard's own default "card"
  // style is untouched for every other screen that renders it (moderation
  // queue, profile modal, admin trash, etc).
  feedPostCard: {
    backgroundColor: GLASS_FILL,
    borderRadius: 0,
    marginHorizontal: 0,
    marginTop: 0,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: GLASS_BORDER,
  },


  // The bottom tab bar is a normal docked element (MainTabs' custom TabBar
  // has no position:'absolute'), so it already gets its own space outside
  // this screen - deckWrap's flex:1 naturally stops above it with no manual
  // clearance needed.
  deckWrap: { flex: 1 },
  listContent: { paddingBottom: 20, flexGrow: 1 },

  footerLoading: { paddingVertical: 20, alignItems: 'center', justifyContent: 'center' },

  skeletonStack: { paddingTop: 4 },

  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingTop: 60,
  },
  emptyText: { color: SUBTLE, fontSize: 14, textAlign: 'center' },
});
