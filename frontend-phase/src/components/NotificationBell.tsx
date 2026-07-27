import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import notificationService from '../services/notificationService';

/**
 * Header bell with an unread badge.
 *
 * Drop into a screen's headerRight:
 *
 *   options={{ headerRight: () => <NotificationBell navigation={navigation} /> }}
 *
 * Polls on mount, on app foreground and every 60s. No websocket dependency:
 * the app has a Broadcast channel registered but no client-side Echo setup,
 * so polling is the honest option until that exists.
 */
type Props = { navigation: any; pollMs?: number };

export default function NotificationBell({ navigation, pollMs = 60000 }: Props) {
  const [count, setCount] = useState(0);
  const timer = useRef<any>(null);

  const refresh = useCallback(() => {
    notificationService
      .unreadCount()
      .then(res => setCount(res.unread_count ?? 0))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refresh();
    timer.current = setInterval(refresh, pollMs);

    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
    });

    const unsubscribe = navigation?.addListener?.('focus', refresh);

    return () => {
      if (timer.current) clearInterval(timer.current);
      sub.remove();
      unsubscribe?.();
    };
  }, [refresh, pollMs, navigation]);

  return (
    <TouchableOpacity
      style={s.wrap}
      onPress={() => navigation.navigate('Notifications')}
      accessibilityLabel={count > 0 ? count + ' unread notifications' : 'Notifications'}
    >
      <Text style={s.glyph}>N</Text>
      {count > 0 ? (
        <View style={s.badge}>
          <Text style={s.badgeText}>{count > 99 ? '99+' : String(count)}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  wrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E6F4EE',
    marginRight: 12,
  },
  glyph: { color: '#12805C', fontWeight: '800', fontSize: 15 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 19,
    height: 19,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: '#C0392B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
});
