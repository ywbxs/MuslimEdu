import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import UserAvatar from '../../components/UserAvatar';
import UserProfileModal from '../../components/UserProfileModal';
import { fetchChatMessages, sendMessage, ChatMessage } from '../../services/chatService';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../theme/spatial';
const EMERALD = '#1FAE64';
const INK = '#1C1C1E';
const SUBTLE = '#8E8E93';
const TRACK_BG = '#F4F5F7';
const HAIRLINE = '#EDEDED';

// Polling interval while a chat is open. This is the "start simple" version
// of real-time - swap this for a socket listener later and the rest of the
// screen (bubble list, optimistic send) doesn't need to change.
const CHAT_POLL_MS = 2500;

type RouteParams = {
  threadId?: number;
  userId: number;
  name: string;
  photo: string | null;
};

function formatTime(iso: string): string {
  const date = new Date(iso.replace(' ', 'T'));
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function ChatBoxScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const { threadId: initialThreadId, userId, name, photo } = (route.params as RouteParams) ?? {};
  const { token } = useAuth();
  const { t } = useLocale();

  const [threadId, setThreadId] = useState<number | undefined>(initialThreadId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(!!initialThreadId);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [profileUserId, setProfileUserId] = useState<number | null>(null);

  const listRef = useRef<FlatList>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastIdRef = useRef<number | undefined>(undefined);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  const poll = useCallback(async () => {
    if (!token || !threadId) return;
    try {
      const newOnes = await fetchChatMessages(token, threadId, lastIdRef.current);
      if (newOnes.length > 0) {
        lastIdRef.current = newOnes[newOnes.length - 1].id;
        setMessages((prev) => [...prev, ...newOnes]);
        scrollToEnd();
      }
    } catch {
      // Silent - this runs on a timer, a dropped poll just tries again
    }
  }, [token, threadId, scrollToEnd]);

  useEffect(() => {
    if (!token || !threadId) return;

    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const history = await fetchChatMessages(token, threadId);
        if (cancelled) return;
        setMessages(history);
        lastIdRef.current = history.length ? history[history.length - 1].id : undefined;
        scrollToEnd();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    pollRef.current = setInterval(poll, CHAT_POLL_MS);
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, threadId]);

  const onSend = async () => {
    const text = draft.trim();
    if (!text || !token || isSending) return;

    setIsSending(true);
    setDraft('');

    // Optimistic bubble so sending feels instant
    const tempId = -Date.now();
    setMessages((prev) => [...prev, { id: tempId, message: text, is_mine: true, created_at: new Date().toISOString() }]);
    scrollToEnd();

    try {
      const result = await sendMessage(token, { threadId, userId: threadId ? undefined : userId, message: text });
      if (!threadId) setThreadId(result.thread_id);
      lastIdRef.current = result.chat.id;
      setMessages((prev) => prev.map((m) => (m.id === tempId ? result.chat : m)));
    } catch {
      // Leave the optimistic bubble but mark it failed
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, message: `${text} ${t('chat_box.failed_to_send', '(failed to send)')}` } : m)));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={styles.backText}>{t('common.back', 'Back')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerCenter} onPress={() => setProfileUserId(userId)} activeOpacity={0.8}>
          <UserAvatar name={name} photo={photo} size={32} ringColor={HAIRLINE} dotColor={null} />
          <Text style={styles.headerTitle} numberOfLines={1}>{name}</Text>
        </TouchableOpacity>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={EMERALD} />
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={scrollToEnd}
          renderItem={({ item }) => (
            <View style={[styles.bubbleRow, item.is_mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
              <View style={[styles.bubble, item.is_mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                <Text style={[styles.bubbleText, item.is_mine && styles.bubbleTextMine]}>{item.message}</Text>
              </View>
              <Text style={[styles.bubbleTime, item.is_mine ? styles.bubbleTimeMine : styles.bubbleTimeTheirs]}>
                {formatTime(item.created_at)}
              </Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>{t('chat_box.empty', 'Say hello to start the conversation 👋')}</Text>}
        />
      )}

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder={t('chat_box.placeholder', 'Type a message')}
          placeholderTextColor={SUBTLE}
          value={draft}
          onChangeText={setDraft}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendButton, (!draft.trim() || isSending) && styles.sendButtonDisabled]}
          onPress={onSend}
          disabled={!draft.trim() || isSending}
        >
          <Text style={styles.sendButtonText}>{t('chat_box.send', 'Send')}</Text>
        </TouchableOpacity>
      </View>

      <UserProfileModal
        userId={profileUserId}
        visible={profileUserId !== null}
        onClose={() => setProfileUserId(null)}
        onOpenComments={(post) => {
          setProfileUserId(null);
          (navigation as any).navigate('PostComments', { postId: post.id });
        }}
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
  backText: { color: EMERALD, fontSize: 15, fontWeight: '600' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '600', color: INK, marginLeft: 8, maxWidth: 180 },

  messagesContent: { padding: 16, paddingBottom: 8, flexGrow: 1 },

  bubbleRow: { marginBottom: 10, maxWidth: '78%' },
  bubbleRowMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubbleRowTheirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },

  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: { backgroundColor: EMERALD, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: TRACK_BG, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, color: INK, lineHeight: 20 },
  bubbleTextMine: { color: '#FFFFFF' },

  bubbleTime: { fontSize: 11, color: SUBTLE, marginTop: 3, marginHorizontal: 4 },
  bubbleTimeMine: { textAlign: 'right' },
  bubbleTimeTheirs: { textAlign: 'left' },

  emptyText: { textAlign: 'center', color: SUBTLE, marginTop: 60, paddingHorizontal: 30 },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    backgroundColor: TRACK_BG,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: INK,
    maxHeight: 100,
    marginRight: 10,
  },
  sendButton: {
    backgroundColor: EMERALD,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  sendButtonDisabled: { backgroundColor: '#B9E2C9' },
  sendButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
