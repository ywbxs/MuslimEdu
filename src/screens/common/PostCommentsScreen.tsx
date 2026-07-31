import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import UserAvatar from '../../components/UserAvatar';
import RoleTag from '../../components/RoleTag';
import UserProfileModal from '../../components/UserProfileModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../theme/spatial';
import {
  PostComment,
  fetchComments,
  addComment,
  deleteComment,
  toggleCommentLike,
} from '../../services/postService';

const EMERALD = '#0F9D58';
const INK = '#1C1C1E';
const SUBTLE = '#8E8E93';
const HAIRLINE = '#ECEEF0';
const HEART_RED = '#E0245E';

function BackIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M15 5 8 12l7 7" stroke={INK} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function SendIcon({ disabled }: { disabled: boolean }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M4 12 20 4l-6 16-3-7-7-1Z" stroke={disabled ? SUBTLE : EMERALD} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}
function HeartIcon({ filled, size = 15 }: { filled: boolean; size?: number }) {
  const color = filled ? HEART_RED : SUBTLE;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'}>
      <Path
        d="M12 20.5s-7.5-4.6-10-9.3C.6 8 2.1 4.5 5.6 4c2.1-.3 4 .8 6.4 3.3C14.4 4.8 16.3 3.7 18.4 4c3.5.5 5 4 3.6 7.2-2.5 4.7-10 9.3-10 9.3z"
        stroke={color}
        strokeWidth={1.9}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
function CommentBubbleIcon({ size = 15 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 5h16a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 20 17H9l-4.5 3.5V6.5A1.5 1.5 0 0 1 6 5z"
        stroke={SUBTLE}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
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
  return `${Math.floor(h / 24)}d`;
}

// Applies an update to a comment by id, whether it's top-level or nested
// inside a `replies` array - keeps the two-level tree in sync from one call.
function updateCommentTree(
  comments: PostComment[],
  id: number,
  updater: (c: PostComment) => PostComment,
): PostComment[] {
  return comments.map((c) => {
    if (c.id === id) return updater(c);
    if (c.replies?.length) {
      return { ...c, replies: updateCommentTree(c.replies, id, updater) };
    }
    return c;
  });
}

function removeCommentFromTree(comments: PostComment[], id: number): PostComment[] {
  return comments
    .filter((c) => c.id !== id)
    .map((c) => (c.replies?.length ? { ...c, replies: removeCommentFromTree(c.replies, id) } : c));
}

export default function PostCommentsScreen() {
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const navigation = useNavigation();
  const route = useRoute();
  const { t } = useLocale();
  const postId = (route.params as any)?.postId as number;

  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<PostComment | null>(null);
  const [profileUserId, setProfileUserId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetchComments(token, postId);
      setComments(res);
    } catch (err: any) {
      Alert.alert(t('post_comments.load_error_title', 'Couldn\u2019t load comments'), err?.message ?? t('common.try_again_full', 'Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [token, postId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const send = async () => {
    if (!token || !text.trim() || sending) return;
    setSending(true);
    try {
      const res = await addComment(token, postId, text.trim(), replyTo?.id);
      if (res.parentId) {
        // it's a reply - tuck it under its parent instead of the top level
        setComments((prev) =>
          updateCommentTree(prev, res.parentId as number, (c) => ({
            ...c,
            replies: [...c.replies, res.comment],
          })),
        );
      } else {
        setComments((prev) => [...prev, res.comment]);
      }
      setText('');
      setReplyTo(null);
    } catch (err: any) {
      Alert.alert(t('post_comments.comment_error_title', 'Couldn\u2019t comment'), err?.message ?? t('common.try_again_full', 'Please try again.'));
    } finally {
      setSending(false);
    }
  };

  const handleToggleLike = async (comment: PostComment) => {
    if (!token) return;
    // optimistic update
    setComments((prev) =>
      updateCommentTree(prev, comment.id, (c) => ({
        ...c,
        is_liked: !c.is_liked,
        likes_count: c.likes_count + (c.is_liked ? -1 : 1),
      })),
    );
    try {
      await toggleCommentLike(token, comment.id);
    } catch {
      // roll back
      setComments((prev) =>
        updateCommentTree(prev, comment.id, (c) => ({
          ...c,
          is_liked: comment.is_liked,
          likes_count: comment.likes_count,
        })),
      );
    }
  };

  const handleLongPress = (comment: PostComment) => {
    if (comment.author?.id !== user?.id || !token) return;
    Alert.alert(t('post_comments.delete_title', 'Delete comment?'), undefined, [
      { text: t('common.cancel', 'Cancel'), style: 'cancel' },
      {
        text: t('post_comments.delete', 'Delete'),
        style: 'destructive',
        onPress: async () => {
          setComments((prev) => removeCommentFromTree(prev, comment.id));
          try {
            await deleteComment(token, comment.id);
          } catch {
            load();
          }
        },
      },
    ]);
  };

  const renderComment = (item: PostComment, isReply: boolean) => (
    <View key={item.id} style={isReply ? styles.replyRow : styles.commentRow}>
      <TouchableOpacity onPress={() => item.author?.id && setProfileUserId(item.author.id)}>
        <UserAvatar name={item.author?.name ?? '?'} photo={item.author?.photo} size={isReply ? 30 : 38} dotColor={null} />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.commentBody}
        onLongPress={() => handleLongPress(item)}
        activeOpacity={0.9}
      >
        <View style={styles.commentTopRow}>
          <TouchableOpacity
            style={styles.commentNameRow}
            onPress={() => item.author?.id && setProfileUserId(item.author.id)}
          >
            <Text style={styles.commentName}>{item.author?.name ?? t('post_comments.unknown', 'Unknown')}</Text>
            <RoleTag role={item.author?.role} />
          </TouchableOpacity>
          <Text style={styles.commentTime}>{timeAgo(item.created_at)}</Text>
        </View>
        <Text style={styles.commentText}>{item.content}</Text>

        <View style={styles.commentFooter}>
          <TouchableOpacity style={styles.footerStat} onPress={() => handleToggleLike(item)} hitSlop={8}>
            <HeartIcon filled={item.is_liked} />
            <Text style={[styles.footerStatText, item.is_liked && { color: HEART_RED }]}>
              {item.likes_count > 0 ? item.likes_count : ''}
            </Text>
          </TouchableOpacity>
          {!isReply && (
            <TouchableOpacity style={styles.footerStat} onPress={() => setReplyTo(item)} hitSlop={8}>
              <CommentBubbleIcon />
              <Text style={styles.footerStatText}>
                {item.replies?.length > 0 ? item.replies.length : ''}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {item.replies?.map((reply) => renderComment(reply, true))}
      </TouchableOpacity>
    </View>
  );

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <BackIcon />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('post_comments.title', 'Comments')}</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={EMERALD} />
        </View>
      ) : (
        <FlatList
          data={comments}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={comments.length === 0 ? { flexGrow: 1 } : { paddingVertical: 10 }}
          renderItem={({ item }) => renderComment(item, false)}
          ListEmptyComponent={
            <View style={styles.centerFill}>
              <Text style={styles.emptyText}>{t('post_comments.empty', 'No comments yet. Say something!')}</Text>
            </View>
          }
        />
      )}

      {replyTo && (
        <View style={styles.replyBanner}>
          <Text style={styles.replyBannerText} numberOfLines={1}>
            {t('post_comments.replying_to', 'Replying to')} {replyTo.author?.name ?? t('post_comments.comment', 'comment')}
          </Text>
          <TouchableOpacity onPress={() => setReplyTo(null)} hitSlop={8}>
            <Text style={styles.replyBannerCancel}>{t('common.cancel', 'Cancel')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder={replyTo ? `${t('post_comments.reply_to', 'Reply to')} ${replyTo.author?.name ?? ''}...` : t('post_comments.write_comment', 'Write a comment...')}
          placeholderTextColor={SUBTLE}
          value={text}
          onChangeText={setText}
          multiline
        />
        <TouchableOpacity onPress={send} disabled={!text.trim() || sending} hitSlop={10} style={styles.sendBtn}>
          {sending ? <ActivityIndicator size="small" color={EMERALD} /> : <SendIcon disabled={!text.trim()} />}
        </TouchableOpacity>
      </View>

      <UserProfileModal
        userId={profileUserId}
        visible={profileUserId !== null}
        onClose={() => setProfileUserId(null)}
        onOpenProfile={setProfileUserId}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.canvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: INK },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  emptyText: { color: SUBTLE, fontSize: 14, textAlign: 'center' },
  commentRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 14, alignItems: 'flex-start' },
  replyRow: { flexDirection: 'row', paddingLeft: 34, paddingTop: 14, alignItems: 'flex-start' },
  commentBody: { flex: 1, marginLeft: 12 },
  commentTopRow: { flexDirection: 'row', alignItems: 'baseline' },
  commentNameRow: { flexDirection: 'row', alignItems: 'center' },
  commentName: { fontSize: 14.5, fontWeight: '700', color: INK },
  commentTime: { fontSize: 12, color: SUBTLE, marginLeft: 8 },
  commentText: { fontSize: 14.5, color: INK, marginTop: 4, lineHeight: 20 },
  commentFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  footerStat: { flexDirection: 'row', alignItems: 'center', marginRight: 26 },
  footerStatText: { fontSize: 13, color: SUBTLE, marginLeft: 7, fontWeight: '600', minWidth: 8 },
  replyBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F5F6F7',
  },
  replyBannerText: { fontSize: 12, color: INK, flex: 1 },
  replyBannerCancel: { fontSize: 12, color: EMERALD, fontWeight: '700', marginLeft: 10 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
  },
  input: {
    flex: 1,
    backgroundColor: '#F5F6F7',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 14,
    color: INK,
    maxHeight: 100,
  },
  sendBtn: { marginLeft: 10, marginBottom: 6 },
});
