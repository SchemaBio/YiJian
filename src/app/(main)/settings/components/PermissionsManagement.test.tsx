import * as React from 'react';
import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { PermissionsManagement } from './PermissionsManagement';
import { createUser, deleteUser, listUsers } from '@/lib/users';
vi.mock('@/lib/users', () => ({ createUser: vi.fn(), listUsers: vi.fn(), listPendingUsers: vi.fn(async () => []), approveUser: vi.fn(), rejectUser: vi.fn(), updateUser: vi.fn(), deleteUser: vi.fn() }));
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

it('keeps creation errors and form values in the dialog, then refreshes after success', async () => {
  vi.mocked(listUsers).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 100, totalPages: 1 });
  vi.mocked(createUser).mockRejectedValueOnce(new Error('password is too common')).mockResolvedValueOnce({ id: 'new', name: 'New user', email: 'new@example.invalid', systemRole: 'ORG_USER', isActive: true, createdAt: '', updatedAt: '' });
  render(<PermissionsManagement />);
  await screen.findByText('暂无用户');
  fireEvent.click(screen.getByRole('button', { name: '创建账户' }));
  const dialog = screen.getByRole('dialog', { name: '创建账户' });
  for (const [label, value] of [['姓名', 'New user'], ['邮箱', 'new@example.invalid'], ['初始密码', 'Example!Pass2026']]) {
    fireEvent.change(within(dialog).getByLabelText(label), { target: { value } });
  }
  fireEvent.submit(document.getElementById('create-platform-user')!);
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('密码过于常见，请设置更安全的密码。');
  expect(within(dialog).getByLabelText('邮箱')).toHaveValue('new@example.invalid');
  fireEvent.submit(document.getElementById('create-platform-user')!);
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(createUser).toHaveBeenLastCalledWith({ name: 'New user', email: 'new@example.invalid', password: 'Example!Pass2026', permissions: [], systemRole: 'ORG_USER' });
});

it('disables self deletion while allowing deletion of another account', async () => {
  const base = { name: 'User', email: 'user@example.invalid', systemRole: 'ORG_USER' as const, isActive: true, createdAt: '', updatedAt: '' };
  vi.mocked(listUsers).mockResolvedValue({ items: [{ ...base, id: 'admin', name: 'Administrator', systemRole: 'PLATFORM_ADMIN' }, { ...base, id: 'other' }], total: 2, page: 1, pageSize: 100, totalPages: 1 });
  render(<PermissionsManagement currentUserId="admin" />);
  const ownDelete = await screen.findByRole('button', { name: '平台管理员不能删除自身。' });
  expect(ownDelete).toBeDisabled();
  fireEvent.click(ownDelete);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(deleteUser).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '删除' }));
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
});
