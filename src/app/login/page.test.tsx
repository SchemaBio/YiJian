import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  backend: 'squid',
  login: vi.fn(),
  push: vi.fn(),
  post: vi.fn(),
  hash: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: state.push, replace: state.push }) }));
vi.mock('@/components/providers/AuthProvider', () => ({
  useAuth: () => ({ login: state.login, isLoading: false, isAuthenticated: false }),
}));
vi.mock('@/components/shared/LanguageSwitcher', () => ({ LanguageSwitcher: () => null }));
vi.mock('@/components/DnaHelix', () => ({ DnaHelix: () => null }));
vi.mock('@/lib/runtime-config', () => ({ getRuntimeBackendFlavor: () => state.backend }));
vi.mock('@/lib/crypto', () => ({ hashPassword: state.hash }));
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    api: {
      post: state.post,
      get: vi.fn(),
    },
    clearLegacyAuthTokens: vi.fn(),
  };
});
vi.mock('@/components/auth/RegistrationChallenge', () => ({
  useRegistrationAvailability: () => ({ enabled: true, site_key: 'test', review_mode: 'manual' }),
  RegistrationChallenge: ({ onToken }: { onToken: (token: string) => void }) => (
    <button type="button" onClick={() => onToken('challenge-token')}>
      Complete verification
    </button>
  ),
}));

import LoginPage from './page';
import { ApiError } from '@/lib/api';
import { USER_AGREEMENT_VERSION } from '@/lib/user-agreement';

it('hydrates a direct register URL without mismatching the server markup', async () => {
  window.history.replaceState({}, '', '/login?mode=register&next=%2Fsamples');
  const container = document.createElement('div');
  container.innerHTML = renderToString(<LoginPage />);
  expect(container.textContent).not.toContain('创建账号');
  document.body.appendChild(container);
  const onRecoverableError = vi.fn();
  let root: ReturnType<typeof hydrateRoot>;
  try {
    await act(async () => {
      root = hydrateRoot(container, <LoginPage />, { onRecoverableError });
    });
    expect(screen.getByRole('heading', { name: '创建账号' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '登录' })).toHaveAttribute('href', '/login?next=%2Fsamples');
    expect(onRecoverableError).not.toHaveBeenCalled();
  } finally {
    await act(async () => root!.unmount());
    container.remove();
  }
});

it('defers browser navigation until a login request settles and releases the switch lock', async () => {
  let rejectLogin!: (error: Error) => void;
  state.login.mockImplementationOnce(() => new Promise<void>((_, reject) => { rejectLogin = reject; }));
  render(<LoginPage />);
  fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'busy@example.com' } });
  fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'password123' } });
  fireEvent.click(screen.getByRole('checkbox', { name: /我已阅读并了解/ }));
  fireEvent.click(screen.getByRole('button', { name: '登录' }));
  window.history.replaceState({}, '', '/login?mode=register');
  fireEvent(window, new PopStateEvent('popstate'));
  expect(screen.getByRole('heading', { name: '登录' })).toBeInTheDocument();
  await act(async () => rejectLogin(new Error('Network failure')));
  expect(screen.getByRole('heading', { name: '创建账号' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('link', { name: '登录' }));
  expect(screen.getByRole('heading', { name: '登录' })).toBeInTheDocument();
});

it('releases the switch lock after a successful request when navigation has not unmounted the page', async () => {
  state.login.mockResolvedValueOnce(undefined);
  render(<LoginPage />);
  fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'user@example.com' } });
  fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'password123' } });
  fireEvent.click(screen.getByRole('checkbox', { name: /我已阅读并了解/ }));
  fireEvent.click(screen.getByRole('button', { name: '登录' }));
  await waitFor(() => expect(state.push).toHaveBeenCalledWith('/dashboard'));
  fireEvent.click(screen.getByRole('link', { name: '注册' }));
  expect(screen.getByRole('heading', { name: '创建账号' })).toBeInTheDocument();
});

