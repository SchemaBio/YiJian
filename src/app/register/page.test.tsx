import * as React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ backend: 'squid', enabled: true, mode: 'manual' as string | undefined, post: vi.fn(), push: vi.fn(), hash: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: state.push }) }));
vi.mock('@/lib/api', () => ({ api: { post: state.post }, ApiError: class extends Error {}, clearLegacyAuthTokens: vi.fn() }));
vi.mock('@/lib/crypto', () => ({ hashPassword: state.hash }));
vi.mock('@/lib/runtime-config', () => ({ getRuntimeBackendFlavor: () => state.backend }));
vi.mock('@/components/shared/LanguageSwitcher', () => ({ LanguageSwitcher: () => null }));
vi.mock('@/components/shared/ServicePolicyDocument', () => ({ ServicePolicyLinks: () => null }));
vi.mock('@/components/auth/RegistrationVerification', () => ({ RegistrationVerification: () => <p>Manual review pending</p> }));
vi.mock('@/components/auth/RegistrationChallenge', () => ({
  useRegistrationAvailability: () => ({ enabled: state.enabled, site_key: 'test', review_mode: state.mode }),
  RegistrationChallenge: ({ onToken }: { onToken: (token: string) => void }) => <button type="button" onClick={() => onToken('challenge-token')}>Complete verification</button>,
}));
import RegisterPage from './page';
beforeEach(() => { vi.clearAllMocks(); state.backend = 'squid'; state.enabled = true; state.mode = 'manual'; state.hash.mockResolvedValue('hashed-password'); state.post.mockResolvedValue({ message: 'Pending' }); });
afterEach(cleanup);
function fill(password = 'Test-password-42', confirmation = password) {
  fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: ' User@Example.org ' } });
  fireEvent.change(screen.getByLabelText(/^密码/), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('确认密码'), { target: { value: confirmation } });
  const consent = screen.getByRole('checkbox');
  if (!(consent as HTMLInputElement).checked) fireEvent.click(consent);
}
function submit() { fireEvent.submit(document.querySelector('form')!); }
it('requires a second password and blocks mismatches before hashing or sending a request', async () => {
  render(<RegisterPage />); fill('Test-password-42', 'Different-password-42'); submit();
  expect(screen.getByRole('alert')).toHaveTextContent('两次输入的密码不一致');
  expect(state.hash).not.toHaveBeenCalled(); expect(state.post).not.toHaveBeenCalled();
  fill('Test-password-42', ''); submit();
  expect(screen.getByRole('alert')).toHaveTextContent('请填写所有必填字段');
  expect(screen.getByLabelText('确认密码')).toBeRequired();
});
it('registers with email and matching passwords while omitting all optional fields', async () => {
  render(<RegisterPage />); fill();
  for (const id of ['register-name', 'register-org-name', 'register-org-slug']) expect(document.getElementById(id)).not.toBeRequired();
  expect(screen.getByRole('button', { name: '注册' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Complete verification' })); submit();
  await screen.findByText('Manual review pending');
  expect(state.hash).toHaveBeenCalledWith('Test-password-42', 'user@example.org');
  expect(state.post).toHaveBeenCalledWith('/v1/auth/register', { email: 'user@example.org', password: 'hashed-password', turnstile_token: 'challenge-token', locale: 'zh-CN' }, { coreApi: false });
});
it('validates provided organization slugs and preserves optional profile input', async () => {
  render(<RegisterPage />); fill(); fireEvent.click(screen.getByRole('button', { name: 'Complete verification' }));
  fireEvent.change(document.getElementById('register-org-slug')!, { target: { value: 'invalid slug' } }); submit();
  expect(state.post).not.toHaveBeenCalled(); expect(screen.getByRole('alert')).toHaveTextContent('机构标识');
  fireEvent.change(document.getElementById('register-org-slug')!, { target: { value: ' My-Lab ' } });
  fireEvent.change(document.getElementById('register-org-name')!, { target: { value: ' Test Lab ' } });
  fireEvent.change(document.getElementById('register-name')!, { target: { value: ' Researcher ' } }); submit();
  await waitFor(() => expect(state.post).toHaveBeenCalledWith('/v1/auth/register', expect.objectContaining({ name: 'Researcher', org_name: 'Test Lab', org_slug: 'my-lab' }), { coreApi: false }));
});
it('keeps unavailable SaaS registration blocked', () => {
  state.enabled = false; render(<RegisterPage />); fill(); submit();
  expect(screen.getByRole('button', { name: '注册' })).toBeDisabled(); expect(state.post).not.toHaveBeenCalled();
});
it('supports optional names and password confirmation in self-hosted mode without a challenge', async () => {
  state.backend = 'octopus'; state.post.mockResolvedValue({ access_token: 'test' }); render(<RegisterPage />); fill(); submit();
  await waitFor(() => expect(state.push).toHaveBeenCalledWith('/dashboard'));
  expect(state.post).toHaveBeenCalledWith('/v1/auth/register', { email: 'user@example.org', password: 'hashed-password' }, { coreApi: false });
});

it('blocks mixed-version SaaS signup until the server advertises manual review',()=>{
 state.mode=undefined;render(<RegisterPage/>);fill();fireEvent.click(screen.getByRole('button',{name:'Complete verification'}));submit();
 expect(screen.getByRole('button',{name:'注册'})).toBeDisabled();expect(state.post).not.toHaveBeenCalled();
});


it('keeps visible field labels after entry and rechecks confirmation when either password changes', () => {
  render(<RegisterPage />); fill();
  for (const id of ['register-email', 'register-password', 'register-confirm-password', 'register-name', 'register-org-name', 'register-org-slug']) {
    const label = document.querySelector(`label[for="${id}"]`);
    expect(label).toBeVisible();
    expect(label?.textContent?.trim()).not.toBe('');
  }
  const confirmation = screen.getByLabelText('确认密码');
  expect(confirmation).toBeRequired();
  fireEvent.blur(confirmation);
  expect(confirmation).toHaveAttribute('aria-invalid', 'false');
  fireEvent.change(screen.getByLabelText(/^密码/), { target: { value: 'Changed-password-42' } });
  expect(confirmation).toHaveAttribute('aria-invalid', 'true');
  expect(confirmation).toHaveAccessibleDescription('两次输入的密码不一致');
  fireEvent.change(confirmation, { target: { value: 'Changed-password-42' } });
  expect(confirmation).toHaveAttribute('aria-invalid', 'false');
  expect(document.getElementById('register-confirm-password-error')).not.toBeInTheDocument();
  fireEvent.change(confirmation, { target: { value: '' } });
  expect(confirmation).toHaveAttribute('aria-invalid', 'true');
  expect(confirmation).toHaveAccessibleDescription('请填写所有必填字段');
  expect(state.post).not.toHaveBeenCalled();
});


it('requires explicit agreement and links to the existing unified agreement without split terms', () => {
  render(<RegisterPage />);
  const consent = screen.getByRole('checkbox');
  expect(consent).not.toBeChecked(); expect(consent).toBeRequired();
  expect(screen.getByRole('link', { name: '《隐私政策》' })).toHaveAttribute('href', '/privacy?lang=zh-CN');
  expect(screen.getByRole('link', { name: '《使用协议》' })).toHaveAttribute('href', expect.stringMatching(/^\/agreement\?lang=zh-CN&version=/));
  expect(document.querySelector('a[href^="/terms"]')).toBeNull();
  expect(document.querySelector('a[href^="/refund"]')).toBeNull();
  fill(); fireEvent.click(screen.getByRole('button', { name: 'Complete verification' }));
  fireEvent.click(consent);
  expect(screen.getByRole('button', { name: '注册' })).toBeDisabled();
  submit(); expect(state.hash).not.toHaveBeenCalled(); expect(state.post).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('请阅读并了解隐私政策，并同意使用协议');
  fireEvent.click(consent);
  expect(screen.getByRole('button', { name: '注册' })).toBeEnabled();
});
