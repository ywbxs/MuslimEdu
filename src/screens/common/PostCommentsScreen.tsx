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
  Animated,
  PanResponder,
  Pressable,
  Easing,
  useWindowDimensions,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MessagesSquare, Send, Heart, ArrowUpDown } from 'lucide-react-native';
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

function SendIcon({ disabled }: { disabled: boolean }) {
  return <Send size={20} color={disabled ? SUBTLE : EMERALD} strokeWidth={1.8} />;
}
function HeartIcon({ filled, size = 15 }: { filled: boolean; size?: number }) {
  const color = filled ? HEART_RED : SUBTLE;
  return <Heart size={size} color={color} fill={filled ? color : 'none'} strokeWidth={1.9} />;
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

  // Drag-to-dismiss: this is a bottom sheet (not full height - the backdrop
  // above it stays visible), so there's no X button. Dragging the handle
  // down past a threshold, or tapping the backdrop, slides the sheet the
  // rest of the way off-screen locally before actually popping the route -
  // otherwise the navigator's own exit transition (which doesn't know about
  // this drag offset) would visibly jump back to the sheet's un-dragged
  // position for a frame.
  const { height: windowHeight } = useWindowDimensions();
  const translateY = useRef(new Animated.Value(0)).current;
  const dismiss = () => {
    Animated.timing(translateY, {
      toValue: windowHeight,
      duration: 220,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => navigation.goBack());
  };
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 100) dismiss();
        else Animated.spring(translateY, { toValue: 0, friction: 11, tension: 70, useNativeDriver: true }).start();
      },
    }),
  ).current;

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
          {/* Reply is available on replies too, not just top-level comments -
              a thread can nest as deep as people keep replying. renderComment
              already recurses through item.replies regardless of depth, and
              updateCommentTree matches by id wherever it is in the tree, so
              a reply-to-a-reply tucks itself under its real immediate parent
              rather than flattening back to the top-level comment. */}
          <TouchableOpacity
            onPress={() => {
              setReplyTo(item);
              inputRef.current?.focus();
            }}
            hitSlop={8}
          >
            <Text style={styles.replyText}>{t('post_comments.reply', 'Reply')}</Text>
          </TouchableOpacity>
          {item.likes_count > 0 && (
            <View style={styles.reactionBadge}>
              <HeartIcon filled size={10} />
              <Text style={styles.reactionBadgeText}>{item.likes_count}</Text>
            </View>
          )}
          <View style={styles.footerSpacer} />
          <TouchableOpacity onPress={() => handleToggleLike(item)} hitSlop={10}>
            <HeartIcon filled={item.is_liked} size={19} />
          </TouchableOpacity>
        </View>

        {item.replies?.map((reply) => renderComment(reply, true))}
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.root}>
      {/* Tapping the backdrop (the part of the previous screen still
          visible above the sheet - RootNavigator presents this route as
          presentation: 'transparentModal') dismisses the same way dragging
          the handle down does. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />

      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        <KeyboardAvoidingView
          style={styles.flex}
          // 'height' on Android, not undefined - this screen is presented
          // as a native-stack modal, which on Android renders outside the
          // Activity's own window, so windowSoftInputMode="adjustResize"
          // never resizes it the way a normal pushed screen gets resized.
          // Left to `undefined` the keyboard just overlaps the composer
          // instead of pushing it up - RN has to drive the resize itself.
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Drag handle only - no close X. Dragging down (or tapping the
              backdrop above) is how this sheet dismisses. panHandlers are
              scoped to just this small zone, not the whole sheet, so
              scrolling the comment list and tapping the title still work
              normally. */}
          <View {...panResponder.panHandlers} style={styles.dragZone}>
            <View style={styles.dragHandle} />
          </View>
          <Text style={styles.headerTitle}>{t('post_comments.title', 'Comments')}</Text>

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

          <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
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
              <TouchableOpacity onPress={toggleSort} hitSlop={8} style={styles.sortBtn}>
                <SortIcon />
                <Text style={styles.sortBtnText}>
                  {sortOrder === 'newest' ? t('post_comments.sort_newest', 'Newest') : t('post_comments.sort_oldest', 'Oldest')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>

      <UserProfileModal
        userId={profileUserId}
        visible={profileUserId !== null}
        onClose={() => setProfileUserId(null)}
        onOpenProfile={setProfileUserId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Backdrop fills the whole screen; the previous screen (feed) shows
  // through it since RootNavigator presents this route as
  // presentation: 'transparentModal' rather than an opaque 'modal'.
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(17,20,23,0.45)' },
  sheet: {
    height: '85%',
    backgroundColor: COLORS.canvas,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  flex: { flex: 1 },
  dragZone: { alignItems: 'center', paddingTop: 10, paddingBottom: 8 },
  dragHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#DADDE1' },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: INK,
    textAlign: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
  },
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
  replyText: { fontSize: 13, color: SUBTLE, fontWeight: '700' },
  footerSpacer: { flex: 1 },
  reactionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: HAIRLINE,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
  },
  reactionBadgeText: { fontSize: 11.5, color: SUBTLE, fontWeight: '700' },
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
    justifyContent: 'flex-end',
    marginTop: 8,
    paddingHorizontal: 2,
  },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sortBtnText: { fontSize: 12.5, fontWeight: '600', color: SUBTLE },
});
