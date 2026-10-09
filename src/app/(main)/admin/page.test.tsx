import * as React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import AdminPage from './page';
import { provisionOrganization, updateAdminOrganization, getAdminStats } from '@/lib/admin';

const fixtures = vi.hoisted(() => ({
  org: { id: 'org-1', name: '示例机构', slug: 'demo', max_concurrent_tasks: 5, balance_alert_threshold: 100, storage_quota_bytes: 0, is_active: true },
  stats: { organizations: { total: 1, active: 1, suspended: 0 }, tasks: { running: 0, completed: 0, failed: 0, today_created: 0, today_finished: 0 }, credits: { total_consumed_today: 0, total_consumed_month: 0, total_recharged_today: 0, total_recharged_month: 0, orgs_low_balance: 0 }, top_orgs: [], recent_tasks: [] },
}));
vi.mock('@/components/providers/AuthProvider', () => ({ useAuth: () => ({ isLoading: false, isPlatformAdmin: adminAllowed }), }));
const adminAllowed = () => true;
vi.mock('@/lib/crypto', () => ({ hashPassword: vi.fn().mockResolvedValue('synthetic-hash') }));
vi.mock('@/lib/admin', () => ({
  getAdminStats: vi.fn(async () => fixtures.stats), getBalanceAlerts: vi.fn(async () => []),
  listAdminOrganizations: vi.fn(async () => [fixtures.org]),
  getAdminBillingConfig: vi.fn(async () => ({ credits_per_minute: 1, credit_rate_multiplier: 1, min_balance: 0 })),
  getOrgBillingPolicy: vi.fn(), provisionOrganization: vi.fn(), updateAdminOrganization: vi.fn(),
  rechargeOrganization: vi.fn(), updateAdminBillingConfig: vi.fn(), updateOrgBillingPolicy: vi.fn(),
}));
vi.mock('@schema/ui-kit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@schema/ui-kit')>();
  return { ...actual, DataTable: ({ data, columns }: any) => <div>{data.map((row: any) => <div key={row.id}>{columns.map((column: any) => <React.Fragment key={column.id}>{typeof column.accessor === 'function' ? column.accessor(row) : row[column.accessor]}</React.Fragment>)}</div>)}</div> };
});

beforeEach(() => { vi.clearAllMocks(); });

it('opens the selected organization in a modal and keeps a failed save in context', async () => {
  vi.mocked(updateAdminOrganization).mockRejectedValue(new Error('保存失败示例'));
  render(<AdminPage />);
  fireEvent.click(await screen.findByRole('button', { name: '编辑' }));
  const dialog = screen.getByRole('dialog', { name: '编辑机构配置' });
  expect(within(dialog).getByLabelText('机构名称 *')).toHaveValue('示例机构');
  const save = within(dialog).getByRole('button', { name: '保存机构配置' });
  expect((save as HTMLButtonElement).form?.id).toBe('admin-edit-org');
  fireEvent.click(save);
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('保存失败示例');
  expect(updateAdminOrganization).toHaveBeenCalledWith('org-1', expect.objectContaining({ name: '示例机构' }));
  fireEvent.click(within(dialog).getByRole('button', { name: '取消' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

it('submits the modal provisioning form and closes it only after success', async () => {
  vi.mocked(provisionOrganization).mockResolvedValue({ organization: fixtures.org, account: { id: 'user-1', email: 'demo@example.invalid', name: '示例用户', system_role: 'ORG_USER', org_id: 'org-1', is_active: true } });
  render(<AdminPage />);
  fireEvent.click(await screen.findByRole('button', { name: '开通机构' }));
  const dialog = screen.getByRole('dialog', { name: '开通机构与管理员账号' });
  const fields = { '机构名称 *': '示例机构', 'Slug *': 'demo', '管理员姓名 *': '示例用户', '管理员邮箱 *': 'demo@example.invalid', '初始密码 *': 'synthetic-test-password' };
  for (const [label, value] of Object.entries(fields)) fireEvent.change(within(dialog).getByLabelText(label), { target: { value } });
  const submit = within(dialog).getByRole('button', { name: '开通机构' });
  expect((submit as HTMLButtonElement).form?.id).toBe('admin-provision');
  fireEvent.click(submit);
  await waitFor(() => expect(provisionOrganization).toHaveBeenCalledWith(expect.objectContaining({ name: '示例机构', admin_password: 'synthetic-hash' })));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

it('does not show empty organizations or zero rates after a failed read and retains data on failed refresh', async () => {
  vi.mocked(getAdminStats).mockRejectedValueOnce(new Error('统计读取失败'));
  render(<AdminPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('统计读取失败');
  expect(screen.queryByText('暂无机构数据')).not.toBeInTheDocument();
  expect(screen.queryByText(/当前：0/)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '保存全局配置' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '刷新' }));
  await screen.findByRole('button', { name: '编辑' });
  expect(screen.getByRole('button', { name: '保存全局配置' })).toBeInTheDocument();
  vi.mocked(getAdminStats).mockRejectedValueOnce(new Error('刷新读取失败'));
  fireEvent.click(screen.getByRole('button', { name: '刷新' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('刷新读取失败');
  expect(screen.getByRole('button', { name: '编辑' })).toBeInTheDocument();
});
