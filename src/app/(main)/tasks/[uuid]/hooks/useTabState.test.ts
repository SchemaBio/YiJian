import { renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useTabState } from './useTabState';

const mocks = vi.hoisted(() => ({ params: undefined as URLSearchParams | undefined, push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }), useSearchParams: () => mocks.params }));

it('restores exclusions and ranges from the URL and retains them when switching tabs', () => {
  const filters = [{ column: 'Gene', operator: 'not_contains', value: 'BRCA' }, { column: 'Position', operator: 'between', value: ['100', '200'] }];
  mocks.params = new URLSearchParams({ tab: 'snv-indel', columnFilters: JSON.stringify(filters) });
  const { result } = renderHook(() => useTabState('task'));
  expect(result.current.getFilterState('snv-indel').columnFilters).toEqual(filters);
  result.current.setActiveTab('snv-indel');
  const url = new URL(mocks.push.mock.calls.at(-1)![0], 'https://example.test');
  expect(JSON.parse(url.searchParams.get('columnFilters')!)).toEqual(filters);
});
