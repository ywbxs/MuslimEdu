import { useCallback, useEffect, useRef, useState } from 'react';

import type { ApiResult } from '../services/http/envelope';

interface UseApiResourceOptions {
  /** Skip the initial fetch, e.g. until a filter is chosen. */
  enabled?: boolean;
  /** Refetch when these change. */
  deps?: unknown[];
}

interface UseApiResourceState<T> {
  result: ApiResult<T> | null;
  loading: boolean;
  refreshing: boolean;
  reload: () => void;
  refresh: () => void;
}

/**
 * One hook for every API-backed screen (Phase F2/F3).
 * Guarantees a screen always has loading / data / empty / failure available.
 */
export function useApiResource<T>(
  fetcher: () => Promise<ApiResult<T>>,
  { enabled = true, deps = [] }: UseApiResourceOptions = {}
): UseApiResourceState<T> {
  const [result, setResult] = useState<ApiResult<T> | null>(null);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);
  const fetcherRef = useRef(fetcher);

  fetcherRef.current = fetcher;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const next = await fetcherRef.current();

    if (!mounted.current) return;

    setResult(next);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    void run(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, run, ...deps]);

  return {
    result,
    loading,
    refreshing,
    reload: useCallback(() => void run(false), [run]),
    refresh: useCallback(() => void run(true), [run]),
  };
}
