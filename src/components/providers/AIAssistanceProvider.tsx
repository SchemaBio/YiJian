'use client';
import * as React from 'react';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';
import { pendingAIAssistanceAdapter, type AIAssistanceAdapter, type AIAssistanceSettings, type AIFeature, type AIDeployment } from '@/lib/ai-assistance';
import { httpAIAssistanceAdapter } from '@/lib/ai-assistance-client';

interface AssistanceContext {
  adapter: AIAssistanceAdapter;
  settings: AIAssistanceSettings;
  deployment: AIDeployment;
  skipConfirmation: (feature: AIFeature) => boolean;
  setSkipConfirmation: (feature: AIFeature, value: boolean) => void;
  setSettings: (value: AIAssistanceSettings) => void;
}
const Context = React.createContext<AssistanceContext | null>(null);
const PREFIX = 'yijian:ai-charge-confirmation:v2:';
const FEATURES: AIFeature[] = ['hpo', 'acmg', 'svcv4', 'cnv_gain', 'cnv_loss'];

export function AIAssistanceProvider({ children, adapter = httpAIAssistanceAdapter, deployment = getRuntimeBackendFlavor() === 'squid' ? 'saas' : 'opensource', scope = 'session' }: {
  children: React.ReactNode; adapter?: AIAssistanceAdapter; deployment?: AIDeployment; scope?: string;
}) {
  const [settings, setSettings] = React.useState<AIAssistanceSettings>({ enabled: deployment === 'saas', connected: false, configured: false });
  const [skipped, setSkip] = React.useState<Partial<Record<AIFeature, boolean>>>({});
  const sessionKey = `${PREFIX}${scope}:`;
  React.useEffect(() => {
    // Legacy shared preferences cannot establish consent for any individual feature.
    try { setSkip(Object.fromEntries(FEATURES.map(feature => [feature, sessionStorage.getItem(sessionKey + feature) === '1']))); } catch { setSkip({}); }
    const controller = new AbortController();
    setSettings({ enabled: deployment === 'saas', connected: false, configured: false });
    const refresh = () => { void adapter.getSettings(deployment, controller.signal).then(value => { if (!controller.signal.aborted) setSettings(value); }).catch(() => { if (!controller.signal.aborted) setSettings(previous => ({ ...previous, connected: false, configured: false })); }); };
    refresh(); const timer = setInterval(refresh, 30000);
    return () => { clearInterval(timer); controller.abort(); };
  }, [adapter, deployment, sessionKey]);
  const skipConfirmation = React.useCallback((feature: AIFeature) => skipped[feature] === true, [skipped]);
  const setSkipConfirmation = React.useCallback((feature: AIFeature, value: boolean) => {
    setSkip(previous => ({ ...previous, [feature]: value }));
    try { if (value) sessionStorage.setItem(sessionKey + feature, '1'); else sessionStorage.removeItem(sessionKey + feature); } catch { /* In-memory preference remains available. */ }
  }, [sessionKey]);
  return <Context.Provider value={{ adapter, settings, deployment, skipConfirmation, setSkipConfirmation, setSettings }}>{children}</Context.Provider>;
}

export function useAIAssistance() {
  const context = React.useContext(Context);
  // Existing panels can also render in isolation (story/test/embedded workspace).
  return context ?? { adapter: pendingAIAssistanceAdapter, settings: { enabled: getRuntimeBackendFlavor() === 'squid', connected: false, configured: false }, deployment: getRuntimeBackendFlavor() === 'squid' ? 'saas' as const : 'opensource' as const, skipConfirmation: () => false, setSkipConfirmation: () => undefined, setSettings: () => undefined };
}
