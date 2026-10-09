import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import TemplatesPage from './page';
import { api } from '@/lib/api';
vi.mock('@/components/providers/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'user' }, currentOrg: { id: 'org' } }) }));
vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }));
it('distinguishes template-read failure from missing configuration and recovers', async () => {
  vi.mocked(api.get).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([]);
  render(<TemplatesPage />);
  await screen.findByRole('alert');
  expect(screen.queryByText('尚未配置报告服务')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '重试读取' }));
  await screen.findByText('尚未配置报告服务');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
