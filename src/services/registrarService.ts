import { API_BASE_URL, absoluteUrl } from '../config/api';

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
  name_ar?: string | null;
  email: string;
  phone: string | null;
  photo?: string | null;
  code: string | null;
  status: number;
}

/** POST /admin_registrar_list - admin-only: every Registrar account in the school. */
export async function fetchRegistrarAccounts(token: string): Promise<RegistrarAccount[]> {
  const data = await authedPost('/admin_registrar_list', token);
  return (data.registrars ?? []) as RegistrarAccount[];
}

export interface RegistrarProfile {
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

/** POST /admin_registrar_profile - a single registrar's full profile info. */
export async function fetchRegistrarProfile(token: string, registrarId: number): Promise<RegistrarProfile> {
  const data = await authedPost('/admin_registrar_profile', token, { registrar_id: registrarId });
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

export interface AddRegistrarInput {
  name: string;
  name_ar?: string;
  email: string;
  password: string;
  phone?: string;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
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
