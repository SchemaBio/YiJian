'use client';

import { useEffect } from 'react';
import { preloadBrowserParquet } from '@/lib/parquet-browser';
import type { ResultContext } from '../types';

export function useVariantPreload(taskId: string, context: ResultContext | null, enabled: boolean) {
  const ready = enabled && context?.taskUuid === taskId && context.state === 'ready'
    && context.parquet?.available === true && context.parquet.tables.includes('snv-indel');

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    // Opening the shared dataset also prepares automatic assessments and saved
    // adjustments. The tab can join an in-flight preload without downloading it
    // again. Failures stay local to the preload; opening the tab retries normally.
    void preloadBrowserParquet(taskId, 'snv-indel', controller.signal).catch(() => undefined);
    return () => controller.abort();
  }, [taskId, ready, context?.executionAttemptId, context?.version, context?.importBatchId]);
}
