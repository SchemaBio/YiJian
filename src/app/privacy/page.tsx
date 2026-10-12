'use client';

import { useEffect, useState } from 'react';
import { Shield, ArrowLeft, Clock } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import { getRuntimeSupportEmail } from '@/lib/runtime-config';
import { privacySections, type PrivacyLanguage } from '@/lib/privacy-policy';

export default function PrivacyPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [language, setLanguage] = useState<PrivacyLanguage>('zh');
  const [contact, setContact] = useState('support@schemabio.com');
  useEffect(() => {
    const sync = () => setLanguage(new URL(window.location.href).searchParams.get('lang') === 'en' ? 'en' : 'zh');
    sync();
    setContact(getRuntimeSupportEmail());
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  const english = language === 'en';
  const selectLanguage = (next: PrivacyLanguage) => {
    const url = new URL(window.location.href);
    url.searchParams.set('lang', next);
    window.history.replaceState(window.history.state, '', url);
    setLanguage(next);
  };

  return (
    <div className="yj-modern yj-public-shell" lang={english ? 'en' : 'zh-CN'}>
      <div className="yj-legal-page">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link href={isAuthenticated ? '/dashboard' : '/login'} aria-disabled={isLoading}
            onClick={(event) => { if (isLoading) event.preventDefault(); }}
            className={`inline-flex items-center gap-1.5 rounded-md border border-border-default px-3.5 py-2 text-sm text-fg-muted hover:text-fg-default ${isLoading ? 'cursor-wait opacity-60' : ''}`}>
            <ArrowLeft className="w-4 h-4" />{english ? 'Back' : '返回'}
          </Link>
          <div role="group" aria-label={english ? 'Policy language' : '政策语言'} className="flex gap-2">
            {(['zh', 'en'] as const).map(value => (
              <button key={value} type="button" aria-pressed={language === value} onClick={() => selectLanguage(value)}
                className={`rounded-md border px-3 py-2 text-sm ${language === value ? 'border-accent-emphasis bg-accent-subtle text-accent-fg' : 'border-border-default text-fg-muted hover:text-fg-default'}`}>
                {value === 'zh' ? '中文' : 'English'}
              </button>
            ))}
          </div>
        </div>
        <header className="yj-panel mb-6 flex items-start gap-4 p-6">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border-default bg-[var(--yj-sage-subtle)]">
            <Shield className="h-6 w-6 text-success-fg" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold leading-tight text-fg-default">{english ? 'Privacy Policy' : '隐私政策'}</h1>
            <p className="mt-2 text-sm text-fg-muted">SchemaBio · {english ? 'YiJian genomic analysis platform' : '贻鉴基因组分析平台'}</p>
            <p className="mt-3 text-xs text-fg-muted">{english ? 'Last updated: October 12, 2026 · Version 2026-10-12' : '更新日期：2026年10月12日 · 版本 2026-10-12'}</p>
          </div>
        </header>
        <div className="yj-public-alert mb-6 rounded-[var(--yj-radius-panel)] p-4 text-sm leading-relaxed">
          {english ? 'Genetic and health information requires special protection. Reading this policy or acknowledging it at login does not replace separate consent or other authorization required by law. The platform provides research support; outputs require independent professional review and are not medical advice.' : '遗传与健康信息需要特别保护。阅读本政策或在登录时确认已阅读，不替代依法需要的单独同意或其他授权。平台提供科研辅助，结果需专业人员独立核对，不构成医疗建议。'}
        </div>
        <div className="yj-panel yj-legal-card space-y-8">
          {privacySections.map(section => {
            const content = section[language];
            const retention = section.id === 'retention';
            return (
              <section key={section.id} id={section.id} className={retention ? 'rounded-[var(--yj-radius-panel)] border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100' : undefined}>
                <h2 className={`mb-3 flex items-center gap-2 text-base font-semibold ${retention ? '' : 'text-fg-default'}`}>
                  {retention && <Clock className="h-4 w-4 shrink-0" />}{content.title}
                </h2>
                <div className={`space-y-3 text-sm leading-relaxed pl-0 md:pl-6 ${retention ? '' : 'text-fg-muted'}`}>
                  {content.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
                </div>
              </section>
            );
          })}
          <section id="contact">
            <h2 className="mb-3 text-base font-semibold text-fg-default">{english ? 'Contact and privacy requests' : '隐私联系与权利请求'}</h2>
            <p className="text-sm leading-relaxed text-fg-muted pl-0 md:pl-6">
              {english ? 'Operator: 绳墨生物科技有限公司 (SchemaBio). Privacy inquiries and requests: ' : '运营主体：绳墨生物科技有限公司（SchemaBio）。隐私咨询及权利请求：'}
              <a className="text-accent-fg underline break-all" href={`mailto:${contact}`}>{contact}</a>{english ? '.' : '。'}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-fg-muted pl-0 md:pl-6">{english ? 'Describe your request and relevant organization or account. Do not email raw sequencing files, full medical records or identity documents unless requested through an appropriate secure channel.' : '请说明请求事项及相关机构或账户。除非我们通过适当的安全渠道要求提供，请勿通过邮件发送原始测序文件、完整病历或身份证件。'}</p>
          </section>
        </div>
        <footer className="mt-6 text-center text-xs text-fg-muted">SchemaBio · {english ? 'Both languages describe the same processing arrangements. Mandatory local privacy rights remain applicable.' : '中文与英文版本说明相同的处理安排；适用地区的强制性隐私权不受本政策排除。'}</footer>
      </div>
    </div>
  );
}
