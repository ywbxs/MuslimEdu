import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import UserAvatar from '../../components/UserAvatar';
import UserProfileModal from '../../components/UserProfileModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../theme/spatial';
import {
  fetchThreadList,
  searchUsers,
  startThread,
  ChatThread,
  ChatUser,
} from '../../services/chatService';
import { isOppositeGender } from '../../utils/genderGuard';

const EMERALD = '#1FAE64';
const INK = '#1C1C1E';
const SUBTLE = '#8E8E93';
const TRACK_BG = '#F4F5F7';
const HAIRLINE = '#EDEDED';

const LIST_POLL_MS = 8000;

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso.replace(' ', 'T'));
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  const days = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (days < 7) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function ChatListScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { token, user } = useAuth();
  const { t } = useLocale();

  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ChatUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const searchInputRef = useRef<TextInput>(null);
  const [profileUserId, setProfileUserId] = useState<number | null>(null);

  const loadThreads = useCallback(async () => {
    if (!token) return;
    try {
      const data = await fetchThreadList(token);
      setThreads(data);
    } catch {
      // Silent on background polls - the pull-to-refresh spinner is the
      // one place a failure needs to be visible.
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      loadThreads().finally(() => setIsLoading(false));

      pollRef.current = setInterval(loadThreads, LIST_POLL_MS);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }, [loadThreads]),
  );

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadThreads();
    setIsRefreshing(false);
  }, [loadThreads]);

  const onSearchChange = (text: string) => {
    setQuery(text);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);

    if (text.trim() === '') {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchDebounce.current = setTimeout(async () => {
      if (!token) return;
      try {
        const results = await searchUsers(token, text.trim());
        setSearchResults(results);
      } finally {
        setIsSearching(false);
      }
    }, 350);
  };

  const openChat = (params: { threadId?: number; userId: number; name: string; photo: string | null }) => {
    setQuery('');
    setSearchResults([]);
    navigation.navigate('ChatBox', params);
  };

  // Opposite-gender results never even show up as an option to start a new
  // conversation with - existing conversations (the thread list below) are
  // untouched, only new ones are gated. Applies to every role, not just
  // students - see genderGuard.ts.
  const visibleSearchResults = useMemo(
    () => searchResults.filter((candidate) => !isOppositeGender(user?.gender, candidate.gender)),
    [searchResults, user?.gender],
  );

  const onPickUser = async (candidate: ChatUser) => {
    if (!token || isOppositeGender(user?.gender, candidate.gender)) return;
    const threadId = await startThread(token, candidate.user_id);
    openChat({ threadId, userId: candidate.user_id, name: candidate.name, photo: candidate.photo });
  };

  const showingSearch = query.trim() !== '';

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>{t('chat_list.title', 'Messages')}</Text>
        <TouchableOpacity
          style={styles.newMessageBtn}
          onPress={() => searchInputRef.current?.focus()}
          hitSlop={10}
        >
          <Text style={styles.newMessageBtnText}>+ {t('chat_list.new_message', 'New Message')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          ref={searchInputRef}
          style={styles.searchInput}
          placeholder={t('chat_list.search_placeholder', 'Search people to message')}
          placeholderTextColor={SUBTLE}
          value={query}
          onChangeText={onSearchChange}
        />
      </View>

      {showingSearch ? (
        isSearching ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={EMERALD} />
        ) : (
          <FlatList
            data={visibleSearchResults}
            keyExtractor={(item) => String(item.user_id)}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={styles.emptyText}>{t('chat_list.no_matching_users', 'No matching users.')}</Text>}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.row} onPress={() => onPickUser(item)}>
                <TouchableOpacity onPress={() => setProfileUserId(item.user_id)} hitSlop={6}>
                  <UserAvatar name={item.name} photo={item.photo} size={44} ringColor={HAIRLINE} dotColor={null} />
                </TouchableOpacity>
                <View style={styles.rowText}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.preview}>{t('chat_list.tap_to_start', 'Tap to start a conversation')}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )
      ) : isLoading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={EMERALD} />
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(item) => String(item.thread_id)}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={EMERALD} />}
          ListEmptyComponent={
            <Text style={styles.emptyText}>{t('chat_list.no_conversations', 'No conversations yet - search above to message someone.')}</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() =>
                openChat({ threadId: item.thread_id, userId: item.user_id, name: item.name, photo: item.photo })
              }
            >
              <TouchableOpacity onPress={() => setProfileUserId(item.user_id)} hitSlop={6}>
                <UserAvatar name={item.name} photo={item.photo} size={48} ringColor={HAIRLINE} dotColor={null} />
              </TouchableOpacity>
              <View style={styles.rowText}>
                <View style={styles.rowTop}>
                  <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.time}>{timeAgo(item.last_message_at)}</Text>
                </View>
                <View style={styles.rowTop}>
                  <Text
                    style={[styles.preview, item.unread_count > 0 && styles.previewUnread]}
                    numberOfLines={1}
                  >
                    {item.last_message ?? t('chat_list.say_hello', 'Say hello 👋')}
                  </Text>
                  {item.unread_count > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.unread_count > 9 ? '9+' : item.unread_count}</Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      <UserProfileModal
        userId={profileUserId}
        visible={profileUserId !== null}
        onClose={() => setProfileUserId(null)}
        onOpenComments={(post) => {
          setProfileUserId(null);
          navigation.navigate('PostComments', { postId: post.id });
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 28, fontWeight: '700', color: INK },
  newMessageBtn: {
    backgroundColor: '#E5F8F5',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  newMessageBtnText: { color: EMERALD, fontSize: 13, fontWeight: '700' },

  searchWrap: { paddingHorizontal: 20, paddingBottom: 10 },
  searchInput: {
    backgroundColor: TRACK_BG,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
    fontSize: 15,
    color: INK,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
  },
  rowText: { flex: 1, marginLeft: 12 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '600', color: INK, flexShrink: 1 },
  time: { fontSize: 12, color: SUBTLE, marginLeft: 8 },
  preview: { fontSize: 14, color: SUBTLE, flex: 1, marginTop: 2 },
  previewUnread: { color: INK, fontWeight: '600' },

  badge: {
    backgroundColor: EMERALD,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },

  emptyText: { textAlign: 'center', color: SUBTLE, marginTop: 40, paddingHorizontal: 30 },
});
