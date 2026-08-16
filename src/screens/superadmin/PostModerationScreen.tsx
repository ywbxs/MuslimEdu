import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, TextInput, Alert, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Search } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import {
  fetchModeratedPosts,
  fetchPostComments,
  deleteModeratedPost,
  deleteModeratedComment,
  ModeratedPost,
  ModeratedComment,
} from '../../services/superAdminService';
import { Skeleton } from '../../components/Skeleton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHADOW, GLASS, COLORS, RADIUS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';

const EMERALD = COLORS.emerald;
const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const HAIRLINE = COLORS.border;
const GLASS_SURFACE = GLASS.fillOnLight;
const GLASS_BORDER = GLASS.borderOnLight;
const DANGER = COLORS.danger;

function ChevronLeftIcon({ color }: { color: string }) {
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}
function SearchIcon({ color }: { color: string }) {
  return <Search size={17} color={color} strokeWidth={2} />;
}

function CommentRow({ comment, onDelete }: { comment: ModeratedComment; onDelete: (id: number) => void }) {
  const { t } = useLocale();
  return (
    <View>
      <View style={styles.commentRow}>
        <View style={styles.flex1}>
          <Text style={styles.commentAuthor}>{comment.author?.name ?? t('post_moderation.unknown_author', 'Unknown')}</Text>
          <Text style={styles.commentContent}>{comment.content}</Text>
        </View>
        <TouchableOpacity onPress={() => onDelete(comment.id)} hitSlop={6}>
          <Text style={styles.deleteLink}>{t('common.delete', 'Delete')}</Text>
        </TouchableOpacity>
      </View>
      {comment.replies.map((r) => (
        <View key={r.id} style={styles.replyIndent}>
          <CommentRow comment={r} onDelete={onDelete} />
        </View>
      ))}
    </View>
  );
}

