import type { SystemRole, User, UserOrganizationInfo } from './user';

// 用户信息 (legacy compatibility)
export type UserRole = SystemRole;

// 登录请求
export interface LoginRequest {
  email: string;
  password: string;
}

// 登录响应
export interface LoginResponse {
  user: User;
  organizations: UserOrganizationInfo[];
  currentOrg?: UserOrganizationInfo;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

// 刷新 Token 请求
export interface RefreshTokenRequest {
  refreshToken: string;
}

// 刷新 Token 响应
export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

// Legacy compatibility: SaaS mode does not switch organizations.
export interface SwitchOrganizationRequest {
  orgId: string;
}
