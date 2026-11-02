'use client';

import * as React from 'react';
import Image from 'next/image';
import { DnaHelix } from '@/components/DnaHelix';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { useText } from '@/i18n/useText';

export interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const t = useText();

  return (
    <div className="yj-modern yj-public-shell relative flex min-h-screen">
      <LanguageSwitcher />
      <div
        className="relative hidden items-center justify-center overflow-hidden bg-[var(--yj-panel-subtle)] lg:flex lg:w-1/2 xl:w-3/5"
        style={{ color: 'rgba(26, 127, 55, 0.28)' }}
      >
        <DnaHelix />
      </div>

      <div className="flex flex-1 items-center justify-center bg-[var(--yj-panel-bg)] px-5 py-20 sm:px-8">
        <div className="w-full max-w-md">
          <div className="yj-brand-lockup mb-6">
            <span className="yj-brand-mark">
              <Image src="/logo.svg" alt="YiJian" width={28} height={28} className="object-contain" />
            </span>
            <span>YiJian</span>
          </div>

          {children}

          <p className="mt-8 text-center text-xs text-[var(--yj-text-muted)] lg:hidden">
            © 2024–{new Date().getFullYear()}  {t("interface.schemabioAllRightsReservedfbafaf")}
          </p>
        </div>
      </div>
    </div>
  );
}
