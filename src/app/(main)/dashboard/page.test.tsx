import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import DashboardPage from './page';
import { api } from '@/lib/api';
import { tasksApi } from '@/lib/tasks';

vi.mock('@/components/providers/AuthProvider', () => ({ useAuth: () => ({ user: { name: '示例用户' } }) }));
vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }));
vi.mock('@/lib/tasks', () => ({ tasksApi: { list: vi.fn(), getStats: vi.fn() } }));

it('does not turn unavailable dashboard data into zero-count hints or an empty task list', async () => {
  vi.mocked(api.get).mockRejectedValue(new Error('stats unavailable'));
  vi.mocked(tasksApi.list).mockRejectedValue(new Error('tasks unavailable'));
  vi.mocked(tasksApi.getStats).mockRejectedValue(new Error('metrics unavailable'));
  render(<DashboardPage />);
  await screen.findByRole('alert');
  expect(screen.queryByText('0 个等待数据')).not.toBeInTheDocument();
  expect(screen.queryByText('0 个发生于 24 小时内')).not.toBeInTheDocument();
  expect(screen.queryByText('暂无任务')).not.toBeInTheDocument();
  expect(screen.getByText('最近任务暂不可用')).toBeInTheDocument();
});
