import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { DataLinkModal } from './DataLinkModal';
import { listDataAssets, type DataAsset } from '@/lib/data-assets';
import { getSampleDataLink, bindSampleDataAssets } from '@/lib/samples';
import type { Sample } from '../types';

vi.mock('@/lib/data-assets', () => ({ listDataAssets: vi.fn() }));
vi.mock('@/lib/samples', () => ({ getSampleDataLink: vi.fn(), bindSampleDataAssets: vi.fn(), clearSampleMatchedPair: vi.fn() }));
vi.mock('@/components/shared', () => ({ AppModal: ({ open, children, footer }: any) => open ? <div>{children}{footer}</div> : null, ModalSectionHeading: () => null }));
const sample = { id: 'sample-a', internalId: 'CASE-1', matchedPair: { r1Path: 'private/a', r2Path: 'private/b' } } as Sample;
const file = (id: string, read_type: 'read1' | 'read2'): DataAsset => ({ id, read_type, file_name: `${id}.fastq.gz`, file_size: 1024, status: 'completed', provider: 's3', source: 'upload', created_at: '', updated_at: '' });
const r1 = file('linked-r1', 'read1'), r2 = file('linked-r2', 'read2');
beforeEach(() => vi.resetAllMocks());

it('loads all pages, preselects exact linked files and saves their UUIDs', async () => {
  vi.mocked(listDataAssets).mockResolvedValueOnce({ items: [file('other-r1', 'read1')], total_pages: 2 } as any).mockResolvedValueOnce({ items: [r1, r2], total_pages: 2 } as any);
  vi.mocked(getSampleDataLink).mockResolvedValue({ read1: r1, read2: r2, unavailable: false });
  const saved = vi.fn(), close = vi.fn();
  render(<DataLinkModal open sample={sample} onSaved={saved} onOpenChange={close} />);
  const select = await screen.findByLabelText('Read1');
  expect(select).toHaveValue(r1.id);
  expect(screen.getByLabelText('Read2')).toHaveValue(r2.id);
  expect(listDataAssets).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole('button', { name: '保存手动关联' }));
  await act(async () => {});
  expect(bindSampleDataAssets).toHaveBeenCalledWith(sample.id, r1.id, r2.id);
  expect(saved).toHaveBeenCalledOnce();
  expect(close).toHaveBeenCalledWith(false);
});

it('isolates late results after switching samples', async () => {
  let resolveA!: (value: any) => void;
  vi.mocked(getSampleDataLink).mockReturnValueOnce(new Promise(resolve => { resolveA = resolve; })).mockResolvedValueOnce({ read1: null, read2: null, unavailable: false });
  vi.mocked(listDataAssets).mockResolvedValue({ items: [r1, r2], total_pages: 1 } as any);
  const props = { onSaved: vi.fn(), onOpenChange: vi.fn() };
  const { rerender } = render(<DataLinkModal open sample={sample} {...props} />);
  rerender(<DataLinkModal open sample={{ ...sample, id: 'sample-b', matchedPair: null }} {...props} />);
  await screen.findByLabelText('Read1');
  await act(async () => resolveA({ read1: r1, read2: r2, unavailable: false }));
  expect(screen.getByLabelText('Read1')).toHaveValue('');
  expect(screen.getByRole('button', { name: '保存手动关联' })).toBeDisabled();
});

it('does not select unavailable files', async () => {
  vi.mocked(listDataAssets).mockResolvedValue({ items: [r1, r2], total_pages: 1 } as any);
  vi.mocked(getSampleDataLink).mockResolvedValue({ read1: null, read2: null, unavailable: true });
  render(<DataLinkModal open sample={sample} onSaved={vi.fn()} onOpenChange={vi.fn()} />);
  expect(await screen.findByRole('status')).toHaveTextContent('原关联文件已到期或不可访问');
  expect(screen.getByRole('button', { name: '保存手动关联' })).toBeDisabled();
});

it('blocks save if reading the existing relationship fails', async () => {
  vi.mocked(listDataAssets).mockResolvedValue({ items: [r1, r2], total_pages: 1 } as any);
  vi.mocked(getSampleDataLink).mockRejectedValue(new Error('读取关联失败'));
  render(<DataLinkModal open sample={sample} onSaved={vi.fn()} onOpenChange={vi.fn()} />);
  await screen.findByText('读取关联失败');
  expect(screen.getByRole('button', { name: '保存手动关联' })).toBeDisabled();
  expect(bindSampleDataAssets).not.toHaveBeenCalled();
});
