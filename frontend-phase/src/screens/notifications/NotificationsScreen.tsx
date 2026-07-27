import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import notificationService, { AppNotification } from '../../services/notificationService';
import { C, relativeTime } from '../nextPhaseTheme';

const CATEGORY_GLYPH: Record<string, string> = {
  announcement: 'A',
  assessment: 'T',
  grade: 'G',
  attendance: 'P',
  lesson_plan: 'L',
  material: 'M',
  enrollment: 'E',
  examination: 'X',
  document: 'D',
  service_request: 'R',
  message: 'C',
  orphan_report: 'O',
  system: 'S',
};

const SEVERITY_TINT: Record<string, string> = {
  info: C.blue,
  success: C.green,
  warning: C.amber,
  critical: C.red,
};

type Props = { navigation: any };

export default function NotificationsScreen({ navigation }: Props) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [unread, setUnread] = useState(0);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (targetPage: number, replace: boolean) => {
      try {
        setError(null);
        const res = await notificationService.list({
          page: targetPage,
          per_page: 25,
          category: activeCategory ?? undefined,
          unread_only: unreadOnly,
        });

        setItems(prev => (replace ? res.notifications : [...prev, ...res.notifications]));
        setUnread(res.unread_count);
        setCategories(res.categories ?? []);
        setPage(res.meta.current_page);
        setLastPage(res.meta.last_page);
      } catch (e: any) {
        setError(e?.message ?? 'Could not load notifications.');
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [activeCategory, unreadOnly],
  );

  useEffect(() => {
    setLoading(true);
    load(1, true);
  }, [load]);

  useEffect(() => {
    const unsubscribe = navigation.addListener?.('focus', () => load(1, true));
    return unsubscribe;
  }, [navigation, load]);

  const onRefresh = () => {
    setRefreshing(true);
    load(1, true);
  };

  const onEndReached = () => {
    if (loadingMore || loading || page >= lastPage) return;
    setLoadingMore(true);
    load(page + 1, false);
  };

  const openItem = async (item: AppNotification) => {
    if (!item.is_read) {
      setItems(prev => prev.map(n => (n.id === item.id ? { ...n, is_read: true } : n)));
      setUnread(n => Math.max(0, n - 1));
      notificationService.markRead([item.id]).catch(() => undefined);
    }

    if (!item.route_name) return;

    try {
      navigation.navigate(item.route_name, item.route_params ?? {});
    } catch {
      // A notification can outlive the screen it points at. Never crash the
      // inbox because a route name has since been renamed.
      Alert.alert('Cannot open', 'That screen is not available in this build.');
    }
  };

  const markAll = async () => {
    try {
      await notificationService.markAllRead(activeCategory ?? undefined);
      setItems(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnread(0);
    } catch (e: any) {
      Alert.alert('Could not update', e?.message ?? 'Please try again.');
    }
  };

  const remove = (item: AppNotification) => {
    Alert.alert('Remove notification', item.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const snapshot = items;
          setItems(prev => prev.filter(n => n.id !== item.id));
          try {
            await notificationService.remove(item.id);
          } catch (e: any) {
            setItems(snapshot);
            Alert.alert('Could not remove', e?.message ?? 'Please try again.');
          }
        },
      },
    ]);
  };

  const header = useMemo(
    () => (
      <View>
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Notifications</Text>
            <Text style={s.sub}>
              {unread > 0 ? unread + ' unread' : 'You are all caught up'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('NotificationPreferences')}>
            <Text style={s.link}>Settings</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          <Chip label='All' active={activeCategory === null} onPress={() => setActiveCategory(null)} />
          <Chip
            label='Unread'
            active={unreadOnly}
            onPress={() => setUnreadOnly(v => !v)}
          />
          {categories.map(cat => (
            <Chip
              key={cat}
              label={cat.replace(/_/g, ' ')}
              active={activeCategory === cat}
              onPress={() => setActiveCategory(activeCategory === cat ? null : cat)}
            />
          ))}
        </ScrollView>

        {unread > 0 ? (
          <TouchableOpacity style={s.markAll} onPress={markAll}>
            <Text style={s.markAllText}>Mark all as read</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    ),
    [unread, categories, activeCategory, unreadOnly, navigation],
  );

  if (loading) {
    return (
      <SafeAreaView style={s.center}>
        <ActivityIndicator color={C.green} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen}>
      <FlatList
        data={items}
        keyExtractor={item => String(item.id)}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.green} />}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        contentContainerStyle={items.length === 0 ? { flexGrow: 1 } : { paddingBottom: 28 }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyTitle}>{error ? 'Something went wrong' : 'Nothing here yet'}</Text>
            <Text style={s.emptyBody}>
              {error ?? 'Announcements, grades and request updates will show up here.'}
            </Text>
            {error ? (
              <TouchableOpacity style={s.retry} onPress={() => load(1, true)}>
                <Text style={s.retryText}>Try again</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 16 }} color={C.green} /> : null}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[s.item, !item.is_read && s.itemUnread]}
            onPress={() => openItem(item)}
            onLongPress={() => remove(item)}
          >
            <View style={[s.glyph, { backgroundColor: (SEVERITY_TINT[item.severity] ?? C.blue) + '1A' }]}>
              <Text style={[s.glyphText, { color: SEVERITY_TINT[item.severity] ?? C.blue }]}>
                {CATEGORY_GLYPH[item.category] ?? 'N'}
              </Text>
            </View>

            <View style={{ flex: 1 }}>
              <View style={s.itemTop}>
                <Text style={[s.itemTitle, !item.is_read && s.itemTitleUnread]} numberOfLines={2}>
                  {item.title}
                </Text>
                {!item.is_read ? <View style={s.dot} /> : null}
              </View>
              {item.body ? (
                <Text style={s.itemBody} numberOfLines={3}>
                  {item.body}
                </Text>
              ) : null}
              <Text style={s.meta}>
                {item.category.replace(/_/g, ' ')} · {relativeTime(item.created_at)}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[s.chip, active && s.chipActive]} onPress={onPress}>
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 18, paddingTop: 16 },
  title: { fontSize: 25, fontWeight: '700', color: C.ink },
  sub: { color: C.muted, marginTop: 3 },
  link: { color: C.green, fontWeight: '700', paddingVertical: 6 },
  chips: { paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.card,
    marginRight: 8,
  },
  chipActive: { backgroundColor: C.greenSoft, borderColor: C.green },
  chipText: { color: C.muted, fontSize: 13, textTransform: 'capitalize' },
  chipTextActive: { color: C.green, fontWeight: '700' },
  markAll: { alignSelf: 'flex-start', marginLeft: 18, marginBottom: 10 },
  markAllText: { color: C.green, fontWeight: '600', fontSize: 13 },
  item: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: C.card,
    marginHorizontal: 14,
    marginBottom: 9,
    padding: 13,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: C.line,
  },
  itemUnread: { borderColor: C.green, backgroundColor: '#FBFEFC' },
  glyph: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  glyphText: { fontWeight: '800', fontSize: 15 },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemTitle: { flex: 1, color: C.ink, fontWeight: '600', fontSize: 15 },
  itemTitleUnread: { fontWeight: '800' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.green },
  itemBody: { color: C.muted, marginTop: 4, lineHeight: 19 },
  meta: { fontSize: 12, color: C.muted, marginTop: 6, textTransform: 'capitalize' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: C.ink },
  emptyBody: { color: C.muted, textAlign: 'center', marginTop: 7, lineHeight: 20 },
  retry: { marginTop: 16, backgroundColor: C.green, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  retryText: { color: '#FFFFFF', fontWeight: '700' },
});
