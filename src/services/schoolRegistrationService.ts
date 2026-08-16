import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { API_BASE_URL, absoluteUrl } from '../config/api';

/**
 * "Register Your School" self-service signup - the Get Started sheet's
 * first option on LoginScreen. A brand-new school + its first admin don't
 * exist as accounts yet, so every call here (except the superadmin review
 * ones) is UNAUTHENTICATED - no token, since there's no account to hold
 * one until a superadmin approves.
 *
 * Following this repo's established "ship the frontend, document the
 * contract, backend catches up" convention (see widgetAnnouncementService.ts
 * / examinationService.ts) since none of these routes exist yet:
 *
 *   POST /school_registration_submit   (public, multipart)
 *     fields: school_name, institution_type, school_address, school_email,
 *       school_phone, admin_name, admin_email, admin_phone, password,
 *       id_document (file), selfie (file)
 *     -> { status: 'pending', registration_id: number }
 *     Server should reject if admin_email already belongs to an existing
 *     user, same duplicate-email check the rest of the app relies on.
 *
 *   POST /superadmin_school_registration_list    (superadmin) -> { registrations: PendingRegistration[] }
 *   POST /superadmin_school_registration_approve  (superadmin, { id })
 *     -> creates the real School + admin User records (status: 1, so the
 *     admin can log in immediately after) and marks the registration
 *     approved. -> { registration }
 *   POST /superadmin_school_registration_reject   (superadmin, { id, reason?: string }) -> { registration }
 */
const DEFAULT_TIMEOUT_MS = 15000;
const UPLOAD_TIMEOUT_MS = 45000;

export type RegistrationStatus = 'pending' | 'approved' | 'rejected';

export interface PickedRegistrationImage {
  uri: string;
  fileName?: string | null;
  type?: string | null;
}

export interface SchoolRegistrationInput {
  schoolName: string;
  institutionType: 'mahad' | 'madrasa' | 'markaz' | 'regular_school' | 'orphanage';
  schoolAddress?: string;
  schoolEmail?: string;
  schoolPhone?: string;
  adminName: string;
  adminEmail: string;
  adminPhone?: string;
  password: string;
  idDocument: PickedRegistrationImage;
  selfie: PickedRegistrationImage;
}

export interface PendingRegistration {
  id: number;
  status: RegistrationStatus;
  school_name: string;
  institution_type: string;
  school_address: string | null;
  admin_name: string;
  admin_email: string;
  admin_phone: string | null;
  id_document_url: string | null;
  selfie_url: string | null;
  created_at: string;
  reason: string | null;
}

async function postForm(path: string, form: FormData, token?: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timed out. Check your connection and try again.');
    }
    throw await describeNetworkError(`${API_BASE_URL}${path}`, err);
  } finally {
    clearTimeout(timeoutId);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message ?? `Request failed (${response.status})`);
  }
  return data;
}

async function postJson(path: string, body: Record<string, any>, token: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timed out. Check your connection and try again.');
    }
    throw await describeNetworkError(`${API_BASE_URL}${path}`, err);
  } finally {
    clearTimeout(timeoutId);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message ?? `Request failed (${response.status})`);
  }
  return data;
}

/**
 * fetch() throwing means the request never got a response at all - no
 * status code, nothing to parse - which "Request failed (xxx)" above
 * can't describe. That's a genuinely different failure class (device
 * offline, DNS, a broken/expired TLS cert, or the server being down)
 * than a route/table that exists but errors, so it needs its own
 * diagnosis: logs the real request + raw error (visible in Metro/logcat
 * for remote debugging) and tells NetInfo apart from the alternative -
 * "your device has no internet" vs "your device is online but the
 * server didn't answer" are different problems with different fixes.
 */
