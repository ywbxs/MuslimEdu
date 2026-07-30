import { API_BASE_URL } from '../config/api';

/**
 * M4 memorization progress tracking. Backend: MemorizationController
 * (newly written this round — confirmed via search that nothing like this
 * existed before). Visibility: admins see every record in their school;
 * teachers see records they logged plus records for sections where
 * they're the homeroom teacher.
 *
 * Never executed against a live server.
 */

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
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error('You appear to be offline. Check your connection and try again.');
  }

  const data = await response.json().catch(() => ({}));

  if (response.status === 401 || response.status === 403) {
    throw new Error(firstErrorMessage(data) ?? 'You do not have permission to do this.');
  }

  if (!response.ok) {
    throw new Error(firstErrorMessage(data) ?? `Request failed (${response.status})`);
  }

  return data;
}

// --- Types ---

export type MemorizationStatus = 'assigned' | 'in_progress' | 'memorized' | 'needs_revision';
export type QualityRating = 'needs_improvement' | 'fair' | 'good' | 'excellent';

export interface RefRow {
  id: number;
  name: string;
}

export interface MemorizationRecord {
  id: number;
  student_id: number;
  section_id: number | null;
  surah_number: number;
  surah_name: string;
  juz_number: number | null;
  status: MemorizationStatus;
  quality_rating: QualityRating | null;
  recorded_date: string;
  notes: string | null;
  recorded_by: number;
  student?: RefRow & { email?: string };
  section?: RefRow | null;
  recorder?: RefRow;
}

export interface MemorizationDraft {
  id?: number;
  student_id?: number;
  section_id?: number | null;
  surah_number: number;
  surah_name: string;
  juz_number?: number | null;
  status: MemorizationStatus;
  quality_rating?: QualityRating | null;
  recorded_date: string;
  notes?: string | null;
}

export async function fetchMemorizationRecords(
  token: string,
  filters: { studentId?: number | null; sectionId?: number | null; status?: MemorizationStatus | null } = {}
): Promise<MemorizationRecord[]> {
  const data = await authedPost('/memorization_record_list', token, {
    student_id: filters.studentId ?? null,
    section_id: filters.sectionId ?? null,
    status: filters.status ?? null,
  });
  return data.records ?? [];
}

export async function saveMemorizationRecord(token: string, draft: MemorizationDraft): Promise<MemorizationRecord> {
  const data = await authedPost('/memorization_record_save', token, draft);
  return data.record;
}

export async function deleteMemorizationRecord(token: string, id: number): Promise<void> {
  await authedPost('/memorization_record_delete', token, { id });
}
