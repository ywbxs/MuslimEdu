import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from './AuthContext';
import {
  AppNotification,
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  registerDeviceForPush,
  unregisterDeviceFromPush,
} from '../services/notificationService';
import {
  getFcmToken,
  onForegroundMessage,
  requestNotificationPermission,
} from '../services/firebaseMessaging';

// Backend push delivery can be dropped by the OS or arrive while this
// screen isn't mounted to react to it - this poll is the fallback that
// keeps the badge honest even when the FCM message itself never shows up
// (same "don't trust the realtime channel alone" posture as offlineQueue.ts).
const BADGE_POLL_MS = 60000;

interface NotificationContextValue {
  unreadCount: number;
  notifications: AppNotification[];
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue>({
  unreadCount: 0,
  notifications: [],
  loading: false,
  refresh: async () => {},
  markRead: async () => {},
  markAllRead: async () => {},
});

export function useNotifications() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const fcmTokenRef = useRef<string | null>(null);
  // Captures {token, fcmToken} while signed in so the unregister-on-logout
  // effect below has a still-valid auth token to call the backend with even
  // after AuthContext has already nulled out the live `token` value.
  const lastAuthedDeviceRef = useRef<{ authToken: string; fcmToken: string } | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const result = await fetchNotifications(token);
      setNotifications(result.notifications);
      setUnreadCount(result.unreadCount);
    } catch {
      // Keep whatever was already loaded - fetchNotifications already
      // falls back to cache internally, this catches the "nothing cached
      // either" case.
    } finally {
      setLoading(false);
    }
  }, [token]);

  const markRead = useCallback(
    async (id: number) => {
      if (!token) return;
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      try {
        const count = await markNotificationRead(token, id);
        setUnreadCount(count);
      } catch {
        // Best-effort - a stale badge count self-corrects on the next refresh.
      }
    },
    [token],
  );

  const markAllRead = useCallback(async () => {
    if (!token) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      const count = await markAllNotificationsRead(token);
      setUnreadCount(count);
    } catch {
      // Best-effort, same as markRead.
    }
  }, [token]);

  // Reset to a signed-out state and unregister the device the moment there's
  // no token, so a shared device doesn't keep showing the previous account's
  // badge/notifications after logout.
  useEffect(() => {
    if (!token) {
      setUnreadCount(0);
      setNotifications([]);
      if (lastAuthedDeviceRef.current) {
        const { authToken, fcmToken } = lastAuthedDeviceRef.current;
        lastAuthedDeviceRef.current = null;
        fcmTokenRef.current = null;
        unregisterDeviceFromPush(authToken, fcmToken).catch(() => {});
      }
      return;
    }

    let cancelled = false;
    (async () => {
      const granted = await requestNotificationPermission();
      if (!granted || cancelled) return;
      const fcmToken = await getFcmToken();
      if (!fcmToken || cancelled) return;
      fcmTokenRef.current = fcmToken;
      lastAuthedDeviceRef.current = { authToken: token, fcmToken };
      try {
        await registerDeviceForPush(token, fcmToken);
      } catch {
        // Backend route may not exist yet - device just won't receive
        // pushes until it does; nothing else in the app depends on this.
      }
    })();

    refresh();

    return () => {
      cancelled = true;
    };
  }, [token, refresh]);

  // Real-time path: a push arriving in the foreground bumps the badge and
  // prepends a local notification immediately, no round trip needed.
  useEffect(() => {
    if (!token) return () => {};
    const unsubscribe = onForegroundMessage((title, body, data) => {
      setUnreadCount((c) => c + 1);
      setNotifications((prev) => [
        {
          id: Date.now(),
          type: (data.type as AppNotification['type']) ?? 'other',
          title,
          body,
          data,
          read: false,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
    });
    return unsubscribe;
  }, [token]);

  // Fallback path: periodic badge-only poll, plus a refresh whenever the
  // app comes back to the foreground (covers pushes dropped while backgrounded).
  useEffect(() => {
    if (!token) return () => {};
    const interval = setInterval(async () => {
      const count = await fetchUnreadCount(token);
      setUnreadCount(count);
    }, BADGE_POLL_MS);

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });

    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [token, refresh]);

  return (
    <NotificationContext.Provider value={{ unreadCount, notifications, loading, refresh, markRead, markAllRead }}>
      {children}
    </NotificationContext.Provider>
  );
}
