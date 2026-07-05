import {
  Users,
  GitBranch,
  List,
  FileText,
  User,
  Shield,
  Coins,
  Workflow,
  FileCode,
  TrendingUp,
  History,
  Library,
  LayoutDashboard,
  ListTodo,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon?: LucideIcon;
}

export interface SidebarNavItem {
  label: string;
  href: string;
  icon?: LucideIcon;
  badge?: string | number;
  children?: SidebarNavItem[];
}

export interface SidebarNavConfig {
  dashboard: SidebarNavItem[];
  samples: SidebarNavItem[];
  tasks: SidebarNavItem[];
  pipeline: SidebarNavItem[];
  history: SidebarNavItem[];
  admin: SidebarNavItem[];
  settings: SidebarNavItem[];
}

/** Main navigation items displayed in the sidebar. */
export const mainNavItems: NavItem[] = [
  { label: '概览', href: '/dashboard', icon: LayoutDashboard },
  { label: '样本管理', href: '/samples', icon: Users },
  { label: '任务中心', href: '/tasks', icon: ListTodo },
  { label: '历史检出', href: '/history', icon: History },
  { label: '流程中心', href: '/pipeline', icon: Workflow },
  { label: '管理中心', href: '/admin', icon: ShieldCheck },
];

/** Sidebar navigation configuration for each section. */
export const sidebarNavConfig: SidebarNavConfig = {
  dashboard: [],
  samples: [
    { label: '样本列表', href: '/samples', icon: List },
    { label: '家系管理', href: '/samples/pedigree', icon: GitBranch },
  ],
  tasks: [],
  pipeline: [
    { label: '流程列表', href: '/pipeline', icon: List },
    { label: '基因列表', href: '/pipeline/gene-list', icon: Library },
    { label: 'BED 文件', href: '/pipeline/bed', icon: FileCode },
    { label: '基线管理', href: '/pipeline/baseline', icon: TrendingUp },
    { label: '报告模板', href: '/pipeline/templates', icon: FileText },
  ],
  history: [],
  admin: [],
  settings: [
    { label: '个人设置', href: '/settings', icon: User },
    { label: '权限管理', href: '/settings/permissions', icon: Shield },
    { label: '计费与余额', href: '/settings/billing', icon: Coins },
  ],
};

/** Get the section key from a pathname. */
export function getSectionFromPath(pathname: string): keyof SidebarNavConfig {
  const segments = pathname.split('/').filter(Boolean);
  const section = segments[0] || 'samples';

  if (section in sidebarNavConfig) {
    return section as keyof SidebarNavConfig;
  }

  return 'samples';
}

/** Check if a navigation item is active based on the current path. */
export function isNavItemActive(itemHref: string, currentPath: string): boolean {
  if (itemHref === currentPath) {
    return true;
  }

  const itemSegments = itemHref.split('/').filter(Boolean);
  const currentSegments = currentPath.split('/').filter(Boolean);

  if (itemSegments.length === 1) {
    return currentSegments[0] === itemSegments[0];
  }

  return currentPath.startsWith(itemHref);
}
