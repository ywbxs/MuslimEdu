import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import CaughtUpCard from '../../components/feed/CaughtUpCard';
import CurrencyBalanceButton from '../../components/CurrencyBalanceButton';
import LanguageSwitcherButton from '../../components/LanguageSwitcherButton';
import WidgetCarousel from '../../components/feed/WidgetCarousel';
import { COLORS, RADIUS } from '../../theme/glass';

const EMERALD = COLORS.emerald;
const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;

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

// The screen is a vertical pager of full-screen sections (Home/Shop/
// Charity) - in practice a no-op today since SECTIONS only has one entry,
// so this outer FlatList never actually has anywhere to scroll to. Home's
// own content (the actual posts) is a separate, nested vertical FlatList -
// a normal scrolling feed, not a swipe-per-post deck.
//
// Shop and Charity are TEMPORARILY disabled - they were placeholder decks of
// hardcoded sample cards with no real feature behind them yet. The pager is
// left in place (rather than unwound back to a plain Home screen) so putting
// them back is just re-adding their entries here and their sample data.
type Section = 'home' | 'shop' | 'charity';
const SECTIONS: Section[] = ['home'];

export default function FeedScreen() {
  const { token, user } = useAuth();
  const { t } = useLocale();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  // Admins and teachers can author new posts (or edit their own). Students
  // (and other non-staff roles) can still repost from the feed, but never
  // get a composer.
  const canPost = user?.role === 'admin' || user?.role === 'superadmin' || user?.role === 'teacher';

  // --- Outer section pager (Home / Shop / Charity), vertical -------------
  const [outerHeight, setOuterHeight] = useState(0);
  const [sectionIndex, setSectionIndex] = useState(0);
  const activeSection: Section = SECTIONS[sectionIndex] ?? 'home';
  const headerTitleText =
    activeSection === 'shop'
      ? t('feed.header_shop', 'Shop')
      : activeSection === 'charity'
      ? t('feed.header_charity', 'Charity')
      : t('feed.header_home', 'Home');

  const onOuterSettle = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (outerHeight <= 0) return;
      const i = Math.max(0, Math.min(SECTIONS.length - 1, Math.round(e.nativeEvent.contentOffset.y / outerHeight)));
      setSectionIndex(i);
    },
    [outerHeight],
  );

  // --- Inner Home feed (the actual posts), vertical -----------------------
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
          <View style={styles.centerFill}>
            <ActivityIndicator color={EMERALD} />
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
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>{headerTitleText}</Text>
        <View style={styles.headerActions}>
          <LanguageSwitcherButton />
          <CurrencyBalanceButton />
        </View>
      </View>

      <View style={styles.outerWrap} onLayout={(e) => setOuterHeight(e.nativeEvent.layout.height)}>
        {outerHeight <= 0 ? null : (
          <FlatList
            data={SECTIONS}
            keyExtractor={(s) => s}
            showsVerticalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={outerHeight}
            snapToAlignment="start"
            disableIntervalMomentum
            getItemLayout={(_, i) => ({ length: outerHeight, offset: i * outerHeight, index: i })}
            onMomentumScrollEnd={onOuterSettle}
            onScrollEndDrag={onOuterSettle}
            renderItem={() => <View style={{ height: outerHeight }}>{homeContent}</View>}
          />
        )}
      </View>

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
  flex: { flex: 1, backgroundColor: COLORS.canvas },
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
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  composerPlaceholder: { flex: 1, fontSize: 14.5, color: SUBTLE },
  composerIconBtn: { padding: 4 },


  // The bottom tab bar is a normal docked element (MainTabs' custom TabBar
  // has no position:'absolute'), so it already gets its own space outside
  // this screen - deckWrap's flex:1 naturally stops above it with no manual
  // clearance needed.
  deckWrap: { flex: 1 },
  listContent: { paddingBottom: 20, flexGrow: 1 },

  footerLoading: { paddingVertical: 20, alignItems: 'center', justifyContent: 'center' },

  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingTop: 60,
  },
  emptyText: { color: SUBTLE, fontSize: 14, textAlign: 'center' },
});
