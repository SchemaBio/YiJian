import { render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import AdminPage from './page';
const auth = vi.hoisted(() => ({ loading: false, allowed: true }));
vi.mock('@/components/providers/AuthProvider', () => ({ useAuth: () => ({ isLoading: auth.loading, isPlatformAdmin: () => auth.allowed }) }));
vi.mock('../settings/components/PermissionsManagement', () => ({ PermissionsManagement: () => <div>Account management</div> }));
beforeEach(() => { auth.loading = false; auth.allowed = true; });
it('opens account management for a platform administrator', () => {
  render(<AdminPage />);
  expect(screen.getByText('Account management')).toBeInTheDocument();
  expect(screen.queryByText('开通机构')).not.toBeInTheDocument();
});
it('does not mount user management before permission checks finish', () => {
  auth.loading = true;
  render(<AdminPage />);
  expect(screen.queryByText('Account management')).not.toBeInTheDocument();
});
it('denies ordinary users without mounting user management', () => {
  auth.allowed = false;
  render(<AdminPage />);
  expect(screen.queryByText('Account management')).not.toBeInTheDocument();
  expect(screen.getByText('您没有权限访问此页面')).toBeInTheDocument();
});
