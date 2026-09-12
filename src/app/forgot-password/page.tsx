'use client';

import Link from 'next/link';
import Image from 'next/image';

export default function ForgotPasswordPage() {
  return (
    <div className="yj-modern yj-public-shell flex min-h-screen items-center justify-center p-8">
      <div className="yj-panel yj-auth-card yj-auth-single">
        <div className="mb-8">
          <div className="yj-brand-lockup mb-8">
            <span className="yj-brand-mark">
              <Image src="/logo.svg" alt="YiJian" width={28} height={28} className="object-contain" />
            </span>
            <span>YiJian</span>
          </div>
          <h2 className="text-[28px] font-semibold leading-tight tracking-normal text-[var(--yj-text-strong)]">密码找回暂未启用</h2>
          <p className="mt-2 text-sm text-[var(--yj-text-muted)]">
            当前版本未启用自助密码找回。请联系平台管理员完成身份核验和改密。
          </p>
        </div>

        <p className="mt-2 text-center text-sm text-[var(--yj-text-muted)]">
          <Link href="/login" className="font-medium text-success-fg hover:underline">
            返回登录
          </Link>
        </p>
      </div>
    </div>
  );
}
