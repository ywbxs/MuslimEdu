import { API_BASE_URL } from '../config/api';

export class ApiClientError extends Error {
  status: number;
  code: 'network' | 'timeout' | 'unauthorized' | 'validation' | 'server' | 'unknown';
  details: unknown;

  constructor(
    message: string,
    status = 0,
    code: ApiClientError['code'] = 'unknown',
    details: unknown = null,
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type RequestOptions = {
  token?: string | null;
  body?: Record<string, unknown> | FormData;
  timeoutMs?: number;
  signal?: AbortSignal;
};

function messageFrom(data: any, status: number): string {
  if (typeof data?.message === 'string') return data.message;
  if (typeof data?.error === 'string') return data.error;
  if (data?.errors && typeof data.errors === 'object') {
    const first = Object.values(data.errors)[0];
    if (Array.isArray(first) && typeof first[0] === 'string') return first[0];
    if (typeof first === 'string') return first;
  }
  return status ? `Request failed (${status}).` : 'Request failed.';
}

async function readBody(response: Response): Promise<any> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: `Server returned a non-JSON response (status ${response.status}).` };
  }
}

export async function apiPost<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const body = options.body ?? {};
  const isFormData = body instanceof FormData;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 20000);

  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: isFormData ? body : JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await readBody(response);

    if (response.status === 401) {
      throw new ApiClientError(messageFrom(data, response.status), 401, 'unauthorized', data);
    }
    if (response.status === 422) {
      throw new ApiClientError(messageFrom(data, response.status), 422, 'validation', data);
    }
    if (response.status >= 500) {
      throw new ApiClientError(messageFrom(data, response.status), response.status, 'server', data);
    }
    if (!response.ok) {
      throw new ApiClientError(messageFrom(data, response.status), response.status, 'unknown', data);
    }
    return data as T;
  } catch (error) {
    if (error instanceof ApiClientError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiClientError('The request timed out. Try again.', 0, 'timeout');
    }
    throw new ApiClientError(
      'Could not reach the server. Check your connection and try again.',
      0,
      'network',
      error,
    );
  } finally {
    clearTimeout(timeout);
  }
}
