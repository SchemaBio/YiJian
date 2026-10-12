import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthProvider';

vi.mock('@/lib/auth', () => ({ authApi: {
  getCurrentUser: vi.fn().mockRejectedValue(new Error('Unauthenticated')),
  getCurrentOrganization: vi.fn(),
} }));

function Probe() {
  const auth = useAuth();
  return <span>{auth.isLoading ? 'Loading' : auth.isAuthenticated ? 'Authenticated' : 'Public visitor'}</span>;
}

beforeEach(() => { localStorage.clear(); });

describe('public privacy access', () => {
  it.each(['/privacy', '/privacy?lang=en'])('keeps %s open after session expiry', async path => {
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
