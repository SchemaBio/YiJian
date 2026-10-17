import type { User } from '@/types/user';

export const BUSINESS_PERMISSIONS = ['samples.write', 'data.manage', 'tasks.manage', 'pipelines.manage', 'gene_lists.manage', 'bed.manage', 'baselines.manage', 'report_services.manage', 'interpretation_reports.manage'] as const;
export type BusinessPermission = typeof BUSINESS_PERMISSIONS[number];

export function userHasPermission(user: User | null, permission: BusinessPermission, backend: 'octopus' | 'squid'): boolean {
  if (backend === 'squid') return true;
  return !!user && (user.systemRole === 'PLATFORM_ADMIN' || user.permissions?.includes(permission) === true);
}

export function permissionForPath(path: string): BusinessPermission | null {
  if (path.startsWith('/samples')) return 'samples.write';
  if (path.startsWith('/data')) return 'data.manage';
  if (path.startsWith('/pipeline/gene-list')) return 'gene_lists.manage';
  if (path.startsWith('/pipeline/bed')) return 'bed.manage';
  if (path.startsWith('/pipeline/baseline')) return 'baselines.manage';
  if (path.startsWith('/pipeline/templates')) return 'report_services.manage';
  if (path.startsWith('/pipeline')) return 'pipelines.manage';
  if (path === '/tasks' || path.startsWith('/tasks/new')) return 'tasks.manage';
  if (path.startsWith('/tasks/') || path.startsWith('/history')) return 'interpretation_reports.manage';
  return null;
}
