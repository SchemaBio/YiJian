import { api } from './api';
import type { SystemRole, User } from '@/types/user';
import { hashPassword } from './crypto';
import { getRuntimeBackendFlavor } from './runtime-config';

interface BackendUser {
  id: string;
  email: string;
  name: string;
  permissions?: string[];
  system_role?: string;
  systemRole?: string;
  org_id?: string;
  orgId?: string;
  is_active?: boolean;
  isActive?: boolean;
  approval_status?: 'approved' | 'pending' | 'rejected';
  approvalStatus?: 'approved' | 'pending' | 'rejected';
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
}

interface UserListResponse {
  items?: BackendUser[];
  total?: number;
  page?: number;
  page_size?: number;
  pageSize?: number;
  total_pages?: number;
  totalPages?: number;
}

export interface UserListResult {
  items: User[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface UpdateUserInput {
  permissions?: string[];
  name?: string;
  systemRole?: SystemRole;
  isActive?: boolean;
}

export interface CreateUserInput {
  permissions?: string[];
  email: string;
  name: string;
  password: string;
  systemRole: SystemRole;
}

function backendSystemRole(role: SystemRole): string {
  if (getRuntimeBackendFlavor() === 'octopus') {
    return role === 'PLATFORM_ADMIN' ? 'SUPER_ADMIN' : 'USER';
  }
  return role;
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const email = input.email.trim().toLowerCase();
  const data = await api.post<BackendUser>('/v1/users', {
    email, name: input.name.trim(),
    password: await hashPassword(input.password, email),
    system_role: backendSystemRole(input.systemRole),
    ...(input.permissions !== undefined ? { permissions: input.permissions } : {}),
  }, { coreApi: false });
  return normalizeUser(data);
}

function mapSystemRole(role?: string): SystemRole {
  return role === 'PLATFORM_ADMIN' || role === 'SUPER_ADMIN' ? 'PLATFORM_ADMIN' : 'ORG_USER';
}

export function normalizeUser(user: BackendUser): User {
  return {
    id: String(user.id),
    email: user.email,
    name: user.name,
    permissions: user.permissions ?? [],
    systemRole: mapSystemRole(user.system_role ?? user.systemRole),
    orgId: user.org_id ?? user.orgId,
    isActive: user.is_active ?? user.isActive ?? false,
    approvalStatus: user.approval_status ?? user.approvalStatus,
    createdAt: user.created_at ?? user.createdAt ?? '',
    updatedAt: user.updated_at ?? user.updatedAt ?? '',
  };
}

export async function listUsers(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  orgId?: string;
} = {}): Promise<UserListResult> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const data = await api.get<UserListResponse>('/v1/users', {
    coreApi: false,
    params: {
      page: String(page),
      page_size: String(pageSize),
      ...(params.search ? { search: params.search } : {}),
      ...(params.orgId ? { org_id: params.orgId } : {}),
    },
  });

  const items = (data.items ?? []).map(normalizeUser);
  return {
    items,
    total: data.total ?? items.length,
    page: data.page ?? page,
    pageSize: data.page_size ?? data.pageSize ?? pageSize,
    totalPages: data.total_pages ?? data.totalPages ?? 1,
  };
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<User> {
  const data = await api.put<BackendUser>(`/v1/users/${encodeURIComponent(id)}`, {
    ...(input.permissions !== undefined ? { permissions: input.permissions } : {}),
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.systemRole !== undefined ? { system_role: backendSystemRole(input.systemRole) } : {}),
    ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
  }, { coreApi: false });
  return normalizeUser(data);
}

export async function deleteUser(id: string): Promise<void> {
  await api.delete(`/v1/users/${encodeURIComponent(id)}`, { coreApi: false });
}

export async function listPendingUsers(): Promise<User[]> {
  const data = await api.get<BackendUser[] | { users?: BackendUser[]; items?: BackendUser[] }>(
    '/v1/users/pending',
    { coreApi: false }
  );
  const items = Array.isArray(data)
    ? data
    : data.items ?? data.users ?? [];
  return items.map(normalizeUser);
}

export async function approveUser(id: string): Promise<void> {
  await api.post(`/v1/users/${encodeURIComponent(id)}/approve`, undefined, { coreApi: false });
}

export async function rejectUser(id: string): Promise<void> {
  await api.post(`/v1/users/${encodeURIComponent(id)}/reject`, undefined, { coreApi: false });
}
