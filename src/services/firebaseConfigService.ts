import { API_BASE_URL } from '../config/api';

/**
 * Superadmin-only screen to configure the credentials the BACKEND uses to
 * actually send Firebase Cloud Messaging pushes (via the FCM HTTP v1 API's
 * Admin SDK). This is separate from, and cannot replace, the CLIENT app's
 * own Firebase project file (google-services.json) - that's a native build
 * asset baked into the APK at build time, not something a running app can
 * change; see android-config/README.md for how to update it. This screen
 * only manages the server-side sending credentials.
 *
 * Backend contract (routes do not exist yet - ship frontend, document
 * contract, same convention used throughout this app):
 *   POST /superadmin_firebase_config_get   (superadmin, {}) -> FirebaseConfig
 *     - service_account_json is never returned once saved (write-only),
 *       only `configured: true` + the non-secret fields
 *   POST /superadmin_firebase_config_save  (superadmin, FirebaseConfigInput) -> FirebaseConfig
 *   POST /superadmin_firebase_config_test  (superadmin, { title, body }) -> { sent: number }
 *     - sends a real test push to every device the calling superadmin has
 *       registered (see notificationService.ts's registerDeviceForPush),
 *       so they can confirm the credentials actually work end to end
 */
const DEFAULT_TIMEOUT_MS = 15000;

export interface FirebaseConfig {
  configured: boolean;
  project_id: string;
  sender_id: string;
  updated_at: string | null;
}

export interface FirebaseConfigInput {
  project_id: string;
  sender_id: string;
  service_account_json: string;
}

async function authedPost(path: string, token: string, body: Record<string, any> = {}) {
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

export async function fetchFirebaseConfig(token: string): Promise<FirebaseConfig> {
  const data = await authedPost('/superadmin_firebase_config_get', token);
  return {
    configured: !!data.configured,
    project_id: data.project_id ?? '',
    sender_id: data.sender_id ?? '',
    updated_at: data.updated_at ?? null,
  };
}

export async function saveFirebaseConfig(token: string, input: FirebaseConfigInput): Promise<FirebaseConfig> {
  const data = await authedPost('/superadmin_firebase_config_save', token, input);
  return {
    configured: !!data.configured,
    project_id: data.project_id ?? input.project_id,
    sender_id: data.sender_id ?? input.sender_id,
    updated_at: data.updated_at ?? null,
  };
}

export async function sendTestNotification(token: string, title: string, body: string): Promise<number> {
  const data = await authedPost('/superadmin_firebase_config_test', token, { title, body });
  return typeof data.sent === 'number' ? data.sent : 0;
}