it('keeps registration mounted during browser Back and applies navigation after submission', async () => {
  let resolveRegistration!: (value: { message: string }) => void;
  state.post.mockImplementationOnce(() => new Promise((resolve) => { resolveRegistration = resolve; }));
  window.history.replaceState({}, '', '/login?mode=register');
  render(<LoginPage />);
  fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'pending@example.com' } });
  fireEvent.change(screen.getByLabelText(/^密码/), { target: { value: 'Test-password-42' } });
  fireEvent.change(screen.getByLabelText('确认密码'), { target: { value: 'Test-password-42' } });
  fireEvent.click(screen.getByRole('button', { name: 'Complete verification' }));
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: '注册' }));
  await waitFor(() => expect(state.post).toHaveBeenCalled());
  window.history.replaceState({}, '', '/login');
  fireEvent(window, new PopStateEvent('popstate'));
  expect(screen.getByRole('heading', { name: '创建账号' })).toBeInTheDocument();
  await act(async () => resolveRegistration({ message: 'Pending' }));
  expect(screen.getByRole('heading', { name: '登录' })).toBeInTheDocument();
  expect(screen.getByLabelText('邮箱')).toHaveValue('pending@example.com');
  fireEvent.click(screen.getByRole('link', { name: '注册' }));
  expect(screen.getByRole('heading', { name: '创建账号' })).toBeInTheDocument();
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

beforeEach(() => {
  vi.clearAllMocks();
  state.backend = 'squid';
  state.hash.mockResolvedValue('hashed-password');
  state.post.mockResolvedValue({ message: 'Pending' });
  window.history.replaceState({}, '', '/login');
});

it('requires the unchecked combined acknowledgment and links to the localized agreement', async () => {
  const view = render(<LoginPage />);
  expect(screen.queryByRole('link', { name: '重新发送验证邮件' })).not.toBeInTheDocument();
  expect(screen.queryByRole('navigation', { name: '托管服务政策' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: '注册' })).toHaveAttribute('href', '/login?mode=register');
  const agreement = screen.getByRole('link', { name: '《使用协议》' });
  expect(agreement).toHaveAttribute('href', `/agreement?lang=zh-CN&version=${USER_AGREEMENT_VERSION}`);
  expect(agreement).toHaveAttribute('target', '_blank');
  const checkbox = screen.getByRole('checkbox', { name: /我已阅读并了解/ });
  expect(checkbox).not.toBeChecked();
  expect(screen.getByRole('button', { name: '登录' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'researcher@example.com' } });
  fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'example-password' } });
  fireEvent.submit(view.container.querySelector('form')!);
  expect(await screen.findByRole('alert')).toHaveTextContent('请阅读并了解隐私政策，并同意使用协议');
  expect(state.login).not.toHaveBeenCalled();
  fireEvent.click(checkbox);
  fireEvent.click(screen.getByRole('button', { name: '登录' }));
  await waitFor(() => expect(state.login).toHaveBeenCalledWith('researcher@example.com', 'example-password', false));
});

it('does not bypass SaaS agreement when the legacy privacy flag is disabled', () => {
  vi.stubEnv('NEXT_PUBLIC_PRIVACY_CONSENT_REQUIRED', 'false');
  render(<LoginPage />);
  expect(screen.getByRole('link', { name: '《使用协议》' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '登录' })).toBeDisabled();
});

it('preserves the self-hosted privacy acknowledgment without hosted terms', () => {
  state.backend = 'octopus';
  render(<LoginPage />);
  expect(screen.getByRole('link', { name: '《隐私政策》' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: '《使用协议》' })).not.toBeInTheDocument();
});

