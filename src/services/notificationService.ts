import { API_BASE_URL } from '../config/api';
import { cacheKeyFor, cacheThenNetwork } from '../utils/offlineCache';

/**
 * Real-time in-app notifications (new posts, comments, likes, approvals,
 * etc) delivered over Firebase Cloud Messaging, backed by a notification
 * inbox the backend persists so the bell/badge is correct even for
 * notifications that arrived while the app was closed or offline.
 *
 * Backend contract (routes do not exist yet - ship frontend, document
 * contract, same convention as widgetAnnouncementService.ts):
 *   POST /notifications_register_device   (any auth role, { fcm_token, platform }) -> {}
 *     - upserts by fcm_token so re-registering on every login is safe/idempotent
 *   POST /notifications_unregister_device (any auth role, { fcm_token }) -> {}
 *     - called on logout so a shared/reset device stops receiving another
 *       account's pushes
 *   POST /notifications_list              (any auth role, { cursor? }) -> { notifications: AppNotification[], unread_count: number, next_cursor: string|null }
 *   POST /notifications_mark_read         (any auth role, { id }) -> { unread_count: number }
 *   POST /notifications_mark_all_read     (any auth role, {}) -> { unread_count: number }
 *   POST /notifications_unread_count      (any auth role, {}) -> { unread_count: number }
 *     - lightweight poll used as a fallback badge refresh (e.g. after a
 *       foreground FCM message, or on a periodic timer) since a push can be
 *       dropped by the OS without the app ever finding out
 *
 * The backend is expected to be the one actually calling Firebase's Admin
 * SDK (HTTP v1 API) to send the push to every registered device for the
 * target user(s) whenever a notification-worthy event happens (new post,
 * comment reply, like, registration approved, etc) - the credentials it
 * uses for that are configured in-app via Superadmin -> Firebase
 * Configuration, see firebaseConfigService.ts.
 */
const CACHE_PREFIX = '@notifications_cache_v1';
const DEFAULT_TIMEOUT_MS = 15000;

export type NotificationType =
  | 'post'
  | 'comment'
  | 'like'
  | 'message'
  | 'approval'
  | 'announcement'
  | 'other';

export interface AppNotification {
  id: number;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
  read: boolean;
  created_at: string;
}

async function authedPost(path: string, token: string, body: Record<string, any> = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timed out. Check your connection and try again.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message ?? `Request failed (${response.status})`);
  }
  return data;
}

export async function registerDeviceForPush(token: string, fcmToken: string): Promise<void> {
  await authedPost('/notifications_register_device', token, {
    fcm_token: fcmToken,
    platform: 'android',
  });
}

export async function unregisterDeviceFromPush(token: string, fcmToken: string): Promise<void> {
  await authedPost('/notifications_unregister_device', token, { fcm_token: fcmToken });
}

export async function fetchNotifications(
  token: string,
  cursor?: string,
): Promise<{ notifications: AppNotification[]; unreadCount: number; nextCursor: string | null }> {
  const key = cacheKeyFor(`${CACHE_PREFIX}:list`, token);
  const data = await cacheThenNetwork(key, () => authedPost('/notifications_list', token, cursor ? { cursor } : {}));
  return {
    notifications: Array.isArray(data.notifications) ? data.notifications : [],
    unreadCount: typeof data.unread_count === 'number' ? data.unread_count : 0,
    nextCursor: data.next_cursor ?? null,
  };
}

export async function fetchUnreadCount(token: string): Promise<number> {
  try {
    const data = await authedPost('/notifications_unread_count', token);
    return typeof data.unread_count === 'number' ? data.unread_count : 0;
  } catch {
    return 0;
  }
}

export async function markNotificationRead(token: string, id: number): Promise<number> {
  const data = await authedPost('/notifications_mark_read', token, { id });
  return typeof data.unread_count === 'number' ? data.unread_count : 0;
}

export async function markAllNotificationsRead(token: string): Promise<number> {
  const data = await authedPost('/notifications_mark_all_read', token);
  return typeof data.unread_count === 'number' ? data.unread_count : 0;
}
