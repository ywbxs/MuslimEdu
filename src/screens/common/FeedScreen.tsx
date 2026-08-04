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
import FeedDeckCard from '../../components/feed/FeedDeckCard';
import CaughtUpCard from '../../components/feed/CaughtUpCard';
import { CARD_W, SNAP, EDGE, END_PAD } from '../../components/feed/deckMetrics';
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
function TextIcon({ color = EMERALD, size = 18 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 6h14M12 6v13" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
    </Svg>
  );
}
function PollIcon({ color = EMERALD, size = 18 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 20V10M12 20V4M18 20v-7" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

// Once pagination is exhausted, "All caught up" becomes its own card at the
// end of the deck - reached the same way every other card is, by swiping to
// it - rather than a pill overlaid on top of the last post.
type DeckItem = { kind: 'post'; post: Post } | { kind: 'caughtUp' };

export default function FeedScreen() {
  const { token, user } = useAuth();
  const { t } = useLocale();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  // Admins and teachers can author new posts (or edit their own). Students
  // (and other non-staff roles) can still repost from the feed, but never
  // get a composer.
  const canPost = user?.role === 'admin' || user?.role === 'superadmin' || user?.role === 'teacher';

  const listRef = useRef<FlatList<DeckItem>>(null);
  const [deckHeight, setDeckHeight] = useState(0);
  // deckHeight is the wrap's own box height (padding doesn't shrink that) -
  // subtract its top+bottom padding to get the actual space a card has.
  const cardHeight = deckHeight > 0 ? deckHeight - 12 - 118 : 0;

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);
  const [hasMore, setHasMore] = useState(true);
  const [nextBeforeId, setNextBeforeId] = useState<number | null>(null);
  const [profileUserId, setProfileUserId] = useState<number | null>(null);

  const [index, setIndex] = useState(0);

  const deckData: DeckItem[] = useMemo(() => {
    const items: DeckItem[] = posts.map((post) => ({ kind: 'post', post }));
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
        setIndex(0);
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

  // Horizontal onEndReachedThreshold is measured in multiples of the
  // visible WIDTH, not a fixed distance - 0.4 (fine for a vertical list)
  // would fire far too late here, so pagination is also driven proactively
  // from onSettle below once the reader nears the end of what's loaded.
  const onSettle = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const i = Math.max(0, Math.round(e.nativeEvent.contentOffset.x / SNAP));
      setIndex(i);
      if (i >= posts.length - 3) onEndReached();
    },
    [posts.length, onEndReached],
  );

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

  // A new post (from posting or reposting) lands at index 0 and shifts
  // every existing index under the reader's finger - jump the deck back to
  // the start so what they're looking at doesn't silently change under them.
  const jumpToStart = () => {
    setIndex(0);
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
    const deletedIndex = posts.findIndex((p) => p.id === post.id);
    setPosts((prev) => prev.filter((p) => p.id !== post.id));
    // Clamp the deck to the new (shorter) end so it doesn't strand past it.
    const newLast = posts.length - 2;
    if (deletedIndex !== -1 && deletedIndex <= index && newLast >= 0) {
      const target = Math.max(0, Math.min(index, newLast));
      listRef.current?.scrollToIndex({ index: target, animated: true });
    }
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

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>{t('feed.header_home', 'Home')}</Text>
      </View>

      {canPost && (
        <TouchableOpacity style={styles.composer} activeOpacity={0.9} onPress={openCompose}>
          <UserAvatar name={user?.name ?? ''} photo={user?.photo} size={36} />
          <Text style={styles.composerPlaceholder} numberOfLines={1}>
            {t('feed.composer_placeholder', "What's on your mind?")}
          </Text>
          <TouchableOpacity style={styles.composerIconBtn} activeOpacity={0.7} onPress={openCompose} hitSlop={6}>
            <PhotoIcon />
          </TouchableOpacity>
          <TouchableOpacity style={styles.composerIconBtn} activeOpacity={0.7} onPress={openCompose} hitSlop={6}>
            <TextIcon />
          </TouchableOpacity>
          <TouchableOpacity style={styles.composerIconBtn} activeOpacity={0.7} onPress={openCompose} hitSlop={6}>
            <PollIcon />
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      <View style={styles.deckWrap} onLayout={(e) => setDeckHeight(e.nativeEvent.layout.height)}>
        {loading ? (
          <View style={styles.centerFill}>
            <ActivityIndicator color={EMERALD} />
          </View>
        ) : cardHeight <= 0 ? null : (
          <FlatList
            ref={listRef}
            data={deckData}
            keyExtractor={(item) => (item.kind === 'post' ? String(item.post.id) : 'caught-up')}
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={SNAP}
            snapToAlignment="start"
            disableIntervalMomentum
            contentContainerStyle={{ paddingLeft: EDGE, paddingRight: END_PAD }}
            getItemLayout={(_, i) => ({ length: SNAP, offset: i * SNAP, index: i })}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={EMERALD} />}
            removeClippedSubviews={false}
            initialNumToRender={2}
            maxToRenderPerBatch={3}
            windowSize={5}
            onMomentumScrollEnd={onSettle}
            onScrollEndDrag={onSettle}
            onEndReached={onEndReached}
            onEndReachedThreshold={1.5}
            renderItem={({ item }) =>
              item.kind === 'caughtUp' ? (
                <CaughtUpCard height={cardHeight} />
              ) : (
                <FeedDeckCard
                  post={item.post}
                  height={cardHeight}
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
                <View style={[styles.footerLoading, { height: cardHeight }]}>
                  <ActivityIndicator color={EMERALD} />
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View style={[styles.centerFill, { width: CARD_W }]}>
                <Text style={styles.emptyText}>{t('feed.empty', 'No posts yet. Be the first to share something!')}</Text>
              </View>
            }
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
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 34, fontWeight: '800', color: INK, letterSpacing: -0.5 },

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

  // paddingBottom reserves space below the deck for the bottom tab bar -
  // cards must not render underneath it (unlike the old vertical list,
  // where scrolling could reveal content past that point).
  deckWrap: { flex: 1, paddingTop: 12, paddingBottom: 118 },

  footerLoading: { width: CARD_W, alignItems: 'center', justifyContent: 'center' },

  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  emptyText: { color: SUBTLE, fontSize: 14, textAlign: 'center' },
});
