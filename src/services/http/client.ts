import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
} from 'axios';

import {
  type ApiFailureKind,
  type ApiMeta,
  type ApiResult,
  FAILURE_COPY,
} from './envelope';

export interface ApiClientOptions {
  baseURL: string;
  timeoutMs?: number;
  getToken: () => Promise<string | null> | string | null;
  /** Called once on any 401 so the app can clear the session. */
  onUnauthenticated?: () => void;
}

interface BackendEnvelope<T> {
  success?: boolean;
  data?: T;
  meta?: Record<string, unknown>;
  message?: string;
  code?: string;
  errors?: Record<string, string[]>;
}

const kindFor = (httpStatus: number | null): ApiFailureKind => {
  if (httpStatus === null) return 'offline';
  if (httpStatus === 401) return 'unauthenticated';
  if (httpStatus === 403) return 'forbidden';
  if (httpStatus === 404) return 'notFound';
  if (httpStatus === 409) return 'conflict';
  if (httpStatus === 422) return 'validation';
  if (httpStatus === 429) return 'throttled';
  if (httpStatus >= 500) return 'server';
  return 'unknown';
};

const retryableKinds: ApiFailureKind[] = ['offline', 'throttled', 'server'];

const normaliseMeta = (meta?: Record<string, unknown>): ApiMeta | undefined => {
  if (!meta) return undefined;

  return {
    page: typeof meta.page === 'number' ? meta.page : undefined,
    perPage: typeof meta.per_page === 'number' ? meta.per_page : undefined,
    total: typeof meta.total === 'number' ? meta.total : undefined,
    lastPage: typeof meta.last_page === 'number' ? meta.last_page : undefined,
    empty: typeof meta.empty === 'boolean' ? meta.empty : undefined,
  };
};

const retryAfterMs = (response?: AxiosResponse): number | undefined => {
  const header = response?.headers?.['retry-after'];
  if (!header) return undefined;
  const seconds = Number(header);
  return Number.isFinite(seconds) ? seconds * 1000 : undefined;
};

export class ApiClient {
  private readonly http: AxiosInstance;

  private readonly options: ApiClientOptions;

  constructor(options: ApiClientOptions) {
    this.options = options;
    this.http = axios.create({
      baseURL: options.baseURL,
      timeout: options.timeoutMs ?? 15000,
      headers: { Accept: 'application/json' },
      // Never throw on status: the mapper owns every outcome.
      validateStatus: () => true,
    });
  }

  async request<T>(config: AxiosRequestConfig): Promise<ApiResult<T>> {
    let response: AxiosResponse<BackendEnvelope<T> | T> | undefined;

    try {
      const token = await this.options.getToken();

      response = await this.http.request({
        ...config,
        headers: {
          ...config.headers,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    } catch (error) {
      const axiosError = error as AxiosError;

      // No response at all: transport failure, treat as offline and retryable.
      return {
        status: 'failure',
        kind: 'offline',
        httpStatus: null,
        code: axiosError.code ?? null,
        message: FAILURE_COPY.offline,
        retryable: true,
      };
    }

    const httpStatus = response.status;
    const body = response.data as BackendEnvelope<T> | T | undefined;

    if (httpStatus >= 200 && httpStatus < 300) {
      const envelope = (body ?? {}) as BackendEnvelope<T>;
      const hasEnvelope =
        typeof envelope === 'object' && envelope !== null && 'success' in envelope;
      const payload = (hasEnvelope ? envelope.data : (body as T)) as T;
      const meta = hasEnvelope ? normaliseMeta(envelope.meta) : undefined;

      // An empty collection is a state, not a failure.
      if (Array.isArray(payload) && payload.length === 0) {
        return { status: 'empty', data: [], meta };
      }

      return { status: 'success', data: payload, meta };
    }

    const errorBody = (body ?? {}) as BackendEnvelope<T>;
    const kind = kindFor(httpStatus);

    if (kind === 'unauthenticated') {
      this.options.onUnauthenticated?.();
    }

    return {
      status: 'failure',
      kind,
      httpStatus,
      code: errorBody.code ?? null,
      message: errorBody.message ?? FAILURE_COPY[kind],
      fieldErrors: errorBody.errors,
      retryable: retryableKinds.includes(kind),
      retryAfterMs: retryAfterMs(response),
    };
  }

  get<T>(url: string, config: AxiosRequestConfig = {}): Promise<ApiResult<T>> {
    return this.request<T>({ ...config, method: 'GET', url });
  }

  post<T>(url: string, data?: unknown, config: AxiosRequestConfig = {}): Promise<ApiResult<T>> {
    return this.request<T>({ ...config, method: 'POST', url, data });
  }

  put<T>(url: string, data?: unknown, config: AxiosRequestConfig = {}): Promise<ApiResult<T>> {
    return this.request<T>({ ...config, method: 'PUT', url, data });
  }

  patch<T>(url: string, data?: unknown, config: AxiosRequestConfig = {}): Promise<ApiResult<T>> {
    return this.request<T>({ ...config, method: 'PATCH', url, data });
  }

  delete<T>(url: string, config: AxiosRequestConfig = {}): Promise<ApiResult<T>> {
    return this.request<T>({ ...config, method: 'DELETE', url });
  }
}