it('displays localized invalid credentials error when user does not exist or password is wrong', async () => {
  state.login.mockRejectedValueOnce(new ApiError(401, 'Unauthorized', { error: 'invalid email or password' }));
  render(<LoginPage />);
  fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'user@example.com' } });
  fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'wrong-password' } });
  fireEvent.click(screen.getByRole('checkbox', { name: /我已阅读并了解/ }));
  fireEvent.click(screen.getByRole('button', { name: '登录' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('邮箱或密码不正确。');
});

it('displays localized generic error when authentication failed unexpectedly', async () => {
  state.login.mockRejectedValueOnce(new ApiError(401, 'Unauthorized', { error: 'authentication failed' }));
  render(<LoginPage />);
  fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'user@example.com' } });
  fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'wrong-password' } });
  fireEvent.click(screen.getByRole('checkbox', { name: /我已阅读并了解/ }));
  fireEvent.click(screen.getByRole('button', { name: '登录' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('登录失败，请稍后重试。');
});

it('displays pending review message when account is awaiting manual review', async () => {
  state.login.mockRejectedValueOnce(new ApiError(401, 'Unauthorized', { error: 'account is pending approval' }));
  render(<LoginPage />);
  fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'user@example.com' } });
  fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'password123' } });
  fireEvent.click(screen.getByRole('checkbox', { name: /我已阅读并了解/ }));
  fireEvent.click(screen.getByRole('button', { name: '登录' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    '申请已提交，等待管理员人工审核。审核通过后将发送邮件通知，请使用注册时设置的密码登录。'
  );
});

it('displays check credentials fallback when HTTP fails without error field', async () => {
  state.login.mockRejectedValueOnce(new ApiError(401, 'Unauthorized', {}));
  render(<LoginPage />);
  fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'user@example.com' } });
  fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'password123' } });
  fireEvent.click(screen.getByRole('checkbox', { name: /我已阅读并了解/ }));
  fireEvent.click(screen.getByRole('button', { name: '登录' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('登录失败，请检查邮箱和密码');
});

it('displays network error when request fails with non-ApiError exception', async () => {
  state.login.mockRejectedValueOnce(new TypeError('Failed to fetch'));
  render(<LoginPage />);
  fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'user@example.com' } });
  fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'password123' } });
  fireEvent.click(screen.getByRole('checkbox', { name: /我已阅读并了解/ }));
  fireEvent.click(screen.getByRole('button', { name: '登录' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('网络错误，请稍后重试');
});

it('switches between login and register in-place preserving email while clearing password, errors and consent', async () => {
  render(<LoginPage />);
  // Fill login email and trigger validation error
  fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'switch-user@example.com' } });
  fireEvent.submit(document.querySelector('form')!);
  expect(await screen.findByRole('alert')).toHaveTextContent('请输入邮箱和密码');

  // Switch to register
  const registerLink = screen.getByRole('link', { name: '注册' });
  fireEvent.click(registerLink);

  expect(state.push).toHaveBeenCalledWith('/login?mode=register');
  const registerHeading = screen.getByRole('heading', { name: '创建账号' });
  expect(registerHeading).toBeInTheDocument();
  expect(document.activeElement).toBe(registerHeading);

  // Email is preserved
  expect(screen.getByLabelText('邮箱')).toHaveValue('switch-user@example.com');
  // Passwords and agreements are reset
  expect(screen.getByLabelText(/^密码/)).toHaveValue('');
  expect(screen.getByLabelText('确认密码')).toHaveValue('');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  const regConsent = screen.getByRole('checkbox');
  expect(regConsent).not.toBeChecked();

  // Now change email and enter register details
  fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'updated-user@example.com' } });
  fireEvent.change(screen.getByLabelText(/^密码/), { target: { value: 'reg-pass-123' } });
  fireEvent.click(regConsent);

  // Switch back to login
  const signInLink = screen.getByRole('link', { name: '登录' });
  fireEvent.click(signInLink);

  expect(state.push).toHaveBeenCalledWith('/login');
  const loginHeading = screen.getByRole('heading', { name: '登录' });
  expect(loginHeading).toBeInTheDocument();
  expect(document.activeElement).toBe(loginHeading);

  // Email is preserved
  expect(screen.getByLabelText('邮箱')).toHaveValue('updated-user@example.com');
  // Password and agreements are reset
  expect(screen.getByLabelText('密码')).toHaveValue('');
  expect(screen.getByRole('checkbox', { name: /我已阅读并了解/ })).not.toBeChecked();
});

