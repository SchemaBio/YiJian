import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ServicePolicyDocument, ServicePolicyLinks } from './ServicePolicyDocument';
import { SERVICE_POLICY_VERSION } from '@/lib/service-policy';
import copy from '@/i18n/service-policy-v1.json';
import agreements from '@/i18n/user-agreement-v1.json';
import { USER_AGREEMENT_VERSION } from '@/lib/user-agreement';
vi.mock('@/lib/runtime-config', () => ({ getRuntimeBackendFlavor: () => 'squid' }));
vi.mock('@/lib/service-policy', async original => ({ ...await original<typeof import('@/lib/service-policy')>(), getServicePolicy: vi.fn().mockResolvedValue({configured:true,operator:'Research Operator',contact:'support@fixture.invalid',address:'Operator address'}) }));
vi.mock('./LanguageSwitcher', () => ({LanguageSwitcher: () => null}));
vi.mock('@/components/providers/AuthProvider',()=>({useAuth:()=>({isAuthenticated:false,isLoading:false})}));
afterEach(cleanup);
it('points purchase disclosures to versioned sections of the unified agreement',()=>{
 render(<ServicePolicyLinks locale="en"/>);
 for(const kind of ['service','terms','refund'] as const)expect(screen.getByRole('link',{name:copy.en[kind].title})).toHaveAttribute('href',`/agreement?lang=en&version=${USER_AGREEMENT_VERSION}&purchase_version=${SERVICE_POLICY_VERSION}#${kind}`);
});
it.each(['zh-CN','zh-Hant','en','es-419'] as const)('renders public policy and matching links in %s', async locale => {
  render(<ServicePolicyDocument kind="refund" locale={locale} version={SERVICE_POLICY_VERSION} />);
  expect(screen.getByRole('heading',{level:1})).toHaveTextContent(agreements[locale].title);
  await screen.findByText('Research Operator');
  expect(screen.getByRole('link',{name:copy[locale].terms.title})).toHaveAttribute('href','#terms');
  expect(screen.getByRole('link',{name:'support@fixture.invalid'})).toHaveAttribute('href','mailto:support@fixture.invalid');
});
it('does not display another version as historical terms',async()=>{
  render(<ServicePolicyDocument kind="terms" locale="en" version="unknown" />);
  expect(screen.getByRole('heading',{level:1})).toHaveTextContent(copy.en.unavailable);
  expect(screen.queryByText(copy.en.terms.paragraphs[0])).not.toBeInTheDocument();
  await Promise.resolve();
});