function PostCard({ item, onDeleted }: { item: ModeratedPost; onDeleted: () => void }) {
  const { token } = useAuth();
  const { t } = useLocale();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<ModeratedComment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);

  const toggleComments = async () => {
    if (commentsOpen) {
      setCommentsOpen(false);
      return;
    }
    setCommentsOpen(true);
    if (!token) return;
    setIsLoadingComments(true);
    try {
      const data = await fetchPostComments(token, item.id);
      setComments(data);
    } catch (err) {
      Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('common.try_again_full', 'Please try again.'));
    } finally {
      setIsLoadingComments(false);
    }
  };

  const handleDeletePost = () => {
    Alert.alert(
      t('post_moderation.delete_post_title', 'Remove this post?'),
      t('post_moderation.delete_post_message', 'This cannot be undone.'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('common.delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            if (!token) return;
            try {
              await deleteModeratedPost(token, item.id);
              onDeleted();
            } catch (err) {
              Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('common.try_again_full', 'Please try again.'));
            }
          },
        },
      ],
    );
  };

  const handleDeleteComment = (commentId: number) => {
    Alert.alert(
      t('post_moderation.delete_comment_title', 'Remove this comment?'),
      t('post_moderation.delete_comment_message', 'This cannot be undone.'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('common.delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            if (!token) return;
            try {
              await deleteModeratedComment(token, commentId);
              const data = await fetchPostComments(token, item.id);
              setComments(data);
            } catch (err) {
              Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('common.try_again_full', 'Please try again.'));
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.flex1}>
          <Text style={styles.authorName}>{item.author?.name ?? t('post_moderation.unknown_author', 'Unknown')}</Text>
          <Text style={styles.cardMeta}>
            {t('post_moderation.school_id_label', 'School')} #{item.school_id} · {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
        <TouchableOpacity onPress={handleDeletePost} style={styles.deletePostBtn}>
          <Text style={styles.deleteLink}>{t('common.delete', 'Delete')}</Text>
        </TouchableOpacity>
      </View>

      {item.content ? <Text style={styles.postContent}>{item.content}</Text> : null}

      {item.images.length > 0 ? (
        <View style={styles.imageRow}>
          {item.images.slice(0, 3).map((uri) => (
            <Image key={uri} source={{ uri }} style={styles.postImage} />
          ))}
        </View>
      ) : null}

      <View style={styles.statsRow}>
        <Text style={styles.statText}>{t('post_moderation.likes', '{count} likes').replace('{count}', String(item.likes_count))}</Text>
        <TouchableOpacity onPress={toggleComments}>
          <Text style={styles.statLink}>
            {commentsOpen
              ? t('post_moderation.hide_comments', 'Hide comments')
              : t('post_moderation.view_comments', '{count} comments').replace('{count}', String(item.comments_count))}
          </Text>
        </TouchableOpacity>
      </View>

      {commentsOpen ? (
        <View style={styles.commentsWrap}>
          {isLoadingComments ? (
            <Skeleton width="100%" height={40} />
          ) : comments.length === 0 ? (
            <Text style={styles.noComments}>{t('post_moderation.no_comments', 'No comments.')}</Text>
          ) : (
            comments.map((c) => <CommentRow key={c.id} comment={c} onDelete={handleDeleteComment} />)
          )}
        </View>
      ) : null}
    </View>
  );
}

/** Superadmin-only: browse and delete any post/comment, across every school. */
export default function PostModerationScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();
  const { t } = useLocale();

  const [posts, setPosts] = useState<ModeratedPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async (search = '') => {
    if (!token) return;
    setError(null);
    try {
      const data = await fetchModeratedPosts(token, { search });
      setPosts(data.posts);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('post_moderation.load_error', 'Failed to load posts.'));
    }
  }, [token, t]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await load(query);
    setIsRefreshing(false);
  }, [load, query]);

  const handleSearchChange = (text: string) => {
    setQuery(text);
    load(text);
  };

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={10}>
          <ChevronLeftIcon color={EMERALD} />
          <Text style={styles.backText}>{t('common.back', 'Back')}</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>{t('post_moderation.header_title', 'Post Moderation')}</Text>
        </View>
        <View style={{ minWidth: 72 }} />
      </View>

      <View style={styles.searchWrap}>
        <SearchIcon color={SUBTLE} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('post_moderation.search_placeholder', 'Search post content...')}
          placeholderTextColor={SUBTLE}
          value={query}
          onChangeText={handleSearchChange}
        />
      </View>

      {isLoading ? (
        <View style={styles.listContent}>
          <Skeleton width="100%" height={140} style={{ marginBottom: 14 }} />
          <Skeleton width="100%" height={140} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => load(query)} style={styles.retryButton}>
            <Text style={styles.retryText}>{t('common.try_again', 'Try again')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={EMERALD} />}
          renderItem={({ item }) => <PostCard item={item} onDeleted={() => load(query)} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>{t('post_moderation.empty_title', 'No posts found')}</Text>
              <Text style={styles.emptyBody}>
                {query ? t('post_moderation.empty_body_search', 'Try a different search term.') : t('post_moderation.empty_body_none', 'Posts across every school will show up here.')}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: 'transparent' },
  flex1: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: GLASS_SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: GLASS_BORDER,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', minWidth: 72 },
  backText: { color: EMERALD, fontSize: 16, fontWeight: '600', marginLeft: 2 },
  headerTitleWrap: { alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: INK },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  errorText: { color: DANGER, textAlign: 'center', marginBottom: 12 },
  retryButton: { backgroundColor: '#EEF0F2', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  retryText: { color: INK, fontWeight: '600' },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GLASS_SURFACE,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingHorizontal: 16,
    height: 48,
    gap: 10,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 6,
    ...SHADOW.level1,
  },
  searchInput: { flex: 1, fontSize: 14.5, color: INK, padding: 0 },

  listContent: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: GLASS_SURFACE,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: HAIRLINE,
    padding: 16,
    marginBottom: 14,
    ...SHADOW.level2,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'flex-start' },
  authorName: { fontSize: 14.5, fontWeight: '700', color: INK },
  cardMeta: { fontSize: 11.5, color: SUBTLE, marginTop: 2 },
  deletePostBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  deleteLink: { fontSize: 12.5, color: DANGER, fontWeight: '700' },
  postContent: { fontSize: 14, color: INK, marginTop: 10, lineHeight: 20 },
  imageRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  postImage: { width: 64, height: 64, borderRadius: 10, backgroundColor: '#EEE' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: HAIRLINE },
  statText: { fontSize: 12, color: SUBTLE },
  statLink: { fontSize: 12, color: EMERALD, fontWeight: '600' },

  commentsWrap: { marginTop: 10, borderTopWidth: 1, borderTopColor: HAIRLINE, paddingTop: 10 },
  noComments: { fontSize: 12.5, color: SUBTLE, textAlign: 'center', paddingVertical: 10 },
  commentRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6 },
  commentAuthor: { fontSize: 12.5, fontWeight: '700', color: INK },
  commentContent: { fontSize: 12.5, color: SUBTLE, marginTop: 2 },
  replyIndent: { marginLeft: 18 },

  emptyWrap: { alignItems: 'center', paddingTop: 50, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 15.5, fontWeight: '700', color: INK, marginTop: 14 },
  emptyBody: { fontSize: 13, color: SUBTLE, textAlign: 'center', marginTop: 6, lineHeight: 19 },
});
