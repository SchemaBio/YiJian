import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { LinkSampleModal } from './LinkSampleModal';
import { listSamples } from '@/lib/samples';
import type { Sample } from '../../types';

vi.mock('@/lib/samples', () => ({ listSamples: vi.fn() }));

it('recovers from a sample-list failure and disables duplicate selections during linking', async () => {
  const sample: Sample = {
    id: 'sample-1', internalId: 'DEMO-样本', gender: 'unknown', sampleType: '全血',
    batch: '', clinicalDiagnosis: '', hpoTerms: [], matchedPair: null,
    matchStatus: 'unmatched', matchMode: '', autoMatchEnabled: false,
    remark: '', createdAt: '', updatedAt: '',
  };
  vi.mocked(listSamples).mockRejectedValueOnce(new Error('读取失败')).mockResolvedValueOnce([sample]);
  let finishLink!: () => void;
  const onSelect = vi.fn(() => new Promise<void>(resolve => { finishLink = resolve; }));
  const onClose = vi.fn();
  render(<LinkSampleModal isOpen memberName="成员" onClose={onClose} onSelect={onSelect} />);
  fireEvent.click(await screen.findByRole('button', { name: '重试' }));
  const choice = await screen.findByRole('button', { name: /DEMO-样本/ });
  expect(listSamples).toHaveBeenCalledTimes(2);
  fireEvent.click(choice);
  expect(choice).toBeDisabled();
  fireEvent.click(choice);
  expect(onSelect).toHaveBeenCalledTimes(1);
  expect(onClose).not.toHaveBeenCalled();
  finishLink();
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
});
