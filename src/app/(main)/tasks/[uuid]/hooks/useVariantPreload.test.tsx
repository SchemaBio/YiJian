import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { preloadBrowserParquet } from '@/lib/parquet-browser';
import type { ResultContext } from '../types';
import { useVariantPreload } from './useVariantPreload';

vi.mock('@/lib/parquet-browser', () => ({ preloadBrowserParquet: vi.fn() }));
const context: ResultContext = {
  taskUuid: 'task', executionAttemptId: 'attempt', version: 'v1', state: 'ready', importStatus: 'success',
  reference: { available: true }, members: [], types: {}, qc: [], permissions: { canReview: true, canFocus: true },
  parquet: { available: true, tables: ['snv-indel'], preparedTables: ['snv-indel'] },
};

beforeEach(() => { vi.mocked(preloadBrowserParquet).mockResolvedValue(undefined); });
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it('starts loading from overview and ignores unchanged context polls', () => {
  const { rerender } = renderHook(({ value }) => useVariantPreload('task', value, true), { initialProps: { value: context } });
  expect(preloadBrowserParquet).toHaveBeenCalledWith('task', 'snv-indel', expect.any(AbortSignal));
  rerender({ value: { ...context, types: { 'snv-indel': { total: 10, reviewed: 0, focused: 0 } } } });
  expect(preloadBrowserParquet).toHaveBeenCalledTimes(1);
});

it('waits for ready readable results belonging to the current task', () => {
  const { rerender } = renderHook(({ value, enabled }) => useVariantPreload('task', value, enabled), { initialProps: { value: context, enabled: false } });
  rerender({ value: { ...context, state: 'importing' }, enabled: true });
  rerender({ value: { ...context, taskUuid: 'previous-task' }, enabled: true });
  rerender({ value: { ...context, parquet: { ...context.parquet!, available: false } }, enabled: true });
  rerender({ value: { ...context, parquet: { ...context.parquet!, tables: ['cnv-exon'] } }, enabled: true });
  expect(preloadBrowserParquet).not.toHaveBeenCalled();
  rerender({ value: context, enabled: true });
  expect(preloadBrowserParquet).toHaveBeenCalledTimes(1);
});

it('restarts for a new result version and releases the caller on tab switch or unmount', () => {
  const { rerender, unmount } = renderHook(({ value, enabled }) => useVariantPreload('task', value, enabled), { initialProps: { value: context, enabled: true } });
  const first = vi.mocked(preloadBrowserParquet).mock.calls[0][2]!;
  rerender({ value: { ...context, executionAttemptId: 'retry', version: 'v2' }, enabled: true });
  expect(first.aborted).toBe(true);
  expect(preloadBrowserParquet).toHaveBeenCalledTimes(2);
  const second = vi.mocked(preloadBrowserParquet).mock.calls[1][2]!;
  rerender({ value: { ...context, executionAttemptId: 'retry', version: 'v2' }, enabled: false });
  expect(second.aborted).toBe(true);
  unmount();
});

it('keeps background failures from blocking overview or future retries', async () => {
  vi.mocked(preloadBrowserParquet).mockRejectedValueOnce(new Error('temporary download failure'));
  const first = renderHook(() => useVariantPreload('task', context, true));
  await Promise.resolve();
  first.unmount();
  renderHook(() => useVariantPreload('task', context, true));
  expect(preloadBrowserParquet).toHaveBeenCalledTimes(2);
});
