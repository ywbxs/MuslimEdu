import { API_BASE_URL } from '../config/api';

/**
 * §4.1 leftovers: faculties/colleges/institutes and streams/specializations.
 * Backend: OrgStructureController (newly written this round). Program<->
 * Curriculum linking is NOT here — that's just `program_id` on the
 * existing curricula CRUD (CurriculumFormScreen), not a separate surface.
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

export interface Faculty {
  id: number;
  school_id: number;
  name: string;
  code: string | null;
  type: 'faculty' | 'college' | 'institute';
  head_id: number | null;
  description: string | null;
  status: 'active' | 'inactive';
  departments_count?: number;
}

export interface FacultyDraft {
  id?: number;
  name: string;
  code?: string | null;
  type?: 'faculty' | 'college' | 'institute';
  head_id?: number | null;
  description?: string | null;
  status?: 'active' | 'inactive';
}

export interface RefRow {
  id: number;
  name: string;
}

export interface Stream {
  id: number;
  school_id: number;
  department_id: number;
  program_id: number | null;
  name: string;
  code: string | null;
  kind: 'stream' | 'specialization';
  description: string | null;
  status: 'active' | 'inactive';
  department?: RefRow;
  program?: RefRow | null;
}

export interface StreamDraft {
  id?: number;
  department_id: number;
  program_id?: number | null;
  name: string;
  code?: string | null;
  kind?: 'stream' | 'specialization';
  description?: string | null;
  status?: 'active' | 'inactive';
}

// --- Faculties ---

export async function fetchFaculties(token: string): Promise<Faculty[]> {
  const data = await authedPost('/admin_faculty_list', token);
  return data.faculties ?? [];
}

export async function saveFaculty(token: string, draft: FacultyDraft): Promise<Faculty> {
  const data = await authedPost('/admin_faculty_save', token, draft);
  return data.faculty;
}

export async function deleteFaculty(token: string, id: number): Promise<void> {
  await authedPost('/admin_faculty_delete', token, { id });
}

// --- Streams / specializations ---

export async function fetchStreams(
  token: string,
  filters: { departmentId?: number | null; programId?: number | null; kind?: 'stream' | 'specialization' | null } = {}
): Promise<Stream[]> {
  const data = await authedPost('/admin_stream_list', token, {
    department_id: filters.departmentId ?? null,
    program_id: filters.programId ?? null,
    kind: filters.kind ?? null,
  });
  return data.streams ?? [];
}

export async function saveStream(token: string, draft: StreamDraft): Promise<Stream> {
  const data = await authedPost('/admin_stream_save', token, draft);
  return data.stream;
}

export async function deleteStream(token: string, id: number): Promise<void> {
  await authedPost('/admin_stream_delete', token, { id });
}
