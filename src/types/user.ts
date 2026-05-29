// System-level roles
export type SystemRole = 'PLATFORM_ADMIN' | 'ORG_USER';

// Legacy UI compatibility: SaaS mode only has account-level roles.
export type OrgRole = SystemRole;

// Organization info
export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  maxConcurrentTasks?: number;
  balanceAlertThreshold?: number;
  storageQuotaBytes?: number;
  isActive?: boolean;
}

// 用户信息
export interface User {
  id: string;
  email: string;
  name: string;
  systemRole: SystemRole;
  orgId?: string;
  isActive: boolean;
  approvalStatus?: 'approved' | 'pending' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

// Organization info for user
export interface UserOrganizationInfo {
  id: string;
  name: string;
  slug: string;
  description?: string;
  orgRole: OrgRole;
  joinedAt?: string;
  maxConcurrentTasks?: number;
  balanceAlertThreshold?: number;
  storageQuotaBytes?: number;
  isActive?: boolean;
}

// 创建用户请求
export interface UserCreateRequest {
  email: string;
  name: string;
  password: string;
  systemRole?: SystemRole;
  orgId?: string;
}

// 更新用户请求
export interface UserUpdateRequest {
  name?: string;
  systemRole?: SystemRole;
  orgId?: string;
}

// 修改密码请求
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// 重置密码请求
export interface ResetPasswordRequest {
  newPassword: string;
}
