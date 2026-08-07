import { API_BASE_URL, absoluteUrl } from '../config/api';
import { cacheKeyFor, cacheThenNetwork } from '../utils/offlineCache';

/**
 * Self-service document upload for orphan-school children - a child uploads
 * their OWN personal documents (national ID, guardian consent, medical
 * records, a sponsorship form, etc.) to their own file. This is the reverse
 * of studentPortalService.ts's document flow (fetchStudentDocuments /
 * requestStudentDocument), which is a student REQUESTING an official
 * document FROM the school (report card, COR, certificate) - something an
 * orphan school has none of, since it has no class-based academics to issue
 * them from (see isOrphanSchoolUser/ACADEMIC_ROUTES in utils/orphanSchool.ts,
 * which already hides the admin review screens for that request flow on an
 * orphan school). This file is the other direction entirely.
 *
 * NOT YET BACKED - matches this codebase's existing convention (see
 * examinationService.ts / teacherStudentProgressService.ts's own "never
 * executed against a live server" notes) of shipping the frontend ahead of
 * a backend route that doesn't exist yet. The shape mirrors
 * adminTeacherService.ts's fetchUserDocuments/uploadUserDocument/
 * deleteUserDocument (POST /admin_user_document_*) almost exactly, since
 * that generic per-user document store already exists server-side - EXCEPT
 * these three need to resolve the target user from `auth('sanctum')->user()`
 * server-side instead of a client-supplied user_id. That's not a minor
 * detail: the admin routes are safe to key off a passed-in user_id only
 * because they also check "does this admin manage that user's school" first;
 * a student-facing route has no such check to fall back on, so it must never
 * accept a user_id from the client at all.
 *
 *   POST /student_document_upload_list    - no params, returns the caller's own documents
 *   POST /student_document_upload_store   - multipart: title, file
 *   POST /student_document_upload_delete  - { document_id } - must 404/403 if it isn't the caller's own
 */

const CACHE_PREFIX = '@student_document_upload_cache_v1';

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

async function authedPost(path: string, token: string, body: FormData | Record<string, any> = {}) {
  const isFormData = body instanceof FormData;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      Authorization: `Bearer ${token}`,
    },
    body: isFormData ? body : JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(firstErrorMessage(data) ?? `Request failed (${response.status})`);
  }
  return data;
}

export interface MyUploadedDocument {
  id: number;
  title: string;
  file: string;
  created_at: string;
}

function normalizeDocument(raw: any): MyUploadedDocument {
  return {
    id: raw.id,
    title: raw.title ?? '',
    file: absoluteUrl(raw.file ?? null) ?? raw.file,
    created_at: raw.created_at ?? '',
  };
}

/**
 * POST /student_document_upload_list - the caller's own uploaded documents.
 * Cache-then-network: a network failure falls back to the last-fetched
 * list instead of throwing, so a child can still see what they've already
 * submitted while offline.
 */
export async function fetchMyUploadedDocuments(token: string): Promise<MyUploadedDocument[]> {
  return cacheThenNetwork(cacheKeyFor(CACHE_PREFIX, token, 'list'), async () => {
    const data = await authedPost('/student_document_upload_list', token);
    const rawList: any[] = data.documents ?? [];
    return rawList.map(normalizeDocument);
  });
}

/** POST /student_document_upload_store - multipart: title, file. */
export async function uploadMyDocument(
  token: string,
  title: string,
  file: { uri: string; name: string | null; type: string | null },
): Promise<MyUploadedDocument> {
  const form = new FormData();
  form.append('title', title);
  // @ts-ignore - React Native's FormData accepts this shape for file uploads
  form.append('file', {
    uri: file.uri,
    name: file.name ?? `document_${Date.now()}`,
    type: file.type ?? 'application/octet-stream',
  });

  const data = await authedPost('/student_document_upload_store', token, form);
  return normalizeDocument(data.document);
}

/** POST /student_document_upload_delete - only succeeds if the document belongs to the caller. */
export async function deleteMyDocument(token: string, documentId: number): Promise<void> {
  await authedPost('/student_document_upload_delete', token, { document_id: documentId });
}
