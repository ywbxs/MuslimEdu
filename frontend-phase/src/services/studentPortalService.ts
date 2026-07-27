import { post } from './nextPhaseClient';

export type StudentDocument = {
  id: number;
  document_type: string;
  label: string;
  purpose: string | null;
  copies: number;
  status: 'requested' | 'processing' | 'issued' | 'rejected';
  reference_no: string | null;
  download_url: string | null;
  issued_at: string | null;
  rejected_reason: string | null;
  created_at: string | null;
};

export type ServiceDefinition = {
  key: string;
  label: string;
  sla_days: number;
  needs_details: boolean;
};

export type ServiceRequest = {
  id: number;
  service_key: string;
  service_label: string;
  reference_no: string | null;
  subject: string;
  details: string | null;
  status: 'open' | 'in_progress' | 'resolved' | 'rejected' | 'cancelled';
  priority: 'low' | 'normal' | 'high';
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string | null;
};

export type UserSettings = {
  language: string;
  theme: string;
  calendar_type: string;
  timezone: string | null;
  date_format: string;
  profile_visibility: string;
  show_email: boolean;
  show_phone: boolean;
  digest_frequency: string;
};

export type SettingsOptions = {
  languages: string[];
  themes: string[];
  calendar_types: string[];
  date_formats: string[];
  profile_visibility: string[];
  digest_frequency: string[];
};

export default {
  /**
   * Replaces the call portalService.ts was already making. That route did not
   * exist in routes/api.php, so StudentPortalHomeScreen was failing on mount.
   */
  home: () => post<Record<string, any>>('student_portal_home'),

  documents: () =>
    post<{
      documents: StudentDocument[];
      document_types: string[];
      summary: { requested: number; issued: number; rejected: number };
    }>('student_document_list'),

  requestDocument: (document_type: string, purpose?: string, copies = 1) =>
    post<{ document: StudentDocument; message: string }>('student_document_request', {
      document_type,
      purpose,
      copies,
    }),

  cancelDocument: (document_id: number) =>
    post<{ message: string }>('student_document_cancel', { document_id }),

  services: () =>
    post<{
      services: ServiceDefinition[];
      requests: ServiceRequest[];
      summary: { open: number; in_progress: number; resolved: number };
    }>('student_service_catalog'),

  createServiceRequest: (body: {
    service_key: string;
    subject: string;
    details?: string;
    priority?: 'low' | 'normal' | 'high';
  }) => post<{ request: ServiceRequest; message: string }>('student_service_request_store', body),

  cancelServiceRequest: (request_id: number) =>
    post<{ message: string }>('student_service_request_cancel', { request_id }),

  settings: () => post<{ settings: UserSettings; options: SettingsOptions }>('user_settings_show'),

  saveSettings: (settings: Partial<UserSettings>) =>
    post<{ message: string }>('user_settings_save', settings),

  changePassword: (current_password: string, new_password: string) =>
    post<{ message: string }>('user_password_update', {
      current_password,
      new_password,
      new_password_confirmation: new_password,
    }),
};
