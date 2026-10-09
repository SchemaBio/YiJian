import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import NewAnalysisPage from './page';
import { samplesApi } from '@/lib/task-resources';
import { listPedigrees, getPedigree } from '@/lib/pedigrees';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/components/providers/AuthProvider', () => ({ useAuth: () => ({}) }));
vi.mock('@/lib/runtime-config', () => ({ getRuntimeBackendFlavor: () => 'octopus' }));
vi.mock('@/lib/task-resources', () => ({
  samplesApi: { list: vi.fn(async () => []) },
  pipelinesApi: { list: vi.fn(async () => [
    { id: 'single', name: '单样本', baseType: 'wes_single' },
    { id: 'trio', name: '家系', baseType: 'wes_family' },
  ]) },
}));
vi.mock('@/lib/pedigrees', () => ({
  listPedigrees: vi.fn(async () => [{ id: 'family' }]),
  getPedigree: vi.fn(async () => ({ id: 'family', internalId: 'FAM-1', members: [], probandId: '' })),
}));
vi.mock('@schema/ui-kit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@schema/ui-kit')>();
  return { ...actual, Select: ({ options, value, onChange, placeholder }: any) => (
    <select aria-label={placeholder} value={value} onChange={event => onChange(event.target.value)}>
      <option value="">{placeholder}</option>
      {options.map((option: any) => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
    </select>
  ) };
});

it('loads family details only for a family workflow and reuses them when switching back', async () => {
  render(<NewAnalysisPage />);
  const pipeline = await screen.findByRole('combobox', { name: '选择分析流程' });
  await waitFor(() => expect(pipeline).toHaveValue('single'));
  expect(listPedigrees).not.toHaveBeenCalled();
  expect(getPedigree).not.toHaveBeenCalled();
  fireEvent.change(pipeline, { target: { value: 'trio' } });
  await screen.findByRole('option', { name: 'FAM-1（家系不完整）' });
  expect(listPedigrees).toHaveBeenCalledTimes(1);
  expect(getPedigree).toHaveBeenCalledWith('family');
  fireEvent.change(pipeline, { target: { value: 'single' } });
  fireEvent.change(pipeline, { target: { value: 'trio' } });
  await screen.findByRole('option', { name: 'FAM-1（家系不完整）' });
  expect(listPedigrees).toHaveBeenCalledTimes(1);
  expect(getPedigree).toHaveBeenCalledTimes(1);
});

it('provides a retry after task resources fail to load', async () => {
  vi.mocked(samplesApi.list).mockRejectedValueOnce(new Error('样本选项读取失败'));
  render(<NewAnalysisPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('样本选项读取失败');
  fireEvent.click(screen.getByRole('button', { name: '重试读取' }));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  await waitFor(() => expect(screen.getByRole('combobox', { name: '选择分析流程' })).toHaveValue('single'));
});

it('retries family reads without losing the selected workflow', async () => {
  vi.mocked(listPedigrees).mockRejectedValueOnce(new Error('家系读取失败'));
  render(<NewAnalysisPage />);
  const pipeline = await screen.findByRole('combobox', { name: '选择分析流程' });
  await waitFor(() => expect(pipeline).toHaveValue('single'));
  fireEvent.change(pipeline, { target: { value: 'trio' } });
  expect(await screen.findByRole('alert')).toHaveTextContent('家系读取失败');
  fireEvent.click(screen.getByRole('button', { name: '重试读取' }));
  await screen.findByRole('option', { name: 'FAM-1（家系不完整）' });
  expect(pipeline).toHaveValue('trio');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
