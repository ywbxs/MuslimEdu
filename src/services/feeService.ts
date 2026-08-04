import { API_BASE_URL, absoluteUrl } from '../config/api';

// Requests that use file uploads legitimately take longer than a plain JSON
// POST - mirrors adminTeacherService.ts's timeout split, even though none of
// these calls currently upload a file (kept for consistency/future-proofing
// if a receipt attachment is ever added to record-payment).
const DEFAULT_TIMEOUT_MS = 15000;

async function authedPost(path: string, token: string, body: FormData | Record<string, any> = {}) {
  const isFormData = body instanceof FormData;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        Authorization: `Bearer ${token}`,
      },
      body: isFormData ? body : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timed out. Check your connection and try again.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message ?? `Request failed (${response.status})`);
  }

  return data;
}

export interface FeeInvoice {
  id: number;
  student_id: number;
  student_name: string | null;
  student_code: string | null;
  title: string;
  total_amount: number;
  paid_amount: number;
  payment_method: string | null;
  status: string; // 'unpaid' | 'partial' | 'paid' - backend-defined, not a fixed enum
  timestamp: number;
  // Who created this invoice, or most recently recorded a payment against
  // it - lets admin see which cashier collected a given payment.
  recorded_by: number | null;
  recorded_by_name: string | null;
}

/**
 * POST /admin_fee_list - school-wide invoice list, for admin (oversight) or
 * accountant/cashier (day-to-day collection). Unlike the student-facing
 * /fee_list this mirrors, it's not scoped to the caller's own invoices.
 * Optional filters narrow it to one student or one status.
 */
export async function fetchAdminFeeList(
  token: string,
  filters?: { studentId?: number; status?: string },
): Promise<FeeInvoice[]> {
  const data = await authedPost('/admin_fee_list', token, {
    ...(filters?.studentId ? { student_id: filters.studentId } : {}),
    ...(filters?.status ? { status: filters.status } : {}),
  });
  return (data.invoices ?? []) as FeeInvoice[];
}

/**
 * POST /admin_fee_record_payment - the actual "collect money at the
 * counter" action. `paidAmount` is the amount being paid NOW, added to
 * whatever's already recorded on the invoice - not a running total the
 * caller has to track itself. The backend derives the resulting status
 * (partial vs. fully paid).
 */
export async function recordFeePayment(
  token: string,
  feeId: number,
  paidAmount: number,
  paymentMethod: string,
): Promise<FeeInvoice> {
  const data = await authedPost('/admin_fee_record_payment', token, {
    fee_id: feeId,
    paid_amount: paidAmount,
    payment_method: paymentMethod,
  });
  return data.invoice as FeeInvoice;
}

/**
 * POST /admin_fee_create - admin-only (not accountant): creates a new fee
 * invoice for a student. Deciding what a student owes is a finance-setup
 * decision, kept separate from the cashier's collection role.
 */
export async function createFeeInvoice(
  token: string,
  studentId: number,
  title: string,
  totalAmount: number,
): Promise<FeeInvoice> {
  const data = await authedPost('/admin_fee_create', token, {
    student_id: studentId,
    title,
    total_amount: totalAmount,
  });
  return data.invoice as FeeInvoice;
}

export interface CashierAccount {
  id: number;
  name: string;
  name_ar?: string | null;
  email: string;
  photo: string | null;
  phone: string | null;
  code: string | null;
  status: number;
}

/** POST /admin_accountant_list - admin-only: every Cashier account in the school. */
export async function fetchCashierAccounts(token: string): Promise<CashierAccount[]> {
  const data = await authedPost('/admin_accountant_list', token);
  const rawList: any[] = data.accountants ?? [];
  return rawList.map((raw) => ({
    id: raw.id,
    name: raw.name ?? '',
    name_ar: raw.name_ar ?? null,
    email: raw.email ?? '',
    photo: absoluteUrl(raw.photo ?? null),
    phone: raw.phone ?? null,
    code: raw.code ?? null,
    status: raw.status,
  }));
}

export interface CashierProfile {
  id: number;
  name: string;
  name_ar?: string | null;
  email: string;
  photo: string | null;
  phone: string | null;
  address: string | null;
  gender: string | null;
  birthday: string | null;
  designation: string | null;
  code: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  signature?: string | null;
}

// A cashier's core identity fields - name/email/phone/address/gender/birthday,
// plus an optional password reset. `password` is only sent to the backend
// when non-empty, so leaving it blank keeps the cashier's existing password.
export type CashierBasicProfileFields = Partial<{
  name: string;
  email: string;
  phone: string;
  address: string;
  gender: string;
  birthday: string; // 'YYYY-MM-DD'
  password: string;
}>;

/** POST /admin_accountant_profile - a single cashier's basic contact/role info. */
export async function fetchCashierProfile(token: string, cashierId: number): Promise<CashierProfile> {
  const data = await authedPost('/admin_accountant_profile', token, { accountant_id: cashierId });
  return {
    id: data.id,
    name: data.name ?? '',
    name_ar: data.name_ar ?? null,
    email: data.email ?? '',
    photo: absoluteUrl(data.photo ?? null),
    phone: data.phone ?? null,
    address: data.address ?? null,
    gender: data.gender ?? null,
    birthday: data.birthday ?? null,
    designation: data.designation ?? null,
    code: data.code ?? null,
    emergency_contact_name: data.emergency_contact_name ?? null,
    emergency_contact_phone: data.emergency_contact_phone ?? null,
    signature: data.signature ? absoluteUrl(data.signature) : null,
  };
}

/**
 * POST /admin_accountant_profile_update - save a cashier's core identity
 * fields (name/email/phone/address/gender/birthday, optional password reset).
 */
export async function updateCashierProfile(
  token: string,
  cashierId: number,
  fields: CashierBasicProfileFields,
): Promise<{ message: string }> {
  const data = await authedPost('/admin_accountant_profile_update', token, { accountant_id: cashierId, ...fields });
  return { message: data.message ?? 'Profile updated successfully.' };
}

export interface AddCashierInput {
  name: string;
  name_ar?: string;
  email: string;
  password: string;
  phone?: string;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
}

export interface AddedCashier {
  id: number;
  name: string;
  email: string | null;
  code: string | null;
}

/** POST /admin_accountant_admission_single - admin creates a new Cashier account. */
export async function addCashier(token: string, input: AddCashierInput): Promise<AddedCashier> {
  const data = await authedPost('/admin_accountant_admission_single', token, { ...input });
  const record = data.accountant ?? data.data?.accountant ?? data.data ?? data;
  return record as AddedCashier;
}
