import { AuthUser, UserRole } from './authService';

export type Capability =
  | 'view_students'
  | 'manage_students'
  | 'manage_academic_setup'
  | 'manage_academic_catalog'
  | 'manage_grading'
  | 'manage_enrollment'
  | 'teach'
  | 'submit_student_work'
  | 'view_own_records';

const ROLE_CAPABILITIES: Record<UserRole, readonly Capability[]> = {
  superadmin: [
    'view_students', 'manage_students', 'manage_academic_setup',
    'manage_academic_catalog', 'manage_grading', 'manage_enrollment',
  ],
  admin: [
    'view_students', 'manage_students', 'manage_academic_setup',
    'manage_academic_catalog', 'manage_grading', 'manage_enrollment',
  ],
  teacher: ['view_students', 'teach'],
  accountant: [],
  librarian: [],
  parent: [],
  student: ['submit_student_work', 'view_own_records'],
  warden: ['view_students'],
};

/**
 * UI gating only. Laravel remains the authority and must repeat every check.
 * Never use this helper to decide whether a request is safe to send.
 */
export function can(user: AuthUser | null | undefined, capability: Capability): boolean {
  if (!user) return false;
  return ROLE_CAPABILITIES[user.role]?.includes(capability) ?? false;
}

export function isAdmin(user: AuthUser | null | undefined): boolean {
  return user?.role === 'admin' || user?.role === 'superadmin';
}

export function sameSchool(user: AuthUser | null | undefined, schoolId: number | null | undefined): boolean {
  return !!user?.school_id && !!schoolId && user.school_id === schoolId;
}

export function assertSameSchool(user: AuthUser | null | undefined, schoolId: number | null | undefined): void {
  if (!sameSchool(user, schoolId)) {
    throw new Error('This record is outside your school scope.');
  }
}
