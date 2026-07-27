import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import {
  Post,
  PostPrivacy,
  fetchFeed,
  toggleLike,
  deletePost,
  repost,
  updatePostPrivacy,
} from '../../services/postService';
import PostCard from '../../components/PostCard';
import UserAvatar from '../../components/UserAvatar';
import UserProfileModal from '../../components/UserProfileModal';
import { COLORS, RADIUS, SHADOW } from '../../theme/glass';

const EMERALD = COLORS.emerald;
const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;

const AnimatedFlatList = Animated.createAnimatedComponent(
  FlatList as new () => FlatList<Post>,
);

// ---- Inline icons (react-native-svg) --------------------------------------
function PlusIcon({ color = '#FFFFFF', size = 24 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}
function LeafIcon({ color = EMERALD, size = 15 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 4C9 4 4 10 4 18c0 0 5-1 8-4s6-8 8-10zM4 20c4-6 8-8 12-9"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
function PhotoIcon({ color = EMERALD, size = 20 }: { color?: string; size?: number }) {
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
function TextIcon({ color = EMERALD, size = 20 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 6h14M12 6v13" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
    </Svg>
  );
}
function PollIcon({ color = EMERALD, size = 20 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 20V10M12 20V4M18 20v-7" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

export default function FeedScreen() {
  const { token, user } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  // Admins and teachers can author new posts (or edit their own). Students
  // (and other non-staff roles) can still repost from the feed, but never
  // get a composer.
  const canPost = user?.role === 'admin' || user?.role === 'superadmin' || user?.role === 'teacher';

  const scrollY = useRef(new Animated.Value(0)).current;
  const [headerHeight, setHeaderHeight] = useState(150);

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [nextBeforeId, setNextBeforeId] = useState<number | null>(null);
  const [profileUserId, setProfileUserId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetchFeed(token);
      setPosts(res.posts);
      setHasMore(res.hasMore);
      setNextBeforeId(res.nextBeforeId);
    } catch (err: any) {
      Alert.alert('Couldn\u2019t load feed', err?.message ?? 'Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const onEndReached = async () => {
    if (!token || loadingMore || !hasMore || !nextBeforeId) return;
    setLoadingMore(true);
    try {
      const res = await fetchFeed(token, nextBeforeId);
      setPosts((prev) => [...prev, ...res.posts]);
      setHasMore(res.hasMore);
      setNextBeforeId(res.nextBeforeId);
    } catch {
      // silent - user can pull to refresh or scroll again
    } finally {
      setLoadingMore(false);
    }
  };

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

  const handleRepost = (post: Post) => {
    if (!canPost) {
      Alert.alert('Repost', 'Repost this to your feed?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Repost',
          onPress: async () => {
            if (!token) return;
            try {
              const created = await repost(token, post.id);
              setPosts((prev) => [created, ...prev]);
            } catch (err: any) {
              Alert.alert('Couldn\u2019t repost', err?.message ?? 'Please try again.');
            }
          },
        },
      ]);
      return;
    }
    Alert.alert('Repost', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Repost',
        onPress: async () => {
          if (!token) return;
          try {
            const created = await repost(token, post.id);
            setPosts((prev) => [created, ...prev]);
          } catch (err: any) {
            Alert.alert('Couldn\u2019t repost', err?.message ?? 'Please try again.');
          }
        },
      },
      {
        text: 'Repost with comment',
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
      Alert.alert('Couldn\u2019t delete', err?.message ?? 'Please try again.');
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
      Alert.alert('Couldn\u2019t update privacy', err?.message ?? 'Please try again.');
    }
  };

  // --- Parallax: the header is FIXED behind the feed. It never translates.
  // As the feed scrolls up, opaque cards slide over the header, covering it.
  // We fade the header out over the first stretch so it never peeks between
  // cards. Native driver keeps it buttery with no flicker.
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, headerHeight * 0.75, headerHeight],
    outputRange: [1, 0.35, 0],
    extrapolate: 'clamp',
  });

  const openCompose = () => (navigation as any).navigate('CreatePost');

  // Composer card + top spacer, sits at the top of the scrolling feed.
  // Admin-only - teachers/students never see a way to start a new post.
  const ListHeader = (
    <View>
      {/* Transparent spacer that reveals the fixed header underneath at rest */}
      <View style={{ height: headerHeight }} />
      {canPost && (
        <TouchableOpacity
          style={styles.composer}
          activeOpacity={0.9}
          onPress={openCompose}
        >
          <View style={styles.composerTop}>
            <UserAvatar name={user?.name ?? ''} photo={user?.photo} size={52} />
            <Text style={styles.composerPlaceholder}>What's on your mind?</Text>
          </View>
          <View style={styles.composerDivider} />
          <View style={styles.composerActions}>
            <TouchableOpacity style={styles.composerAction} activeOpacity={0.7} onPress={openCompose}>
              <PhotoIcon />
              <Text style={styles.composerActionText}>Photo</Text>
            </TouchableOpacity>
            <View style={styles.composerSep} />
            <TouchableOpacity style={styles.composerAction} activeOpacity={0.7} onPress={openCompose}>
              <TextIcon />
              <Text style={styles.composerActionText}>Text</Text>
            </TouchableOpacity>
            <View style={styles.composerSep} />
            <TouchableOpacity style={styles.composerAction} activeOpacity={0.7} onPress={openCompose}>
              <PollIcon />
              <Text style={styles.composerActionText}>Poll</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.flex}>
      {/* FIXED background header - does not scroll, gets covered by the feed */}
      <Animated.View
        style={[styles.header, { paddingTop: insets.top + 12, opacity: headerOpacity }]}
        onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
        pointerEvents="box-none"
      >
        <View style={styles.headerTextCol}>
          <Text style={styles.headerTitle}>Home</Text>
          <Text style={styles.headerGreeting}>Assalamu Alaykum,</Text>
          <View style={styles.headerNameRow}>
            <Text style={styles.headerName}>{user?.name ?? ''}</Text>
            <View style={{ marginLeft: 6 }}>
              <LeafIcon />
            </View>
          </View>
        </View>
        <View style={styles.headerButtons}>
          {canPost && (
            <TouchableOpacity style={styles.composeButton} activeOpacity={0.85} onPress={openCompose}>
              <PlusIcon />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {loading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={EMERALD} />
        </View>
      ) : (
        <AnimatedFlatList
          data={posts}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              onToggleLike={handleToggleLike}
              onPressComment={handleComment}
              onPressRepost={handleRepost}
              onDelete={handleDelete}
              onEdit={handleEdit}
              onChangePrivacy={handleChangePrivacy}
              onPressAuthor={setProfileUserId}
              onPressImage={(images, index) =>
                (navigation as any).navigate('ImageViewer', { images, initialIndex: index })
              }
            />
          )}
          ListHeaderComponent={ListHeader}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
            useNativeDriver: true,
          })}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={EMERALD} />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator style={{ marginVertical: 20 }} color={EMERALD} /> : null
          }
          ListEmptyComponent={
            <View style={styles.centerFill}>
              <Text style={styles.emptyText}>No posts yet. Be the first to share something!</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 130 }}
          showsVerticalScrollIndicator={false}
        />
      )}

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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTextCol: { flex: 1 },
  headerTitle: { fontSize: 34, fontWeight: '800', color: INK, letterSpacing: -0.5 },
  headerGreeting: { fontSize: 14, color: SUBTLE, marginTop: 2 },
  headerNameRow: { flexDirection: 'row', alignItems: 'center', marginTop: 1 },
  headerName: { fontSize: 20, fontWeight: '800', color: EMERALD },
  headerButtons: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  composeButton: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.pill,
    backgroundColor: EMERALD,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.glow,
  },

  composer: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 6,
    ...SHADOW.level2,
  },
  composerTop: { flexDirection: 'row', alignItems: 'center' },
  composerPlaceholder: { marginLeft: 16, fontSize: 17, color: COLORS.faint, flex: 1 },
  composerDivider: { height: 1, backgroundColor: COLORS.border, marginTop: 16 },
  composerActions: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  composerAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerActionText: { marginLeft: 8, fontSize: 14, fontWeight: '600', color: INK },
  composerSep: { width: 1, height: 22, backgroundColor: COLORS.border },

  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 120,
    paddingHorizontal: 30,
  },
  emptyText: { color: SUBTLE, fontSize: 14, textAlign: 'center' },
});
