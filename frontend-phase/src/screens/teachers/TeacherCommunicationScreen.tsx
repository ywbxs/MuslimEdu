import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import teacherPortalService, { CommunicationOverview } from '../../services/teacherPortalService';
import { C, relativeTime } from '../nextPhaseTheme';

type Props = { navigation: any };

/**
 * One inbox instead of three screens. Everything here is read-only and comes
 * from data that already exists (chats, announcements, notifications); the
 * actions all hand off to the screens that already own those workflows.
 */
export default function TeacherCommunicationScreen({ navigation }: Props) {
  const [data, setData] = useState<CommunicationOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setData(await teacherPortalService.communication());
    } catch (e: any) {
      setError(e?.message ?? 'Could not load your communication hub.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => navigation.addListener?.('focus', load), [navigation, load]);

  if (loading) {
    return (
      <SafeAreaView style={s.center}>
        <ActivityIndicator color={C.green} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={C.green}
          />
        }
      >
        <Text style={s.title}>Communication</Text>
        <Text style={s.sub}>Messages, announcements and alerts in one place.</Text>

        {error ? <Text style={s.banner}>{error}</Text> : null}

        <View style={s.stats}>
          <Stat label='Unread messages' value={data?.summary.unread_messages ?? 0} tint={C.blue} />
          <Stat label='My announcements' value={data?.summary.my_announcements ?? 0} />
          <Stat label='Alerts' value={data?.summary.unread_notifications ?? 0} tint={C.amber} />
        </View>

        <View style={s.actions}>
          <Action label='Open chat' onPress={() => navigation.navigate('ChatList')} />
          <Action label='Announcements' onPress={() => navigation.navigate('TeacherAnnouncements')} />
          <Action label='Notifications' onPress={() => navigation.navigate('Notifications')} />
        </View>

        <Text style={s.section}>Recent messages</Text>
        {(data?.recent_messages ?? []).length === 0 ? (
          <Text style={s.emptyLine}>No messages yet.</Text>
        ) : (
          (data?.recent_messages ?? []).map(msg => (
            <TouchableOpacity
              key={msg.id}
              style={s.item}
              onPress={() => navigation.navigate('ChatBox', { threadId: msg.message_thrade })}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.itemTitle} numberOfLines={2}>
                  {msg.message}
                </Text>
                <Text style={s.meta}>{relativeTime(msg.created_at)}</Text>
              </View>
              {Number(msg.read_status) === 0 ? <View style={s.dot} /> : null}
            </TouchableOpacity>
          ))
        )}

        <Text style={s.section}>My recent announcements</Text>
        {(data?.recent_announcements ?? []).length === 0 ? (
          <Text style={s.emptyLine}>You have not posted an announcement yet.</Text>
        ) : (
          (data?.recent_announcements ?? []).map((a: any, index: number) => (
            <View key={String(a.id ?? index)} style={s.item}>
              <View style={{ flex: 1 }}>
                <Text style={s.itemTitle} numberOfLines={2}>
                  {a.title ?? a.subject ?? 'Announcement'}
                </Text>
                <Text style={s.meta}>{relativeTime(a.created_at ?? null)}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, tint }: { label: string; value: number; tint?: string }) {
  return (
    <View style={s.stat}>
      <Text style={[s.statValue, tint ? { color: tint } : null]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function Action({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.action} onPress={onPress}>
      <Text style={s.actionText}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  title: { fontSize: 25, fontWeight: '700', color: C.ink, marginHorizontal: 18, marginTop: 16 },
  sub: { color: C.muted, marginHorizontal: 18, marginTop: 4 },
  banner: {
    backgroundColor: C.amberSoft,
    color: C.amber,
    marginHorizontal: 14,
    marginTop: 12,
    padding: 11,
    borderRadius: 10,
    fontSize: 13,
  },
  stats: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, marginTop: 14 },
  stat: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    paddingVertical: 13,
    alignItems: 'center',
  },
  statValue: { fontSize: 20, fontWeight: '800', color: C.ink },
  statLabel: { fontSize: 10.5, color: C.muted, marginTop: 3, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, marginTop: 12 },
  action: {
    flex: 1,
    backgroundColor: C.greenSoft,
    borderRadius: 11,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionText: { color: C.green, fontWeight: '700', fontSize: 13 },
  section: { color: C.muted, fontWeight: '800', fontSize: 12, marginHorizontal: 18, marginTop: 24, letterSpacing: 0.5 },
  emptyLine: { color: C.muted, marginHorizontal: 18, marginTop: 10, fontSize: 13.5 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.card,
    marginHorizontal: 14,
    marginTop: 9,
    padding: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
  },
  itemTitle: { color: C.ink, fontWeight: '600', fontSize: 14.5 },
  meta: { fontSize: 12, color: C.muted, marginTop: 5 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.green },
});
