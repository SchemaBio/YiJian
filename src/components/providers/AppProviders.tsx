'use client';

import * as React from 'react';
import { ThemeProvider } from '@schema/ui-kit';
import { AIAssistanceProvider } from './AIAssistanceProvider';
import { AuthProvider, useAuth } from './AuthProvider';
import { AIProvider } from './AIProvider';
import { UploadProvider } from './UploadProvider';

interface AppProvidersProps {
  children: React.ReactNode;
}

/**
 * AppProviders wraps the application with all necessary providers.
 * Includes ThemeProvider for theme management,
 * AuthProvider for authentication,
 * and AIProvider for AI assistant configuration.
 */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ThemeProvider defaultTheme="light" storageKey="germline-theme">
      <AuthProvider>
        <UploadProvider>
          <AIProvider>
            <AssistanceScope>{children}</AssistanceScope>
          </AIProvider>
        </UploadProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

function AssistanceScope({ children }: { children: React.ReactNode }) {
  const { user, currentOrg } = useAuth();
  const scope = user ? `${user.id}:${currentOrg?.id ?? ''}` : 'anonymous';
  return <AIAssistanceProvider key={scope} scope={scope}>{children}</AIAssistanceProvider>;
}
