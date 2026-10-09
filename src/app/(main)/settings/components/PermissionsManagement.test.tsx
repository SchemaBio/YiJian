import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { PermissionsManagement } from './PermissionsManagement';
import { listUsers } from '@/lib/users';
vi.mock('@/lib/users', () => ({ listUsers: vi.fn(), listPendingUsers: vi.fn(async () => []), approveUser: vi.fn(), rejectUser: vi.fn(), updateUser: vi.fn(), deleteUser: vi.fn() }));
it('shows a read failure without claiming there are no users and recovers on refresh', async () => {
  vi.mocked(listUsers).mockRejectedValueOnce(new Error('用户读取失败')).mockResolvedValueOnce({ items: [], total: 0, page: 1, pageSize: 100, totalPages: 1 });
  render(<PermissionsManagement />);
  expect(await screen.findByRole('alert')).toHaveTextContent('用户读取失败');
  expect(screen.queryByText('暂无用户')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '刷新' }));
  await screen.findByText('暂无用户');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(listUsers).toHaveBeenCalledTimes(2);
});
