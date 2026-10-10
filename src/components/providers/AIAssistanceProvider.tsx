'use client';
import * as React from 'react';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';
import { pendingAIAssistanceAdapter, type AIAssistanceAdapter, type AIAssistanceSettings, type AIDeployment } from '@/lib/ai-assistance';

interface AssistanceContext {
  adapter: AIAssistanceAdapter;
  settings: AIAssistanceSettings;
  deployment: AIDeployment;
  skipConfirmation: boolean;
  setSkipConfirmation: (value: boolean) => void;
  setSettings: (value: AIAssistanceSettings) => void;
}
const Context = React.createContext<AssistanceContext | null>(null);
const PREFIX = 'yijian:ai-charge-confirmation:';

export function AIAssistanceProvider({ children, adapter = pendingAIAssistanceAdapter, deployment = getRuntimeBackendFlavor() === 'squid' ? 'saas' : 'opensource', scope = 'session' }: {
  children: React.ReactNode; adapter?: AIAssistanceAdapter; deployment?: AIDeployment; scope?: string;
}) {
  const [settings, setSettings] = React.useState<AIAssistanceSettings>({ enabled: deployment === 'saas', connected: false, configured: false });
  const [skipConfirmation, setSkip] = React.useState(false);
  const sessionKey = `${PREFIX}${scope}`;
  React.useEffect(() => {
    try { setSkip(sessionStorage.getItem(sessionKey) === '1'); } catch { setSkip(false); }
    const controller = new AbortController();
    setSettings({ enabled: deployment === 'saas', connected: false, configured: false });
    void adapter.getSettings(deployment, controller.signal).then(value => { if (!controller.signal.aborted) setSettings(value); }).catch(() => undefined);
    return () => controller.abort();
  }, [adapter, deployment, sessionKey]);
  const setSkipConfirmation = React.useCallback((value: boolean) => {
    setSkip(value);
    try { if (value) sessionStorage.setItem(sessionKey, '1'); else sessionStorage.removeItem(sessionKey); } catch { /* In-memory preference remains available. */ }
  }, [sessionKey]);
  return <Context.Provider value={{ adapter, settings, deployment, skipConfirmation, setSkipConfirmation, setSettings }}>{children}</Context.Provider>;
}

export function useAIAssistance() {
  const context = React.useContext(Context);
  // Existing panels can also render in isolation (story/test/embedded workspace).
  return context ?? { adapter: pendingAIAssistanceAdapter, settings: { enabled: getRuntimeBackendFlavor() === 'squid', connected: false, configured: false }, deployment: getRuntimeBackendFlavor() === 'squid' ? 'saas' as const : 'opensource' as const, skipConfirmation: false, setSkipConfirmation: () => undefined, setSettings: () => undefined };
}
