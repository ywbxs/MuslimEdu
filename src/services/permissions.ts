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
  | 'view_own_records'
  | 'view_fees'
  | 'record_fee_payments'
  | 'manage_fees'
  | 'manage_enrollment_progress';

const ROLE_CAPABILITIES: Record<UserRole, readonly Capability[]> = {
  superadmin: [
    'view_students', 'manage_students', 'manage_academic_setup',
    'manage_academic_catalog', 'manage_grading', 'manage_enrollment',
    'view_fees', 'record_fee_payments', 'manage_fees',
  ],
  admin: [
    'view_students', 'manage_students', 'manage_academic_setup',
    'manage_academic_catalog', 'manage_grading', 'manage_enrollment',
    'view_fees', 'record_fee_payments', 'manage_fees',
  ],
  teacher: ['view_students', 'teach'],
  // Cashier. Deliberately no 'manage_fees' - deciding what a student owes
  // (creating a new invoice) is a finance-setup decision reserved for
  // admin/superadmin, matching admin_fee_create's requireAdmin-only guard
  // on the backend. 'view_fees'/'record_fee_payments' match
  // admin_fee_list/admin_fee_record_payment's shared requireAdminOrAccountant guard.
  accountant: ['view_fees', 'record_fee_payments'],
  // Registrar. Can view the enrollment pipeline and advance a student to
  // the next stage (matches admin_enrollment_workflow_list/advance/history's
  // shared requireAdminOrRegistrar guard on the backend). Deliberately no
  // 'manage_enrollment' - stage configuration and starting/withdrawing a
  // student's workflow stay admin-only, matching those endpoints' guards.
  registrar: ['manage_enrollment_progress', 'view_students'],
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
