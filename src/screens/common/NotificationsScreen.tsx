import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BellDot } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useNotifications } from '../../context/NotificationContext';
import { AppNotification } from '../../services/notificationService';
import { COLORS, RADIUS, SHADOW } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';

const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const EMERALD = COLORS.emerald;

function BellDotIcon({ type }: { type: AppNotification['type'] }) {
  const color =
    type === 'approval' ? COLORS.danger : type === 'message' ? EMERALD : type === 'announcement' ? '#8B5CF6' : EMERALD;
  return <BellDot size={20} color={color} strokeWidth={1.8} />;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function NotificationRow({ item, onPress }: { item: AppNotification; onPress: (item: AppNotification) => void }) {
  return (
    <TouchableOpacity style={[styles.row, !item.read && styles.rowUnread]} activeOpacity={0.7} onPress={() => onPress(item)}>
      <View style={styles.iconWrap}>
        <BellDotIcon type={item.type} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1}>
          {item.title || 'Notification'}
        </Text>
        {!!item.body && (
          <Text style={styles.body} numberOfLines={2}>
            {item.body}
          </Text>
        )}
      </View>
      <View style={styles.rightCol}>
        <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
        {!item.read && <View style={styles.unreadDot} />}
      </View>
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { notifications, unreadCount, loading, refresh, markRead, markAllRead } = useNotifications();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const onPressItem = useCallback(
    (item: AppNotification) => {
      if (!item.read) markRead(item.id);
    },
    [markRead],
  );

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead}>
            <Text style={styles.markAll}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <NotificationRow item={item} onPress={onPressItem} />}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingHorizontal: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={EMERALD} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No notifications yet</Text>
              <Text style={styles.emptySub}>New posts, comments, and updates will show up here.</Text>
            </View>
          ) : null
        }
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
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: INK },
  markAll: { fontSize: 13, fontWeight: '700', color: EMERALD },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginBottom: 10,
    ...SHADOW.level1,
  },
  rowUnread: { borderWidth: 1, borderColor: 'rgba(16,131,74,0.25)' },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(16,131,74,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 14.5, fontWeight: '700', color: INK },
  body: { fontSize: 13, color: SUBTLE, marginTop: 2 },
  rightCol: { alignItems: 'flex-end', gap: 6 },
  time: { fontSize: 11, color: SUBTLE },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: EMERALD },
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyText: { fontSize: 16, fontWeight: '700', color: INK, marginBottom: 6 },
  emptySub: { fontSize: 13, color: SUBTLE, textAlign: 'center' },
});
