import { API_BASE_URL, absoluteUrl } from '../config/api';
import { cacheKeyFor, cacheThenNetwork } from '../utils/offlineCache';

const CACHE_PREFIX = '@announcement_cache_v1';

// --- Shared fetch helpers (same pattern as teacherGradebookService.ts) ---

function firstErrorMessage(data: any): string | null {
  if (!data) return null;
  if (typeof data.message === 'string') return data.message;
  if (typeof data.error === 'string') return data.error;
  if (data.errors && typeof data.errors === 'object') {
    const first = Object.values(data.errors)[0];
    if (Array.isArray(first) && typeof first[0] === 'string') return first[0];
  }
  return null;
}

async function authedPost(path: string, token: string, body: Record<string, any> = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(firstErrorMessage(data) ?? `Request failed (${response.status})`);
  }

  return data;
}

// Multipart variant, used only when an attachment is attached.
async function authedPostForm(path: string, token: string, form: FormData) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      // Content-Type intentionally omitted — RN sets the multipart
      // boundary itself when the body is a FormData instance.
    },
    body: form,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(firstErrorMessage(data) ?? `Request failed (${response.status})`);
  }

  return data;
}

// --- Types ---

export interface AnnouncementTarget {
  section_id: number;
  section_name: string;
  subject_id: number | null;
  subject_name: string | null;
  scope: 'class_teacher' | 'subject_teacher';
}

export interface Announcement {
  id: number;
  title: string;
  body: string;
  is_pinned: boolean;
  section_id: number;
  section_name: string | null;
  subject_id: number | null;
  subject_name: string | null;
  teacher_id: number;
  teacher_name: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  scheduled_at: string | null;
  posted_at: string;
}

export interface NewAnnouncementInput {
  section_id: number;
  subject_id?: number | null;
  title: string;
  body: string;
  is_pinned?: boolean;
  scheduled_at?: string | null;
  // RN file object: { uri, name, type } — omit for no attachment.
  attachment?: { uri: string; name: string; type: string } | null;
}

function mapAnnouncement(a: any): Announcement {
  return {
    ...a,
    attachment_url: absoluteUrl(a.attachment_url ?? null),
  };
}

// --- Teacher ---

export async function fetchAnnouncementTargets(token: string): Promise<AnnouncementTarget[]> {
  const data = await authedPost('/teacher_announcement_targets', token);
  return data.targets ?? [];
}

export async function fetchTeacherAnnouncements(token: string): Promise<Announcement[]> {
  return cacheThenNetwork(cacheKeyFor(CACHE_PREFIX, token, 'teacher'), async () => {
    const data = await authedPost('/teacher_announcement_list', token);
    return (data.announcements ?? []).map(mapAnnouncement);
  });
}

export async function createAnnouncement(
  token: string,
  input: NewAnnouncementInput
): Promise<Announcement> {
  let data: any;

  if (input.attachment) {
    const form = new FormData();
    form.append('section_id', String(input.section_id));
    if (input.subject_id) form.append('subject_id', String(input.subject_id));
    form.append('title', input.title);
    form.append('body', input.body);
    form.append('is_pinned', input.is_pinned ? '1' : '0');
    if (input.scheduled_at) form.append('scheduled_at', input.scheduled_at);
    form.append('attachment', input.attachment as any);
    data = await authedPostForm('/teacher_announcement_store', token, form);
  } else {
    data = await authedPost('/teacher_announcement_store', token, {
      section_id: input.section_id,
      subject_id: input.subject_id ?? undefined,
      title: input.title,
      body: input.body,
      is_pinned: input.is_pinned ?? false,
      scheduled_at: input.scheduled_at ?? undefined,
    });
  }

  return mapAnnouncement(data.announcement);
}

export async function deleteAnnouncement(token: string, announcementId: number): Promise<void> {
  await authedPost('/teacher_announcement_delete', token, { announcement_id: announcementId });
}

// --- Student ---

export async function fetchStudentAnnouncements(token: string): Promise<Announcement[]> {
  return cacheThenNetwork(cacheKeyFor(CACHE_PREFIX, token, 'student'), async () => {
    const data = await authedPost('/student_announcement_list', token);
    return (data.announcements ?? []).map(mapAnnouncement);
  });
}

// --- Admin ---

export async function fetchAdminAnnouncementReview(
  token: string,
  sectionId?: number | null
): Promise<Announcement[]> {
  return cacheThenNetwork(cacheKeyFor(CACHE_PREFIX, token, 'adminReview', sectionId ?? 'all'), async () => {
    const data = await authedPost('/admin_announcement_review', token, {
      section_id: sectionId ?? undefined,
    });
    return (data.announcements ?? []).map(mapAnnouncement);
  });
}
