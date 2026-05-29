'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User, UserOrganizationInfo, OrgRole } from '@/types/user';
import type { LoginRequest, LoginResponse } from '@/types/auth';
import { authApi } from '@/lib/auth';
import { STORAGE_KEYS } from '@/lib/storage';
import { hashPassword } from '@/lib/crypto';

interface AuthContextType {
  user: User | null;
  organizations: UserOrganizationInfo[];
  currentOrg: UserOrganizationInfo | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  switchOrganization: (orgId: string) => Promise<void>;
  hasOrgRole: (role: OrgRole) => boolean;
  hasAnyOrgRole: (...roles: OrgRole[]) => boolean;
  isPlatformAdmin: () => boolean;
  isSuperAdmin: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function clearStoredAuth() {
  localStorage.removeItem(STORAGE_KEYS.USER);
  localStorage.removeItem(STORAGE_KEYS.TOKENS);
  localStorage.removeItem(STORAGE_KEYS.ORGANIZATIONS);
  localStorage.removeItem(STORAGE_KEYS.CURRENT_ORG);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [organizations, setOrganizations] = useState<UserOrganizationInfo[]>([]);
  const [currentOrg, setCurrentOrg] = useState<UserOrganizationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applySession = useCallback((nextUser: User, nextOrg: UserOrganizationInfo | null) => {
    const nextOrgs = nextOrg ? [nextOrg] : [];
    setUser(nextUser);
    setOrganizations(nextOrgs);
    setCurrentOrg(nextOrg);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(nextUser));
    localStorage.setItem(STORAGE_KEYS.ORGANIZATIONS, JSON.stringify(nextOrgs));
    if (nextOrg) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_ORG, JSON.stringify(nextOrg));
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_ORG);
    }
  }, []);

  const resetSession = useCallback(() => {
    clearStoredAuth();
    setUser(null);
    setOrganizations([]);
    setCurrentOrg(null);
  }, []);

  // Validate the cookie-backed session with the backend before trusting stored UI state.
  useEffect(() => {
    let cancelled = false;

    const loadSession = async () => {
      try {
        const [currentUser, currentOrg] = await Promise.all([
          authApi.getCurrentUser(),
          authApi.getCurrentOrganization().catch(() => null),
        ]);
        if (cancelled) return;
        applySession(
          currentUser,
          currentOrg ? { ...currentOrg, orgRole: currentUser.systemRole } : null
        );
      } catch (error) {
        if (!cancelled) {
          resetSession();
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadSession();
    return () => {
      cancelled = true;
    };
  }, [applySession, resetSession]);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const hashedPassword = await hashPassword(password, email);
      const response: LoginResponse = await authApi.login({ email, password: hashedPassword });

      localStorage.removeItem(STORAGE_KEYS.TOKENS);
      applySession(response.user, response.currentOrg ?? response.organizations[0] ?? null);
    } finally {
      setIsLoading(false);
    }
  }, [applySession]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.warn('Logout request failed; clearing local session anyway.', error);
    } finally {
      resetSession();
    }
  }, [resetSession]);

  const switchOrganization = useCallback(async (orgId: string) => {
    const org = organizations.find(o => o.id === orgId);
    if (org) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_ORG, JSON.stringify(org));
      setCurrentOrg(org);
    }
  }, [organizations]);

  const hasOrgRole = useCallback((role: OrgRole): boolean => {
    return user?.systemRole === role || currentOrg?.orgRole === role;
  }, [currentOrg, user]);

  const hasAnyOrgRole = useCallback((...roles: OrgRole[]): boolean => {
    return roles.some((role) => user?.systemRole === role || currentOrg?.orgRole === role);
  }, [currentOrg, user]);

  const isPlatformAdmin = useCallback((): boolean => {
    return user?.systemRole === 'PLATFORM_ADMIN';
  }, [user]);

  const isSuperAdmin = isPlatformAdmin;

  // Listen for auth-expired event from api.ts refresh failure
  useEffect(() => {
    const handleAuthExpired = () => {
      resetSession();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    };
    window.addEventListener('schema:auth-expired', handleAuthExpired);
    return () => window.removeEventListener('schema:auth-expired', handleAuthExpired);
  }, [resetSession]);

  const value: AuthContextType = {
    user,
    organizations,
    currentOrg,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    switchOrganization,
    hasOrgRole,
    hasAnyOrgRole,
    isPlatformAdmin,
    isSuperAdmin,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
