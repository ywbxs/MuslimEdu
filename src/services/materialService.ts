import { API_BASE_URL, absoluteUrl } from '../config/api';
import { cacheKeyFor, cacheThenNetwork } from '../utils/offlineCache';

const CACHE_PREFIX = '@material_cache_v1';

// --- Shared fetch helpers (same pattern as announcementService.ts/assessmentService.ts) ---

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

// Multipart variant — every material upload uses this, since a file is
// always required (unlike Announcements, where the attachment is optional).
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

export type MaterialCategory =
  | 'lecture_notes'
  | 'presentation'
  | 'video'
  | 'audio'
  | 'worksheet'
  | 'reading'
  | 'other';

export interface MaterialTarget {
  section_id: number;
  section_name: string;
  subject_id: number;
  subject_name: string | null;
}

export interface Material {
  id: number;
  title: string;
  description: string | null;
  category: MaterialCategory;
  week_label: string | null;
  section_id: number;
  section_name: string | null;
  subject_id: number;
  subject_name: string | null;
  teacher_id: number;
  teacher_name: string | null;
  file_url: string;
  file_name: string;
  uploaded_at: string;
}

export interface NewMaterialInput {
  section_id: number;
  subject_id: number;
  title: string;
  description?: string | null;
  week_label?: string | null;
  category?: MaterialCategory;
  // RN file object: { uri, name, type }. Currently sourced from
  // react-native-image-picker (photos only) — see TeacherMaterialsScreen
  // for the known limitation.
  file: { uri: string; name: string; type: string };
}

function mapMaterial(m: any): Material {
  return {
    ...m,
    file_url: absoluteUrl(m.file_url ?? null),
  };
}

// --- Teacher ---

export async function fetchMaterialTargets(token: string): Promise<MaterialTarget[]> {
  const data = await authedPost('/teacher_material_targets', token);
  return data.targets ?? [];
}

export async function fetchTeacherMaterials(
  token: string,
  sectionId?: number | null,
  subjectId?: number | null
): Promise<Material[]> {
  const cacheKey = cacheKeyFor(CACHE_PREFIX, token, 'teacher', sectionId ?? 'all', subjectId ?? 'all');
  return cacheThenNetwork(cacheKey, async () => {
    const data = await authedPost('/teacher_material_list', token, {
      section_id: sectionId ?? undefined,
      subject_id: subjectId ?? undefined,
    });
    return (data.materials ?? []).map(mapMaterial);
  });
}

export async function uploadMaterial(token: string, input: NewMaterialInput): Promise<Material> {
  const form = new FormData();
  form.append('section_id', String(input.section_id));
  form.append('subject_id', String(input.subject_id));
  form.append('title', input.title);
  if (input.description) form.append('description', input.description);
  if (input.week_label) form.append('week_label', input.week_label);
  form.append('category', input.category ?? 'other');
  form.append('material', input.file as any);

  const data = await authedPostForm('/teacher_material_store', token, form);
  return mapMaterial(data.material);
}

export async function deleteMaterial(token: string, materialId: number): Promise<void> {
  await authedPost('/teacher_material_delete', token, { material_id: materialId });
}

// --- Student ---

export async function fetchStudentMaterials(
  token: string,
  subjectId?: number | null
): Promise<Material[]> {
  return cacheThenNetwork(cacheKeyFor(CACHE_PREFIX, token, 'student', subjectId ?? 'all'), async () => {
    const data = await authedPost('/student_material_list', token, {
      subject_id: subjectId ?? undefined,
    });
    return (data.materials ?? []).map(mapMaterial);
  });
}

// --- Admin ---

export async function fetchAdminMaterialReview(
  token: string,
  sectionId?: number | null
): Promise<Material[]> {
  return cacheThenNetwork(cacheKeyFor(CACHE_PREFIX, token, 'adminReview', sectionId ?? 'all'), async () => {
    const data = await authedPost('/admin_material_review', token, {
      section_id: sectionId ?? undefined,
    });
    return (data.materials ?? []).map(mapMaterial);
  });
}
