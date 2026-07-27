/**
 * Typed API envelope - Phase F1 / F2 / F3.
 *
 * Every call resolves to an ApiResult. Nothing throws, so no screen can
 * accidentally render a crash instead of a state.
 */

export type ApiFailureKind =
  | 'validation'
  | 'unauthenticated'
  | 'forbidden'
  | 'notFound'
  | 'conflict'
  | 'throttled'
  | 'server'
  | 'offline'
  | 'unknown';

export interface ApiMeta {
  page?: number;
  perPage?: number;
  total?: number;
  lastPage?: number;
  empty?: boolean;
}

export interface ApiSuccess<T> {
  status: 'success';
  data: T;
  meta?: ApiMeta;
}

/** A successful response that carried no rows. NOT an error. */
export interface ApiEmpty {
  status: 'empty';
  data: [];
  meta?: ApiMeta;
}

export interface ApiFailure {
  status: 'failure';
  kind: ApiFailureKind;
  httpStatus: number | null;
  code: string | null;
  message: string;
  fieldErrors?: Record<string, string[]>;
  retryable: boolean;
  retryAfterMs?: number;
}

export type ApiResult<T> = ApiSuccess<T> | ApiEmpty | ApiFailure;

export const isSuccess = <T>(result: ApiResult<T>): result is ApiSuccess<T> =>
  result.status === 'success';

export const isEmpty = <T>(result: ApiResult<T>): result is ApiEmpty =>
  result.status === 'empty';

export const isFailure = <T>(result: ApiResult<T>): result is ApiFailure =>
  result.status === 'failure';

export const FAILURE_COPY: Record<ApiFailureKind, string> = {
  validation: 'Please check the highlighted fields and try again.',
  unauthenticated: 'Your session expired. Sign in again.',
  forbidden: 'You do not have permission to view this.',
  notFound: 'This record no longer exists.',
  conflict: 'This change conflicts with existing data.',
  throttled: 'Too many requests. Give it a moment.',
  server: 'Something broke on our side. Try again.',
  offline: 'No connection. Check your network and retry.',
  unknown: 'Unexpected error. Try again.',
};
