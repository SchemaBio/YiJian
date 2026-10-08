import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import SampleDetailPage from './page';
import { getSampleDetail } from '@/lib/samples';

vi.mock('next/navigation', () => ({ useParams: () => ({ uuid: 'sample-1' }), useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/samples', () => ({ getSampleDetail: vi.fn() }));

it('shows a retryable load failure rather than a false missing-sample message', async () => {
  vi.mocked(getSampleDetail).mockRejectedValueOnce(new Error('network unavailable')).mockResolvedValueOnce({
    id: 'sample-1', internalId: '示例样本', gender: 'unknown', matchedPair: null,
    sampleType: '全血', createdAt: '', updatedAt: '',
  } as any);
  render(<SampleDetailPage />);
  await screen.findByRole('heading', { name: '加载样本失败' });
  expect(screen.queryByText('未找到该样本')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '重试' }));
  await screen.findByRole('heading', { name: '示例样本' });
  expect(getSampleDetail).toHaveBeenCalledTimes(2);
});
