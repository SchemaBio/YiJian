'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useText } from '@/i18n/useText';

type ChallengeAPI = {
  render(element: HTMLElement, options: Record<string, unknown>): string;
  remove(id: string): void;
};
declare global { interface Window { turnstile?: ChallengeAPI } }
export type RegistrationAvailability = { enabled: boolean; site_key: string };

export function useRegistrationAvailability(enabled = true) {
  const [config, setConfig] = useState<RegistrationAvailability | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    api.get<RegistrationAvailability>('/v1/auth/registration-config', { coreApi: false }).then(value => {
      if (active) setConfig(value);
    }).catch(() => { if (active) setConfig({ enabled: false, site_key: '' }); });
    return () => { active = false; };
  }, [enabled]);
  return config;
}

let scriptReady: Promise<void> | undefined;
function loadChallenge() {
  if (window.turnstile) return Promise.resolve();
  if (!scriptReady) scriptReady = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    const timeout = window.setTimeout(() => { script.remove(); scriptReady = undefined; reject(new Error('challenge timeout')); }, 15000);
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => { window.clearTimeout(timeout); resolve(); };
    script.onerror = () => { window.clearTimeout(timeout); script.remove(); scriptReady = undefined; reject(new Error('challenge unavailable')); };
    document.head.appendChild(script);
  });
  return scriptReady;
}

export function RegistrationChallenge({ siteKey, action, generation, onToken }: {
  siteKey: string; action: 'registration' | 'registration-resend'; generation: number; onToken: (token: string) => void;
}) {
  const t = useText();
  const root = useRef<HTMLDivElement>(null);
  const callback = useRef(onToken); callback.current = onToken;
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    let id: string | undefined;
    setFailed(false); callback.current('');
    loadChallenge().then(() => {
      if (!active || !root.current || !window.turnstile) return;
      id = window.turnstile.render(root.current, {
        sitekey: siteKey, action,
        language: ({ 'zh-CN': 'zh-CN', 'zh-Hant': 'zh-TW', en: 'en', 'es-419': 'es' })[t.locale],
        callback: (token: string) => { if (active) { setFailed(false); callback.current(token); } },
        'expired-callback': () => { if (active) { callback.current(''); setFailed(true); } },
        'error-callback': () => { if (active) { callback.current(''); setFailed(true); } },
      });
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; if (id) window.turnstile?.remove(id); };
  }, [siteKey, action, generation, retry, t.locale]);
  return <div><div ref={root} />{failed ? <div><p role="alert">{t('registration.challengeFailed')}</p><button type="button" className="text-accent-fg underline" onClick={() => setRetry(value => value + 1)}>{t('registration.retryChallenge')}</button></div> : null}</div>;
}
