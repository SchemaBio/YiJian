import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({backend:'squid',login:vi.fn(),push:vi.fn()}));
vi.mock('next/navigation', () => ({useRouter:() => ({push:state.push})}));
vi.mock('@/components/providers/AuthProvider', () => ({useAuth:() => ({login:state.login,isLoading:false,isAuthenticated:false})}));
vi.mock('@/components/shared/LanguageSwitcher', () => ({LanguageSwitcher:() => null}));
vi.mock('@/components/DnaHelix', () => ({DnaHelix:() => null}));
vi.mock('@/lib/runtime-config', () => ({getRuntimeBackendFlavor:() => state.backend}));
import LoginPage from './page';
import { ApiError } from '@/lib/api';
import { USER_AGREEMENT_VERSION } from '@/lib/user-agreement';
afterEach(() => {cleanup();vi.unstubAllEnvs();});
beforeEach(() => {vi.clearAllMocks();state.backend='squid';window.history.replaceState({},'','/login');});
it('requires the unchecked combined acknowledgment and links to the localized agreement',async()=>{
 const view=render(<LoginPage />);
 expect(screen.queryByRole('link',{name:'重新发送验证邮件'})).not.toBeInTheDocument();
 expect(screen.queryByRole('navigation',{name:'托管服务政策'})).not.toBeInTheDocument();
 expect(screen.getByRole('link',{name:'注册'})).toHaveAttribute('href','/register');
 const agreement=screen.getByRole('link',{name:'《使用协议》'});
 expect(agreement).toHaveAttribute('href',`/agreement?lang=zh-CN&version=${USER_AGREEMENT_VERSION}`);
 expect(agreement).toHaveAttribute('target','_blank');
 const checkbox=screen.getByRole('checkbox',{name:/我已阅读并了解/});
 expect(checkbox).not.toBeChecked();
 expect(screen.getByRole('button',{name:'登录'})).toBeDisabled();
 fireEvent.change(screen.getByLabelText('邮箱'),{target:{value:'researcher@example.com'}});
 fireEvent.change(screen.getByLabelText('密码'),{target:{value:'example-password'}});
 fireEvent.submit(view.container.querySelector('form')!);
 expect(await screen.findByRole('alert')).toHaveTextContent('请阅读并了解隐私政策，并同意使用协议');
 expect(state.login).not.toHaveBeenCalled();
 fireEvent.click(checkbox);
 fireEvent.click(screen.getByRole('button',{name:'登录'}));
 await waitFor(()=>expect(state.login).toHaveBeenCalledWith('researcher@example.com','example-password',false));
});
it('does not bypass SaaS agreement when the legacy privacy flag is disabled',()=>{
 vi.stubEnv('NEXT_PUBLIC_PRIVACY_CONSENT_REQUIRED','false');
 render(<LoginPage />);
 expect(screen.getByRole('link',{name:'《使用协议》'})).toBeInTheDocument();
 expect(screen.getByRole('button',{name:'登录'})).toBeDisabled();
});
it('preserves the self-hosted privacy acknowledgment without hosted terms',()=>{
 state.backend='octopus';render(<LoginPage />);
 expect(screen.getByRole('link',{name:'《隐私政策》'})).toBeInTheDocument();
 expect(screen.queryByRole('link',{name:'《使用协议》'})).not.toBeInTheDocument();
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
  expect(await screen.findByRole('alert')).toHaveTextContent('申请已提交，等待管理员人工审核。审核通过后将发送邮件通知，请使用注册时设置的密码登录。');
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
