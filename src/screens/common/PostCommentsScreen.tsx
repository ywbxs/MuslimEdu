import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { ChevronLeft, MessageSquare, MessagesSquare, Send, Heart, Camera, Smile, Sticker, ArrowUpDown } from 'lucide-react-native';
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
import { isOppositeGender } from '../../utils/genderGuard';

const EMERALD = '#1FAE64';
const INK = '#1C1C1E';
const SUBTLE = '#8E8E93';
const HAIRLINE = '#ECEEF0';
const HEART_RED = '#E0245E';

function BackIcon() {
  return <ChevronLeft size={22} color={INK} strokeWidth={2.1} />;
}
function SendIcon({ disabled }: { disabled: boolean }) {
  return <Send size={20} color={disabled ? SUBTLE : EMERALD} strokeWidth={1.8} />;
}
function HeartIcon({ filled, size = 15 }: { filled: boolean; size?: number }) {
  const color = filled ? HEART_RED : SUBTLE;
  return <Heart size={size} color={color} fill={filled ? color : 'none'} strokeWidth={1.9} />;
}
function CommentBubbleIcon({ size = 15 }: { size?: number }) {
  return <MessageSquare size={size} color={SUBTLE} strokeWidth={1.8} />;
}
function CameraToolIcon() {
  return <Camera size={21} color={SUBTLE} strokeWidth={1.8} />;
}
function GifToolIcon() {
  // No badge glyph in the icon set for "GIF" specifically - a small
  // outlined tag reading "GIF" reads the same way the reference app's does.
  return (
    <View style={styles.gifBadge}>
      <Text style={styles.gifBadgeText}>GIF</Text>
    </View>
  );
}
function SmileToolIcon() {
  return <Smile size={21} color={SUBTLE} strokeWidth={1.8} />;
}
function StickerToolIcon() {
  return <Sticker size={21} color={SUBTLE} strokeWidth={1.8} />;
}
function SortIcon() {
  return <ArrowUpDown size={18} color={SUBTLE} strokeWidth={1.8} />;
}
function EmptyIllustration() {
  return <MessagesSquare size={56} color={INK} strokeWidth={1.6} />;
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

// Gender-segregated comments: a viewer never sees a comment (or reply)
// written by someone of the opposite gender - applies to every role, see
// genderGuard.ts. Filters both levels of the tree independently, so a
// same-gender reply under an opposite-gender top-level comment's thread
// still isn't reachable (its parent is gone), matching "separate what men
// and women can see" rather than just hiding the top row's text.
function filterCommentsByGender(comments: PostComment[], viewerGender?: string | null): PostComment[] {
  return comments
    .filter((c) => !isOppositeGender(viewerGender, c.author?.gender))
    .map((c) => (c.replies?.length ? { ...c, replies: filterCommentsByGender(c.replies, viewerGender) } : c));
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
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const inputRef = useRef<TextInput>(null);

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

  const visibleComments = useMemo(() => {
    const filtered = filterCommentsByGender(comments, user?.gender);
    // Only reorders top-level threads - replies within a thread stay in the
    // order they were posted, same as every comment UI this one is modeled
    // after (reordering replies independently of their parent reads as a
    // shuffled conversation, not a sort).
    const sorted = [...filtered].sort((a, b) => {
      const at = new Date(a.created_at).getTime();
      const bt = new Date(b.created_at).getTime();
      return sortOrder === 'newest' ? bt - at : at - bt;
    });
    return sorted;
  }, [comments, user?.gender, sortOrder]);

  const toggleSort = () => setSortOrder((s) => (s === 'newest' ? 'oldest' : 'newest'));

  // Camera/GIF/sticker attachments aren't backed by anything yet - no image
  // field exists on a comment server-side, no GIF-search integration, no
  // sticker asset set. Honest "not yet" rather than a button that silently
  // does nothing when tapped.
  const notAvailable = () =>
    Alert.alert(
      t('post_comments.not_ready_title', 'Not available yet'),
      t('post_comments.not_ready_desc', 'Photo, GIF, and sticker attachments on comments are coming soon.'),
    );

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
          {/* Reply is available on replies too, not just top-level comments -
              a thread can nest as deep as people keep replying. renderComment
              already recurses through item.replies regardless of depth, and
              updateCommentTree matches by id wherever it is in the tree, so
              a reply-to-a-reply tucks itself under its real immediate parent
              rather than flattening back to the top-level comment. */}
          <TouchableOpacity style={styles.footerStat} onPress={() => setReplyTo(item)} hitSlop={8}>
            <CommentBubbleIcon />
            <Text style={styles.footerStatText}>
              {item.replies?.length > 0 ? item.replies.length : ''}
            </Text>
          </TouchableOpacity>
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
          data={visibleComments}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={visibleComments.length === 0 ? { flexGrow: 1 } : { paddingVertical: 10 }}
          renderItem={({ item }) => renderComment(item, false)}
          ListEmptyComponent={
            <View style={styles.centerFill}>
              <EmptyIllustration />
              <Text style={styles.emptyTitle}>{t('post_comments.empty_title', 'No comments yet')}</Text>
              <Text style={styles.emptyText}>
                {t('post_comments.empty_desc', 'Someone has to go first. Lead the way.')}
              </Text>
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

      <View style={styles.composer}>
        <View style={styles.composerInputRow}>
          <TextInput
            ref={inputRef}
            style={styles.composerInput}
            placeholder={
              replyTo
                ? `${t('post_comments.reply_to', 'Reply to')} ${replyTo.author?.name ?? ''}...`
                : t('post_comments.comment_as', 'Comment as {name}').replace('{name}', user?.name ?? t('post_comments.you', 'you'))
            }
            placeholderTextColor={SUBTLE}
            value={text}
            onChangeText={setText}
            multiline
          />
          {text.trim().length > 0 && (
            <TouchableOpacity onPress={send} disabled={sending} hitSlop={10} style={styles.inlineSendBtn}>
              {sending ? <ActivityIndicator size="small" color={EMERALD} /> : <SendIcon disabled={false} />}
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.composerToolsRow}>
          <View style={styles.composerToolsLeft}>
            <TouchableOpacity style={styles.toolBtn} onPress={notAvailable} hitSlop={8}>
              <CameraToolIcon />
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolBtn} onPress={notAvailable} hitSlop={8}>
              <GifToolIcon />
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolBtn} onPress={() => inputRef.current?.focus()} hitSlop={8}>
              <SmileToolIcon />
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolBtn} onPress={notAvailable} hitSlop={8}>
              <StickerToolIcon />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={toggleSort} hitSlop={8} style={styles.sortBtn}>
            <SortIcon />
            <Text style={styles.sortBtnText}>
              {sortOrder === 'newest' ? t('post_comments.sort_newest', 'Newest') : t('post_comments.sort_oldest', 'Oldest')}
            </Text>
          </TouchableOpacity>
        </View>
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
  emptyTitle: { color: INK, fontSize: 18, fontWeight: '800', marginTop: 16, marginBottom: 6 },
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
  composer: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
  },
  composerInputRow: { flexDirection: 'row', alignItems: 'flex-end' },
  composerInput: {
    flex: 1,
    backgroundColor: '#F5F6F7',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 14,
    color: INK,
    maxHeight: 100,
  },
  inlineSendBtn: { marginLeft: 10, marginBottom: 6 },

  composerToolsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 2,
  },
  composerToolsLeft: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  toolBtn: { alignItems: 'center', justifyContent: 'center' },
  gifBadge: {
    borderWidth: 1.4,
    borderColor: SUBTLE,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  gifBadgeText: { fontSize: 10, fontWeight: '800', color: SUBTLE, letterSpacing: 0.2 },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sortBtnText: { fontSize: 12.5, fontWeight: '600', color: SUBTLE },
});
