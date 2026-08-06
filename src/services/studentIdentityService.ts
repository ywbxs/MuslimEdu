import { API_BASE_URL, absoluteUrl } from '../config/api';
import { cacheKeyFor, cacheThenNetwork } from '../utils/offlineCache';

const CACHE_PREFIX = '@student_identity_cache_v1';

export interface StudentIdentity {
  student_id: number;
  name: string;
  email: string | null;
  student_number: string | null;
  photo: string | null;
  school: { id: number | null; name: string | null; logo: string | null };
  academic: {
    program: string | null;
    department: string | null;
    grade_level: string | null;
    class_name: string | null;
    section: string | null;
    academic_year: string | null;
    status: string | null;
  };
  qr_payload: string;
  qr_available: boolean;
}

function messageOf(data: any): string {
  return data?.message ?? data?.error ?? `Request failed`;
}

// Cache-then-network: the digital ID card needs to render (QR code included)
// even with no signal, e.g. showing it at a gate - a network failure falls
// back to the last-fetched identity instead of leaving the screen blank.
export async function fetchStudentIdentity(token: string): Promise<StudentIdentity> {
  return cacheThenNetwork(cacheKeyFor(CACHE_PREFIX, token), async () => {
    const response = await fetch(`${API_BASE_URL}/student_identity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(messageOf(data));
    const identity = data.identity as StudentIdentity;
    return {
      ...identity,
      photo: absoluteUrl(identity.photo),
      school: { ...identity.school, logo: absoluteUrl(identity.school?.logo) },
    };
  });
}
