import { post } from './nextPhaseClient';

export type NotificationCategory =
  | 'announcement' | 'assessment' | 'grade' | 'attendance' | 'lesson_plan'
  | 'material' | 'enrollment' | 'examination' | 'document' | 'service_request'
  | 'message' | 'orphan_report' | 'system';

export type AppNotification = {
  id: number;
  category: NotificationCategory;
  title: string;
  title_ar: string | null;
  body: string | null;
  severity: 'info' | 'success' | 'warning' | 'critical';
  route_name: string | null;
  route_params: Record<string, unknown>;
  subject_type: string | null;
  subject_id: number | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string | null;
};

export type NotificationPage = {
  notifications: AppNotification[];
  meta: { current_page: number; last_page: number; total: number; per_page: number };
  unread_count: number;
  categories: NotificationCategory[];
};

export type NotificationPreference = {
  category: NotificationCategory;
  in_app: boolean;
  push: boolean;
  email: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
};

export default {
  list: (params: { page?: number; per_page?: number; category?: string; unread_only?: boolean } = {}) =>
    post<NotificationPage>('notification_list', params),

  unreadCount: () =>
    post<{ unread_count: number; by_category: Record<string, number> }>('notification_unread_count'),

  markRead: (ids: number[]) =>
    post<{ updated: number; unread_count: number }>('notification_mark_read', { notification_ids: ids }),

  markAllRead: (category?: string) =>
    post<{ updated: number }>('notification_mark_all_read', category ? { category } : {}),

  remove: (id: number) => post<{ message: string }>('notification_delete', { notification_id: id }),

  preferences: () =>
    post<{ preferences: NotificationPreference[]; categories: NotificationCategory[] }>('notification_preferences'),

  savePreferences: (preferences: NotificationPreference[]) =>
    post<{ message: string }>('notification_preferences_save', { preferences }),

  registerDevice: (token: string, platform: 'android' | 'ios' | 'web' = 'android', app_version?: string) =>
    post<{ message: string }>('notification_device_register', { token, platform, app_version }),

  unregisterDevice: (token: string) =>
    post<{ message: string }>('notification_device_unregister', { token }),
};
