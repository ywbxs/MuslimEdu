import { API_BASE_URL } from '../config/api';

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

export interface RegistrarAccount {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  code: string | null;
  status: number;
}

/** POST /admin_registrar_list - admin-only: every Registrar account in the school. */
export async function fetchRegistrarAccounts(token: string): Promise<RegistrarAccount[]> {
  const data = await authedPost('/admin_registrar_list', token);
  return (data.registrars ?? []) as RegistrarAccount[];
}

export interface AddRegistrarInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
  address?: string;
}

export interface AddedRegistrar {
  id: number;
  name: string;
  email: string | null;
  code: string | null;
}

/** POST /admin_registrar_admission_single - admin creates a new Registrar account. */
export async function addRegistrar(token: string, input: AddRegistrarInput): Promise<AddedRegistrar> {
  const data = await authedPost('/admin_registrar_admission_single', token, { ...input });
  const record = data.registrar ?? data.data?.registrar ?? data.data ?? data;
  return record as AddedRegistrar;
}
