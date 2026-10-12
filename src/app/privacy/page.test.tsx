import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import PrivacyPage from './page';

vi.mock('@/components/providers/AuthProvider', () => ({ useAuth: () => ({ isAuthenticated: false, isLoading: false }) }));
vi.mock('@/lib/runtime-config', () => ({ getRuntimeSupportEmail: () => 'privacy@example.com' }));

beforeEach(() => window.history.replaceState({}, '', '/privacy'));

describe('bilingual privacy policy', () => {
  it('switches languages with a shareable URL and preserves the retention notice', () => {
    render(<PrivacyPage />);
    expect(screen.getByRole('heading', { name: '隐私政策', level: 1 })).toBeInTheDocument();
    const notice = screen.getByRole('heading', { name: '第五条 数据保留与删除策略' }).closest('section');
    expect(notice).toHaveClass('border-amber-300', 'bg-amber-50', 'dark:bg-amber-950/30');
    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(window.location.search).toBe('?lang=en');
    expect(screen.getByRole('heading', { name: 'Privacy Policy', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/starting at task completion/)).toBeInTheDocument();
    expect(screen.getByText(/does not use servers in mainland China/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '中文' }));
    expect(window.location.search).toBe('?lang=zh');
    expect(screen.getByRole('heading', { name: '隐私政策', level: 1 })).toBeInTheDocument();
  });

  it('restores an English deep link and uses the configured contact', () => {
    window.history.replaceState({}, '', '/privacy?lang=en');
    render(<PrivacyPage />);
    expect(screen.getByRole('heading', { name: 'Privacy Policy', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'privacy@example.com' })).toHaveAttribute('href', 'mailto:privacy@example.com');
    expect(screen.getByText(/Reading this policy or acknowledging it at login/)).toBeInTheDocument();
    expect(screen.queryByText(/72 hours/)).not.toBeInTheDocument();
  });

  it('responds to browser history language changes', () => {
    render(<PrivacyPage />);
    window.history.replaceState({}, '', '/privacy?lang=en');
    fireEvent(window, new PopStateEvent('popstate'));
    expect(screen.getByRole('heading', { name: 'Privacy Policy', level: 1 })).toBeInTheDocument();
  });
});
