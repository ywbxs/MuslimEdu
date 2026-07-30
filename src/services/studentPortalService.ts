import { API_BASE_URL } from '../config/api';

/**
 * M5 student portal — documents, services, and settings.
 *
 * Backend: StudentPortalController (app/Http/Controllers/StudentPortalController.php).
 * Verified live this session against a real seeded database: student
 * requests a document → admin issues it → student sees it marked issued;
 * student submits a service ticket; settings show/save; password update
 * (including the wrong-current-password rejection). Not a guess.
 *
 * `home()` on that controller is deliberately NOT wired here — it
 * duplicates the already-live `student_portal_home` (portalService.ts).
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
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
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

export interface StudentDocument {
  id: number;
  document_type: string;
  label: string;
  purpose: string | null;
  copies: number;
  status: 'requested' | 'issued' | 'rejected';
  reference_no: string;
  download_url: string | null;
  issued_at: string | null;
  rejected_reason: string | null;
  created_at: string;
}

export interface AdminDocumentRequest extends StudentDocument {
  school_id: number;
  student_id: number;
  student?: { id: number; name: string; code: string | null };
}

export interface ServiceCatalogEntry {
  key: string;
  label: string;
  sla_days: number;
  needs_details: boolean;
}

export interface ServiceRequest {
  id: number;
  service_key: string;
  service_label: string;
  reference_no: string;
  subject: string;
  details: string | null;
  status: 'open' | 'in_progress' | 'resolved' | 'cancelled';
  priority: 'low' | 'normal' | 'high';
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface UserSettings {
  language: string;
  theme: string;
  calendar_type: string;
  timezone: string | null;
  date_format: string;
  profile_visibility: string;
  show_email: boolean;
  show_phone: boolean;
  digest_frequency: string;
}

export interface UserSettingsOptions {
  languages: string[];
  themes: string[];
  calendar_types: string[];
  date_formats: string[];
  profile_visibility: string[];
  digest_frequency: string[];
}

// --- Documents (student) ---

export async function fetchStudentDocuments(
  token: string,
): Promise<{ documents: StudentDocument[]; document_types: string[]; summary: Record<string, number> }> {
  return authedPost('/student_document_list', token);
}

export async function requestStudentDocument(
  token: string,
  documentType: string,
  purpose?: string,
  copies?: number,
): Promise<{ message: string; document: StudentDocument }> {
  return authedPost('/student_document_request', token, {
    document_type: documentType,
    purpose,
    copies,
  });
}

export async function cancelStudentDocument(token: string, documentId: number): Promise<{ message: string }> {
  return authedPost('/student_document_cancel', token, { document_id: documentId });
}

// --- Documents (admin fulfillment) ---

export async function fetchAdminDocumentRequests(token: string): Promise<AdminDocumentRequest[]> {
  const data = await authedPost('/admin_student_document_list', token);
  return data.requests?.data ?? [];
}

export async function issueAdminDocument(token: string, documentId: number): Promise<{ message: string }> {
  return authedPost('/admin_student_document_issue', token, { document_id: documentId });
}

export async function rejectAdminDocument(
  token: string,
  documentId: number,
  reason: string,
): Promise<{ message: string }> {
  return authedPost('/admin_student_document_reject', token, { document_id: documentId, reason });
}

// --- Services (student) ---

export async function fetchServiceCatalog(
  token: string,
): Promise<{ services: ServiceCatalogEntry[]; requests: ServiceRequest[]; summary: Record<string, number> }> {
  return authedPost('/student_service_catalog', token);
}

export async function storeServiceRequest(
  token: string,
  serviceKey: string,
  subject: string,
  details?: string,
): Promise<{ message: string; request: ServiceRequest }> {
  return authedPost('/student_service_request_store', token, { service_key: serviceKey, subject, details });
}

export async function cancelServiceRequest(token: string, requestId: number): Promise<{ message: string }> {
  return authedPost('/student_service_request_cancel', token, { request_id: requestId });
}

// --- Services (admin) ---

export interface AdminServiceRequest extends ServiceRequest {
  student_id: number;
  student?: { id: number; name: string; code: string | null };
}

export async function fetchAdminServiceRequests(token: string): Promise<AdminServiceRequest[]> {
  const data = await authedPost('/admin_student_service_request_list', token);
  return data.requests?.data ?? [];
}

export async function updateAdminServiceRequest(
  token: string,
  requestId: number,
  status: 'in_progress' | 'resolved',
  resolutionNote?: string,
): Promise<{ message: string }> {
  return authedPost('/admin_student_service_request_update', token, {
    request_id: requestId,
    status,
    resolution_note: resolutionNote,
  });
}

// --- Settings (any authenticated user) ---

export async function fetchUserSettings(
  token: string,
): Promise<{ settings: UserSettings; options: UserSettingsOptions }> {
  return authedPost('/user_settings_show', token);
}

export async function saveUserSettings(token: string, settings: Partial<UserSettings>): Promise<{ message: string }> {
  return authedPost('/user_settings_save', token, settings);
}

export async function updatePassword(
  token: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ message: string }> {
  return authedPost('/user_password_update', token, {
    current_password: currentPassword,
    new_password: newPassword,
    new_password_confirmation: newPassword,
  });
}
