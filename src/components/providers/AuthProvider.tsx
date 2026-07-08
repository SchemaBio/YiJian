'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User, UserOrganizationInfo, OrgRole } from '@/types/user';
import type { LoginResponse } from '@/types/auth';
import { authApi } from '@/lib/auth';
import { STORAGE_KEYS } from '@/lib/storage';
import { hashPassword } from '@/lib/crypto';

const DEV_MOCK_AUTH = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_DEV_MOCK_AUTH === 'true';

const MOCK_USER: User = {
  id: 'dev-mock-user-001',
  email: 'dev@example.com',
  name: '开发者',
  systemRole: 'PLATFORM_ADMIN',
  orgId: 'dev-mock-org-001',
  isActive: true,
  approvalStatus: 'approved',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const MOCK_ORG: UserOrganizationInfo = {
  id: 'dev-mock-org-001',
  name: '开发测试机构',
  slug: 'dev-lab',
  description: '本地开发环境',
  orgRole: 'PLATFORM_ADMIN',
  isActive: true,
};

interface AuthContextType {
  user: User | null;
  organizations: UserOrganizationInfo[];
  currentOrg: UserOrganizationInfo | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: { name: string }) => Promise<User>;
  switchOrganization: (orgId: string) => Promise<void>;
  hasOrgRole: (role: OrgRole) => boolean;
  hasAnyOrgRole: (...roles: OrgRole[]) => boolean;
  isPlatformAdmin: () => boolean;
  isSuperAdmin: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function clearStoredAuth() {
  localStorage.removeItem(STORAGE_KEYS.USER);
  localStorage.removeItem(STORAGE_KEYS.LEGACY_AUTH_TOKENS);
  localStorage.removeItem(STORAGE_KEYS.ORGANIZATIONS);
  localStorage.removeItem(STORAGE_KEYS.CURRENT_ORG);
}

function persistDevAuthState(nextUser: User, nextOrgs: UserOrganizationInfo[], nextOrg: UserOrganizationInfo | null) {
  if (!DEV_MOCK_AUTH) {
    // Production sessions are cookie-backed and revalidated with the backend on
    // page load. Do not keep account/org profile data in localStorage.
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.ORGANIZATIONS);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_ORG);
    return;
  }

  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(nextUser));
  localStorage.setItem(STORAGE_KEYS.ORGANIZATIONS, JSON.stringify(nextOrgs));
  if (nextOrg) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_ORG, JSON.stringify(nextOrg));
  } else {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_ORG);
  }
}

function loginRedirectForCurrentPath(): string {
  if (typeof window === 'undefined') return '/login';
  if (window.location.pathname === '/login') return '/login';
  const next = `${window.location.pathname}${window.location.search}`;
  if (!next) return '/login';
  return `/login?next=${encodeURIComponent(next)}`;
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
    persistDevAuthState(nextUser, nextOrgs, nextOrg);
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
      if (DEV_MOCK_AUTH) {
        const storedUser = localStorage.getItem(STORAGE_KEYS.USER);
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser) as User;
            applySession(parsed, MOCK_ORG);
          } catch {
            resetSession();
          }
        }
        setIsLoading(false);
        return;
      }

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
      } catch {
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
      if (DEV_MOCK_AUTH) {
        applySession({ ...MOCK_USER, email }, MOCK_ORG);
        return;
      }
      const hashedPassword = await hashPassword(password, email);
      const response: LoginResponse = await authApi.login({ email, password: hashedPassword });

      localStorage.removeItem(STORAGE_KEYS.LEGACY_AUTH_TOKENS);
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

  const updateProfile = useCallback(async (data: { name: string }): Promise<User> => {
    if (!user) {
      throw new Error('Not authenticated');
    }
    if (DEV_MOCK_AUTH) {
      const nextUser = { ...user, name: data.name, updatedAt: new Date().toISOString() };
      setUser(nextUser);
      persistDevAuthState(nextUser, organizations, currentOrg);
      return nextUser;
    }
    const nextUser = await authApi.updateProfile(data);
    setUser(nextUser);
    persistDevAuthState(nextUser, organizations, currentOrg);
    return nextUser;
  }, [currentOrg, organizations, user]);

  const switchOrganization = useCallback(async (orgId: string) => {
    const org = organizations.find(o => o.id === orgId);
    if (org) {
      if (DEV_MOCK_AUTH) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_ORG, JSON.stringify(org));
      }
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

  // Listen for auth-expired event from api.ts refresh failure.
  useEffect(() => {
    const handleAuthExpired = () => {
      resetSession();
      if (typeof window !== 'undefined') {
        window.location.href = loginRedirectForCurrentPath();
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
    updateProfile,
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
