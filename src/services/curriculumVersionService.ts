import { API_BASE_URL } from '../config/api';

/**
 * §4.6 Curriculum versioning — versions and competencies. Backend:
 * CurriculumVersionController (newly written this round). A student's
 * active credit requirements/competencies come from whichever version their
 * enrollment row is pinned to (`enrollment.curriculum_version_id`), not
 * from "whatever the curriculum currently says" — see the controller's own
 * comments. Never executed against a live server.
 *
 * Prerequisites/co-requisites are NOT part of this file — that's already a
 * subject-level feature (`fetchSubjectsCatalog` /
 * `Subject.prerequisites`/`corequisites` in adminAcademicCatalogService.ts),
 * so this screen doesn't duplicate it.
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

export interface CurriculumVersion {
  id: number;
  school_id: number;
  curriculum_id: number;
  version_label: string;
  effective_date: string;
  end_date: string | null;
  status: 'draft' | 'active' | 'retired';
  credit_requirements: Record<string, number> | null;
  notes: string | null;
}

export interface VersionDraft {
  id?: number;
  curriculum_id?: number;
  version_label: string;
  effective_date: string;
  end_date?: string | null;
  status?: 'draft' | 'active' | 'retired';
  credit_requirements?: Record<string, number> | null;
  notes?: string | null;
}

export interface CurriculumCompetency {
  id: number;
  curriculum_version_id: number;
  code: string;
  title: string;
  description: string | null;
  category: 'academic' | 'islamic_studies' | 'arabic' | 'other';
  sort_order: number;
}

export interface CompetencyDraft {
  id?: number;
  curriculum_version_id?: number;
  code?: string;
  title: string;
  description?: string | null;
  category?: 'academic' | 'islamic_studies' | 'arabic' | 'other';
  sort_order?: number;
}

// --- Versions ---

export async function fetchCurriculumVersions(token: string, curriculumId: number): Promise<CurriculumVersion[]> {
  const data = await authedPost('/admin_curriculum_version_list', token, { curriculum_id: curriculumId });
  return data.versions ?? [];
}

export async function saveCurriculumVersion(token: string, draft: VersionDraft): Promise<CurriculumVersion> {
  const data = await authedPost('/admin_curriculum_version_save', token, draft);
  return data.version;
}

export async function deleteCurriculumVersion(token: string, id: number): Promise<void> {
  await authedPost('/admin_curriculum_version_delete', token, { id });
}

// --- Competencies ---

export async function fetchCurriculumCompetencies(
  token: string,
  curriculumVersionId: number
): Promise<CurriculumCompetency[]> {
  const data = await authedPost('/admin_curriculum_competency_list', token, {
    curriculum_version_id: curriculumVersionId,
  });
  return data.competencies ?? [];
}

export async function saveCurriculumCompetency(token: string, draft: CompetencyDraft): Promise<CurriculumCompetency> {
  const data = await authedPost('/admin_curriculum_competency_save', token, draft);
  return data.competency;
}

export async function deleteCurriculumCompetency(token: string, id: number): Promise<void> {
  await authedPost('/admin_curriculum_competency_delete', token, { id });
}
