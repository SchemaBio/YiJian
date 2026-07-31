'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseApiOptions {
  /** Whether to fetch immediately on mount (default: true) */
  immediate?: boolean;
}

interface UseApiResult<T> {
  /** The fetched data */
  data: T | null;
  /** Whether the request is in progress */
  loading: boolean;
  /** Error message if the request failed */
  error: string | null;
  /** Trigger a refetch */
  refetch: () => void;
}

/**
 * Generic data-fetching hook with loading/error states.
 * Replaces manual useEffect + fetch patterns.
 *
 * @example
 * const { data: tasks, loading, error, refetch } = useApi(
 *   () => tasksApi.list({ page: '1' }),
 *   { immediate: true }
 * );
 */
export function useApi<T>(
  fetcher: () => Promise<T>,
  options: UseApiOptions = {}
): UseApiResult<T> {
  const { immediate = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      if (!cancelledRef.current) {
        setData(result);
      }
    } catch (err) {
      if (!cancelledRef.current) {
        setError(err instanceof Error ? err.message : '请求失败');
      }
    } finally {
      if (!cancelledRef.current) {
        setLoading(false);
      }
    }
  }, [fetcher]);

  useEffect(() => {
    cancelledRef.current = false;
    if (immediate) {
      fetchData();
    }
    return () => {
      cancelledRef.current = true;
    };
  }, [fetchData, immediate]);

  return { data, loading, error, refetch: fetchData };
}

interface UsePollingOptions<T> {
  /** Whether polling is enabled (default: true) */
  enabled?: boolean;
  /** Whether to fetch immediately on mount (default: true) */
  immediate?: boolean;
  /** Return true to preserve the previous data reference when a poll is unchanged. */
  isEqual?: (previous: T, next: T) => boolean;
}

interface UsePollingResult<T> {
  /** The fetched data */
  data: T | null;
  /** Whether the request is in progress */
  loading: boolean;
  /** Error message if the request failed */
  error: string | null;
  /** Trigger a manual refetch */
  refetch: () => void;
  /** Whether polling is active */
  isPolling: boolean;
}

/**
 * Polling variant of useApi.
 * Auto-fetches at the specified interval when enabled.
 *
 * @example
 * const { data: tasks, isPolling } = usePolling(
 *   () => tasksApi.list({ page: '1' }),
 *   10000,
 *   { enabled: hasRunningTasks }
 * );
 */
export function usePolling<T>(
  fetcher: () => Promise<T>,
  intervalMs: number,
  options: UsePollingOptions<T> = {}
): UsePollingResult<T> {
  const { enabled = true, immediate = true, isEqual } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState<string | null>(null);
  const dataRef = useRef<T | null>(null);
  const mountedRef = useRef(false);
  const requestSequenceRef = useRef(0);

  const fetchData = useCallback(async () => {
    const requestSequence = ++requestSequenceRef.current;
    if (dataRef.current === null) {
      setLoading(true);
    }
    setError(null);
    try {
      const result = await fetcher();
      if (mountedRef.current && requestSequence === requestSequenceRef.current) {
        setData((previous) => {
          if (previous !== null && isEqual?.(previous, result)) {
            return previous;
          }
          dataRef.current = result;
          return result;
        });
      }
    } catch (err) {
      if (mountedRef.current && requestSequence === requestSequenceRef.current) {
        setError(err instanceof Error ? err.message : '请求失败');
      }
    } finally {
      if (mountedRef.current && requestSequence === requestSequenceRef.current) {
        setLoading(false);
      }
    }
  }, [fetcher, isEqual]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestSequenceRef.current += 1;
    };
  }, []);

  // Initial fetch
  useEffect(() => {
    if (immediate) {
      void fetchData();
    }
  }, [fetchData, immediate]);

  // Polling logic
  useEffect(() => {
    if (!enabled) return;
    const interval = window.setInterval(() => void fetchData(), intervalMs);

    return () => {
      window.clearInterval(interval);
    };
  }, [enabled, intervalMs, fetchData]);

  return { data, loading, error, refetch: fetchData, isPolling: enabled };
}