it('disables mode switching while request is in flight', async () => {
  let resolveLogin: () => void = () => {};
  state.login.mockImplementationOnce(() => new Promise<void>((resolve) => { resolveLogin = resolve; }));

  render(<LoginPage />);
  fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'busy@example.com' } });
  fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'password123' } });
  fireEvent.click(screen.getByRole('checkbox', { name: /我已阅读并了解/ }));
  fireEvent.click(screen.getByRole('button', { name: '登录' }));

  // While busy, click register link
  const registerLink = screen.getByRole('link', { name: '注册' });
  expect(registerLink).toHaveAttribute('aria-disabled', 'true');
  fireEvent.click(registerLink);

  // Still on login form
  expect(screen.getByRole('heading', { name: '登录' })).toBeInTheDocument();
  expect(state.push).not.toHaveBeenCalled();

  await act(async () => resolveLogin());
});

it('directly renders register mode when accessed via /login?mode=register and preserves next param', async () => {
  window.history.replaceState({}, '', '/login?mode=register&next=%2Fsamples%2Fbatch');
  render(<LoginPage />);

  expect(screen.getByRole('heading', { name: '创建账号' })).toBeInTheDocument();
  const signInLink = screen.getByRole('link', { name: '登录' });
  expect(signInLink).toHaveAttribute('href', '/login?next=%2Fsamples%2Fbatch');

  fireEvent.click(signInLink);
  expect(state.push).toHaveBeenCalledWith('/login?next=%2Fsamples%2Fbatch');

  expect(screen.getByRole('heading', { name: '登录' })).toBeInTheDocument();
  const registerLink = screen.getByRole('link', { name: '注册' });
  expect(registerLink).toHaveAttribute('href', '/login?mode=register&next=%2Fsamples%2Fbatch');
});

it('handles browser back and forward navigation via popstate', () => {
  render(<LoginPage />);
  expect(screen.getByRole('heading', { name: '登录' })).toBeInTheDocument();

  // Navigate to register
  fireEvent.click(screen.getByRole('link', { name: '注册' }));
  expect(screen.getByRole('heading', { name: '创建账号' })).toBeInTheDocument();

  // Simulate browser Back button
  window.history.replaceState({}, '', '/login');
  fireEvent(window, new PopStateEvent('popstate'));
  expect(screen.getByRole('heading', { name: '登录' })).toBeInTheDocument();

  // Simulate browser Forward button
  window.history.replaceState({}, '', '/login?mode=register');
  fireEvent(window, new PopStateEvent('popstate'));
  expect(screen.getByRole('heading', { name: '创建账号' })).toBeInTheDocument();
});

it('displays submitted notice in-place after successful SaaS registration and returns to login', async () => {
  window.history.replaceState({}, '', '/login?mode=register');
  render(<LoginPage />);

  fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'submitted@example.org' } });
  fireEvent.change(screen.getByLabelText(/^密码/), { target: { value: 'Test-pass-42' } });
  fireEvent.change(screen.getByLabelText('确认密码'), { target: { value: 'Test-pass-42' } });
  fireEvent.click(screen.getByRole('button', { name: 'Complete verification' }));
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: '注册' }));

  const heading = await screen.findByRole('heading', { name: '申请已提交' });
  expect(heading).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('申请已提交，等待管理员人工审核。');
  expect(screen.getByText('submitted@example.org')).toBeInTheDocument();

  const backBtn = screen.getByRole('button', { name: '返回登录' });
  fireEvent.click(backBtn);

  expect(screen.getByRole('heading', { name: '登录' })).toBeInTheDocument();
  expect(screen.getByLabelText('邮箱')).toHaveValue('submitted@example.org');
});
