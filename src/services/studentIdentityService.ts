import { API_BASE_URL, absoluteUrl } from '../config/api';

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

export async function fetchStudentIdentity(token: string): Promise<StudentIdentity> {
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
}
