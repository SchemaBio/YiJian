'use client';

import * as React from 'react';
import { ThemeProvider } from '@schema/ui-kit';
import { AIAssistanceProvider } from './AIAssistanceProvider';
import { AuthProvider, useAuth } from './AuthProvider';
import { AIProvider } from './AIProvider';
import { UploadProvider } from './UploadProvider';
import { LocaleProvider } from './LocaleProvider';
import { setAssessmentCacheScope } from '@/lib/assessment/cache';
import type { Locale } from '@/i18n/locales';

interface AppProvidersProps {
  children: React.ReactNode;
  locale: Locale;
}

/**
 * AppProviders wraps the application with all necessary providers.
 * Includes ThemeProvider for theme management,
 * AuthProvider for authentication,
 * and AIProvider for AI assistant configuration.
 */
export function AppProviders({ children, locale }: AppProvidersProps) {
  return (
    <LocaleProvider initialLocale={locale}>
    <ThemeProvider defaultTheme="light" storageKey="germline-theme">
      <AuthProvider>
        <UploadProvider>
          <AIProvider>
            <AssistanceScope>{children}</AssistanceScope>
          </AIProvider>
        </UploadProvider>
      </AuthProvider>
    </ThemeProvider>
    </LocaleProvider>
  );
}

function AssistanceScope({ children }: { children: React.ReactNode }) {
  const { user, currentOrg } = useAuth();
  const scope = user ? `${user.id}:${currentOrg?.id ?? ''}` : 'anonymous';
  React.useEffect(() => { setAssessmentCacheScope(scope); }, [scope]);
  return <AIAssistanceProvider key={scope} scope={scope}>{children}</AIAssistanceProvider>;
}
