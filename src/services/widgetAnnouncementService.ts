import { API_BASE_URL, absoluteUrl } from '../config/api';
import { cacheKeyFor, cacheThenNetwork } from '../utils/offlineCache';
import { PickedImage } from './postService';

/**
 * Superadmin-uploaded, image-only cards that appear in the feed's widget
 * carousel for EVERY role (global, not school-scoped like normal posts) -
 * a genuinely new backend surface, so this documents the exact contract
 * the backend needs to implement, following this repo's established
 * "ship the frontend, document the contract, backend catches up"
 * convention (see examinationService.ts / studentDocumentUploadService.ts
 * for the same pattern).
 *
 * Backend contract (routes do not exist yet):
 *   POST /superadmin_widget_announcement_list    (superadmin) -> { announcements: WidgetAnnouncement[] }  (active + inactive)
 *   POST /superadmin_widget_announcement_create   (superadmin, multipart `image`) -> { announcement }
 *   POST /superadmin_widget_announcement_delete   (superadmin, { id }) -> {}
 *   POST /superadmin_widget_announcement_set_active (superadmin, { id, active }) -> { announcement }
 *   POST /widget_announcements_list               (any authenticated role, {}) -> { announcements: WidgetAnnouncement[] }
 *     - server filters to active:true only, newest-first
 *
 * No auto-expiry, no cap on simultaneously-active cards - manual
 * active/inactive toggle is the only lifecycle control for v1.
 */
const CACHE_PREFIX = '@widget_announcements_cache_v1';
const DEFAULT_TIMEOUT_MS = 15000;
const UPLOAD_TIMEOUT_MS = 45000;

export interface WidgetAnnouncement {
  id: number;
  image_url: string;
  active: boolean;
  created_at: string;
}

async function authedPost(path: string, token: string, body: FormData | Record<string, any> = {}) {
  const isFormData = body instanceof FormData;
  const controller = new AbortController();
  const timeoutMs = isFormData ? UPLOAD_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        Authorization: `Bearer ${token}`,
      },
      body: isFormData ? body : JSON.stringify(body),
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

function normalizeAnnouncement(raw: any): WidgetAnnouncement {
  return {
    id: raw.id,
    image_url: absoluteUrl(raw.image_url) ?? '',
    active: !!raw.active,
    created_at: raw.created_at,
  };
}

// --- Any-role read (what the feed's WidgetCarousel calls) ---

export async function fetchActiveWidgetAnnouncements(token: string): Promise<WidgetAnnouncement[]> {
  return cacheThenNetwork(cacheKeyFor(CACHE_PREFIX, token, 'active'), async () => {
    const data = await authedPost('/widget_announcements_list', token, {});
    return (data.announcements ?? []).map(normalizeAnnouncement);
  });
}

// --- Superadmin-only management ---

export async function fetchWidgetAnnouncements(token: string): Promise<WidgetAnnouncement[]> {
  const data = await authedPost('/superadmin_widget_announcement_list', token, {});
  return (data.announcements ?? []).map(normalizeAnnouncement);
}

export async function createWidgetAnnouncement(token: string, image: PickedImage): Promise<WidgetAnnouncement> {
  const form = new FormData();
  // @ts-ignore - React Native's FormData accepts this shape for file uploads
  form.append('image', {
    uri: image.uri,
    name: image.fileName ?? 'announcement.jpg',
    type: image.type ?? 'image/jpeg',
  });
  const data = await authedPost('/superadmin_widget_announcement_create', token, form);
  return normalizeAnnouncement(data.announcement);
}

export async function deleteWidgetAnnouncement(token: string, id: number): Promise<void> {
  await authedPost('/superadmin_widget_announcement_delete', token, { id });
}

export async function setWidgetAnnouncementActive(token: string, id: number, active: boolean): Promise<WidgetAnnouncement> {
  const data = await authedPost('/superadmin_widget_announcement_set_active', token, { id, active });
  return normalizeAnnouncement(data.announcement);
}
