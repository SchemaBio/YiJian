import type { SystemRole, User, UserOrganizationInfo } from './user';

export type UserRole = SystemRole;

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  organizations: UserOrganizationInfo[];
  currentOrg?: UserOrganizationInfo;
}

// Legacy compatibility: SaaS mode does not switch organizations.
export interface SwitchOrganizationRequest {
  orgId: string;
}
