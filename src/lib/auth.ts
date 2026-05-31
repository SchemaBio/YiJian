import { api, clearAuthSession, clearLegacyAuthTokens } from './api';
import type {
  LoginRequest,
  LoginResponse,
} from '@/types/auth';
import type { Organization, SystemRole, UserOrganizationInfo } from '@/types/user';

interface BackendOrganization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  max_concurrent_tasks?: number;
  balance_alert_threshold?: number;
  storage_quota_bytes?: number;
  is_active?: boolean;
}

interface BackendLoginData {
  user: {
    id: string;
    email: string;
    name: string;
    system_role: string;
    org_id?: string;
    is_active: boolean;
    approval_status?: 'approved' | 'pending' | 'rejected';
    created_at: string;
    updated_at: string;
  };
  organization?: BackendOrganization | null;
}

type BackendUser = BackendLoginData['user'];

function mapSystemRole(role: string): SystemRole {
  return role === 'PLATFORM_ADMIN' ? 'PLATFORM_ADMIN' : 'ORG_USER';
}

function mapUser(user: BackendUser) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    systemRole: mapSystemRole(user.system_role),
    orgId: user.org_id,
    isActive: user.is_active,
    approvalStatus: user.approval_status,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

function mapOrganization(org: BackendOrganization, role: SystemRole): UserOrganizationInfo {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    description: org.description,
    orgRole: role,
    maxConcurrentTasks: org.max_concurrent_tasks,
    balanceAlertThreshold: org.balance_alert_threshold,
    storageQuotaBytes: org.storage_quota_bytes,
    isActive: org.is_active,
  };
}

function mapLoginResponse(data: BackendLoginData): LoginResponse {
  const systemRole = mapSystemRole(data.user.system_role);
  const currentOrg = data.organization ? mapOrganization(data.organization, systemRole) : undefined;

  return {
    user: mapUser(data.user),
    organizations: currentOrg ? [currentOrg] : [],
    currentOrg,
  };
}

export const authApi = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const backendData = await api.post<BackendLoginData>(
      '/v1/auth/login',
      data
    );
    const response = mapLoginResponse(backendData);
    clearLegacyAuthTokens();
    return response;
  },

  logout: async (): Promise<void> => {
    try {
      await api.post('/v1/auth/logout');
    } finally {
      clearAuthSession();
    }
  },

  getCurrentUser: async () => {
    const backendData = await api.get<BackendUser>('/v1/auth/me');
    return mapUser(backendData);
  },

  getCurrentOrganization: async (): Promise<Organization> => {
    const backendData = await api.get<BackendOrganization>('/v1/orgs/me');
    return {
      id: backendData.id,
      name: backendData.name,
      slug: backendData.slug,
      description: backendData.description,
      maxConcurrentTasks: backendData.max_concurrent_tasks,
      balanceAlertThreshold: backendData.balance_alert_threshold,
      storageQuotaBytes: backendData.storage_quota_bytes,
      isActive: backendData.is_active,
    };
  },

  getUserOrganizations: async (): Promise<{ organizations: Array<{
    id: string;
    name: string;
    slug: string;
    description?: string;
    orgRole: string;
    joinedAt?: string;
  }> }> => {
    const backendData = await api.get<BackendOrganization>('/v1/orgs/me');
    return {
      organizations: [mapOrganization(backendData, 'ORG_USER')],
    };
  },
};
