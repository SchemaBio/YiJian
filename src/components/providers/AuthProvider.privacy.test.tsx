import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthProvider';
import { authApi } from '@/lib/auth';

vi.mock('@/lib/auth', () => ({ authApi: {
  getCurrentUser: vi.fn().mockRejectedValue(new Error('Unauthenticated')),
  getCurrentOrganization: vi.fn(),
} }));

function Probe() {
  const auth = useAuth();
  return <span>{auth.isLoading ? 'Loading' : auth.isAuthenticated ? 'Authenticated' : 'Public visitor'}</span>;
}

it('refreshes the active organization quota when the SaaS window regains focus', async () => {
  const previous = window.__YIJIAN_CONFIG__;
  window.__YIJIAN_CONFIG__ = { BACKEND: 'squid' };
  const user = {
    id: 'user-1', orgId: 'org-1', name: 'Test User', email: 'test@example.invalid',
    systemRole: 'ORG_USER' as const, isActive: true, createdAt: '', updatedAt: '',
  };
  const organization = { id: 'org-1', name: 'Test Org', slug: 'test-org', storageQuotaBytes: 1024 };
  vi.mocked(authApi.getCurrentUser).mockResolvedValueOnce(user).mockResolvedValueOnce(user);
  vi.mocked(authApi.getCurrentOrganization)
    .mockResolvedValueOnce(organization)
    .mockResolvedValueOnce({ ...organization, storageQuotaBytes: 0 });

  function Quota() {
    return <span>{useAuth().currentOrg?.storageQuotaBytes ?? 'Loading quota'}</span>;
  }

  const view = render(<AuthProvider><Quota /></AuthProvider>);
  try {
    expect(await screen.findByText('1024')).toBeInTheDocument();
    fireEvent.focus(window);
    expect(await screen.findByText('0')).toBeInTheDocument();
  } finally {
    view.unmount();
    window.__YIJIAN_CONFIG__ = previous;
  }
});

beforeEach(() => { localStorage.clear(); });

describe('public privacy access', () => {
  it.each(['/privacy', '/privacy?lang=en', '/agreement?lang=zh-CN', '/service', '/terms?lang=en', '/refund?lang=es-419'])('keeps %s open after session expiry', async path => {
    window.history.replaceState({}, '', path);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(<AuthProvider><Probe /></AuthProvider>);
      await waitFor(() => expect(screen.getByText('Public visitor')).toBeInTheDocument());
      fireEvent(window, new Event('schema:auth-expired'));
      expect(window.location.pathname + window.location.search).toBe(path);
      expect(error).not.toHaveBeenCalled();
    } finally { error.mockRestore(); }
  });
});
