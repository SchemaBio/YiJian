import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import ConfigPage from './page';
import { listPipelines } from '@/lib/pipelines';
vi.mock('@/lib/pipelines', () => ({ listPipelines: vi.fn() }));
it('does not claim configuration is empty when reading fails and supports refresh', async () => {
  vi.mocked(listPipelines).mockRejectedValueOnce(new Error('配置读取失败')).mockResolvedValueOnce([]);
  render(<ConfigPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('配置读取失败');
  expect(screen.queryByText('暂无流程配置')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '刷新' }));
  await screen.findByText('暂无流程配置');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