async function describeNetworkError(url: string, err: unknown): Promise<Error> {
  const raw = err instanceof Error ? err.message : String(err);
  // Logging the raw Error object prints "{}" - Error's message/stack/name
  // are non-enumerable and don't survive RN LogBox's serialization. Pull
  // out the fields that actually matter (including `cause`, which is
  // where a native TLS/socket error sometimes ends up) into a plain
  // object instead.
  console.error('[schoolRegistrationService] network failure', {
    url,
    name: err instanceof Error ? err.name : typeof err,
    message: raw,
    cause: err instanceof Error ? (err as any).cause : undefined,
    stack: err instanceof Error ? err.stack : undefined,
  });

  let netState: NetInfoState | null = null;
  try {
    netState = await NetInfo.fetch();
  } catch {
    // NetInfo itself failing tells us nothing extra - fall through to the
    // generic message below rather than letting this mask the original error.
  }

  if (netState && (!netState.isConnected || netState.isInternetReachable === false)) {
    return new Error(`No internet connection. Check your Wi-Fi or mobile data and try again. (${raw})`);
  }
  return new Error(`Could not reach the server. It may be down, or there's a certificate problem. (${raw})`);
}

function toFilePart(img: PickedRegistrationImage, fallbackName: string) {
  return {
    uri: img.uri,
    name: img.fileName ?? fallbackName,
    type: img.type ?? 'image/jpeg',
  };
}

/** POST /school_registration_submit - unauthenticated, creates a pending application. */
export async function submitSchoolRegistration(input: SchoolRegistrationInput): Promise<{ registrationId: number }> {
  const form = new FormData();
  form.append('school_name', input.schoolName);
  form.append('institution_type', input.institutionType);
  if (input.schoolAddress) form.append('school_address', input.schoolAddress);
  if (input.schoolEmail) form.append('school_email', input.schoolEmail);
  if (input.schoolPhone) form.append('school_phone', input.schoolPhone);
  form.append('admin_name', input.adminName);
  form.append('admin_email', input.adminEmail);
  if (input.adminPhone) form.append('admin_phone', input.adminPhone);
  form.append('password', input.password);
  // @ts-ignore - React Native's FormData accepts this shape for file uploads
  form.append('id_document', toFilePart(input.idDocument, 'id_document.jpg'));
  // @ts-ignore
  form.append('selfie', toFilePart(input.selfie, 'selfie.jpg'));

  const data = await postForm('/school_registration_submit', form);
  return { registrationId: data.registration_id };
}

function normalizeRegistration(raw: any): PendingRegistration {
  return {
    id: raw.id,
    status: raw.status,
    school_name: raw.school_name,
    institution_type: raw.institution_type,
    school_address: raw.school_address ?? null,
    admin_name: raw.admin_name,
    admin_email: raw.admin_email,
    admin_phone: raw.admin_phone ?? null,
    id_document_url: absoluteUrl(raw.id_document_url ?? null),
    selfie_url: absoluteUrl(raw.selfie_url ?? null),
    created_at: raw.created_at,
    reason: raw.reason ?? null,
  };
}

/**
 * POST /superadmin_school_registration_list
 *
 * JSON, not multipart - this call has no fields to send, and an EMPTY
 * FormData body never leaves the device on Android: RN's NetworkingModule
 * hands the (zero) parts to OkHttp's MultipartBody.Builder, whose build()
 * rejects a body with no parts. fetch() then rejects before any socket is
 * opened, which surfaces as a bare "Network request failed" - i.e. it looks
 * exactly like the server being down or having a bad cert, when in fact the
 * request was never sent. Every other superadmin endpoint posts JSON (see
 * superAdminService.ts's authedPost, which sends {} for its own no-arg
 * calls); this one is the only one that didn't, and the only one that failed.
 *
 * submit() below still uses postForm - it genuinely uploads files.
 */
export async function fetchPendingSchoolRegistrations(token: string): Promise<PendingRegistration[]> {
  const data = await postJson('/superadmin_school_registration_list', {}, token);
  return (data.registrations ?? []).map(normalizeRegistration);
}

/** POST /superadmin_school_registration_approve - creates the real School + admin User. */
export async function approveSchoolRegistration(token: string, id: number): Promise<PendingRegistration> {
  const data = await postJson('/superadmin_school_registration_approve', { id }, token);
  return normalizeRegistration(data.registration);
}

/** POST /superadmin_school_registration_reject */
export async function rejectSchoolRegistration(token: string, id: number, reason?: string): Promise<PendingRegistration> {
  const data = await postJson('/superadmin_school_registration_reject', { id, ...(reason ? { reason } : {}) }, token);
  return normalizeRegistration(data.registration);
}
