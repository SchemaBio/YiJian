import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { UserAgreementDocument } from './UserAgreementDocument';
import agreements from '@/i18n/user-agreement-v1.json';
import policies from '@/i18n/service-policy-v1.json';
vi.mock('./LanguageSwitcher',()=>({LanguageSwitcher:()=>null}));
vi.mock('@/lib/runtime-config',()=>({getRuntimeBackendFlavor:()=> 'octopus'}));
vi.mock('@/components/providers/AuthProvider',()=>({useAuth:()=>({isAuthenticated:false,isLoading:false})}));
afterEach(cleanup);
it.each(['zh-CN','zh-Hant','en','es-419'] as const)('renders the complete %s agreement with public operator details',locale=>{
 render(<UserAgreementDocument locale={locale} initialPolicy={{version:'test',configured:true,operator:'Operator',contact:'support@example.com',address:'Address',service_url:'/service',terms_url:'/terms',refund_url:'/refund'}} />);
 expect(screen.getByRole('heading',{level:1})).toHaveTextContent(agreements[locale].title);
 expect(screen.getAllByRole('heading',{level:2})).toHaveLength(12);
 for(const kind of ['service','terms','refund'] as const){
   expect(screen.getByRole('link',{name:policies[locale][kind].title})).toHaveAttribute('href',`#${kind}`);
   for(const paragraph of policies[locale][kind].paragraphs)expect(screen.getAllByText(paragraph).length).toBeGreaterThan(0);
 }
 expect(document.querySelector('.yj-legal-page')).toBeInTheDocument();
 expect(document.querySelector('.yj-legal-card')).toBeInTheDocument();
 expect(screen.getByRole('link',{name:agreements[locale].privacy})).toHaveAttribute('href',`/privacy?lang=${locale}`);
 expect(screen.getByRole('link',{name:'support@example.com'})).toHaveAttribute('href','mailto:support@example.com');
});
it('rejects unknown purchase policy versions in the unified page',()=>{
 render(<UserAgreementDocument locale="en" purchaseVersion="unknown" />);
 expect(screen.getByRole('heading',{level:1})).toHaveTextContent(agreements.en.unavailable);
 expect(screen.queryByText(policies.en.refund.paragraphs[0])).not.toBeInTheDocument();
});
it('does not label an unknown version with current agreement text',()=>{
 render(<UserAgreementDocument locale="zh-CN" version="unknown" />);
 expect(screen.getByRole('heading',{level:1})).toHaveTextContent(agreements['zh-CN'].unavailable);
 expect(screen.queryByText(agreements['zh-CN'].intro)).not.toBeInTheDocument();
});
