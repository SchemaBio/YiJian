'use client';
import { useText } from '@/i18n/useText';
import { translateUI } from '@/i18n/text';


import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { Tooltip } from '@schema/ui-kit';
import { ChevronLeft } from 'lucide-react';
import { UserMenu } from './UserMenu';
import { OrganizationSwitcher } from './OrganizationSwitcher';
import { useAuth } from '@/components/providers/AuthProvider';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';
import { mainNavItems, sidebarNavConfig, isNavItemActive, type SidebarNavItem, type NavItem } from '@/config/navigation';

interface SidebarNavProps {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

/**
 * SidebarNav displays main navigation and contextual sub-navigation.
 * Supports collapsed mode with icon-only display and tooltips.
 */
export function SidebarNav({ collapsed, onCollapsedChange }: SidebarNavProps) {
  const t = useText();
  const pathname = usePathname();
  const { isPlatformAdmin, currentOrg } = useAuth();

  const isAdmin = isPlatformAdmin();
  const isSaaS = getRuntimeBackendFlavor() === 'squid';
  const visibleMainNavItems = React.useMemo(
    () => mainNavItems.filter((item) =>
      (!item.saasOnly || isSaaS) && (!item.selfHostedOnly || !isSaaS) && (!item.platformAdminOnly || isAdmin)
    ),
    [isAdmin, isSaaS]
  );

  // Determine current section from pathname
  const currentSection = React.useMemo(() => {
    const segments = pathname.split('/').filter(Boolean);
    return segments[0] || 'samples';
  }, [pathname]);

  // Get sub navigation items and filter based on permissions
  const subItems = React.useMemo(() => {
    const items = (sidebarNavConfig[currentSection as keyof typeof sidebarNavConfig] || [])
      .filter((item) =>
        (!item.saasOnly || isSaaS) &&
        (!item.selfHostedOnly || !isSaaS) &&
        (!item.platformAdminOnly || isAdmin)
      );

    // For settings page, non-admins hide permissions and AI settings
    if (currentSection === 'settings' && !isAdmin) {
      return items.filter(item =>
        item.href !== '/settings/permissions' && item.href !== '/settings/ai'
      );
    }

    return items;
  }, [currentSection, isAdmin, isSaaS]);

  return (
    <aside
      className={`
        flex flex-col bg-[var(--yj-workspace-rail)] border-r border-[var(--yj-border-subtle)]
        transition-[width] duration-normal ease-default shrink-0
        ${collapsed ? 'w-16' : 'w-[224px]'}
      `}
      data-collapsed={collapsed}
    >
      {/* Logo + Collapse Button */}
      <div className={`
        flex items-center h-14 border-b border-[var(--yj-border-subtle)] px-3
        ${collapsed ? 'justify-center' : 'justify-between'}
      `}>
        {collapsed ? (
          <Tooltip content={t("common.expandSidebar8ab519")} placement="right" variant="nav">
            <button
              className="flex items-center min-w-0 cursor-pointer"
              onClick={() => onCollapsedChange(false)}
              type="button"
            >
              <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 overflow-hidden">
                <Image
                  src="/logo.svg"
                  alt={t("common.appName")}
                  width={32}
                  height={32}
                  className="object-contain"
                />
              </div>
            </button>
          </Tooltip>
        ) : (
          <div className="flex items-center min-w-0">
            <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 overflow-hidden">
              <Image
                src="/logo.svg"
                alt={t("common.appName")}
                width={32}
                height={32}
                className="object-contain"
              />
            </div>
            <span className="ml-2 font-semibold text-[15px] text-fg-default truncate">
              {t("common.appName")}</span>
          </div>
        )}
        {!collapsed && (
          <button
            onClick={() => onCollapsedChange(true)}
            className="p-1.5 rounded-md text-fg-muted hover:text-fg-default hover:bg-[var(--yj-panel-muted)] transition-colors duration-fast shrink-0"
            aria-label={t("common.collapseSidebar3a90f6")}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Organization Switcher */}
      {(isSaaS || currentOrg) && <div className="border-b border-[var(--yj-border-subtle)] px-3">
        <OrganizationSwitcher collapsed={collapsed} />
      </div>}

      {/* Main Navigation */}
      <nav className="py-2.5 border-b border-[var(--yj-border-subtle)]">
        <ul className="space-y-0.5 px-2">
          {visibleMainNavItems.map((item) => (
            <MainNavItemComponent
              key={item.href}
              item={item}
              collapsed={collapsed}
              currentPath={pathname}
            />
          ))}
        </ul>
      </nav>

      {/* Sub Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2">
        {!collapsed && subItems.length > 0 && (
          <div className="px-3 mb-1.5">
            <span className="text-[11px] font-medium text-fg-muted uppercase tracking-wider">
              {visibleMainNavItems.find(item => item.href.includes(currentSection))?.label ||
                (currentSection === 'settings' ? t("common.systemSettingse976ea") : t("common.submenuc1c3c6"))}
            </span>
          </div>
        )}
        <ul className="space-y-0.5 px-2">
          {subItems.map((item) => (
            <SubNavItemComponent
              key={item.href}
              item={item}
              collapsed={collapsed}
              currentPath={pathname}
            />
          ))}
        </ul>
      </nav>

      {/* Bottom section: User Menu */}
      <div className="border-t border-[var(--yj-border-subtle)] p-2 mt-auto flex justify-center">
        <UserMenu collapsed={collapsed} />
      </div>
    </aside>
  );
}

interface MainNavItemComponentProps {
  item: NavItem;
  collapsed: boolean;
  currentPath: string;
}

function MainNavItemComponent({ item, collapsed, currentPath }: MainNavItemComponentProps) {
  const t = useText();
  const isActive = isNavItemActive(item.href, currentPath);
  const Icon = item.icon;

  const content = (
    <Link
      href={item.href}
      className={`
        relative flex items-center gap-3 px-3 py-2 rounded-md text-sm
        transition-all duration-fast
        ${
          isActive
            ? 'bg-[var(--yj-sage-subtle)] text-accent-fg font-medium'
            : 'text-fg-default hover:bg-[var(--yj-panel-subtle)] hover:text-fg-default'
        }
        ${collapsed ? 'justify-center' : ''}
      `}
      aria-current={isActive ? 'page' : undefined}
    >
      {Icon && <Icon className="w-4 h-4 shrink-0" />}
      {!collapsed && <span className="truncate">{translateUI(item.label, t)}</span>}
    </Link>
  );

  if (collapsed) {
    return (
      <li>
        <Tooltip content={translateUI(item.label, t)} placement="right" variant="nav">
          {content}
        </Tooltip>
      </li>
    );
  }

  return <li>{content}</li>;
}

interface SubNavItemComponentProps {
  item: SidebarNavItem;
  collapsed: boolean;
  currentPath: string;
}

function SubNavItemComponent({ item, collapsed, currentPath }: SubNavItemComponentProps) {
  const t = useText();
  const router = useRouter();
  const itemSegments = item.href.split('/').filter(Boolean);
  const isSectionRoot = itemSegments.length === 1;
  const isActive = isSectionRoot
    ? item.href === currentPath
    : item.href === currentPath || currentPath.startsWith(`${item.href}/`);
  const Icon = item.icon;

  if (item.disabled) {
    return <li><Tooltip content={t('familyAnalysis.unavailable')} placement="right" variant="nav">
      <span role="link" aria-disabled="true" tabIndex={0} className={`flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm text-fg-muted opacity-50 ${collapsed ? 'justify-center' : ''}`}>
        {Icon && <Icon className="h-4 w-4 shrink-0" />}
        {!collapsed && <span className="truncate">{translateUI(item.label, t)}</span>}
      </span>
    </Tooltip></li>;
  }

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // 如果点击已激活的家系管理链接，强制刷新并添加 reset 参数
    if (item.href === '/samples/pedigree' && isActive) {
      e.preventDefault();
      router.push('/samples/pedigree?reset=1');
    }
  };

  const content = (
    <Link
      href={item.href}
      onClick={handleClick}
      className={`
        relative flex items-center gap-3 px-3 py-2 rounded-md text-sm
        transition-all duration-fast
        ${
          isActive
            ? 'bg-[var(--yj-sage-subtle)] text-fg-default font-medium'
            : 'text-fg-muted hover:text-fg-default hover:bg-[var(--yj-panel-subtle)]'
        }
        ${collapsed ? 'justify-center' : ''}
      `}
      aria-current={isActive ? 'page' : undefined}
    >
      {Icon && <Icon className="w-4 h-4 shrink-0" />}
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{translateUI(item.label, t)}</span>
          {item.badge !== undefined && (
            <span className="px-1.5 py-0.5 text-xs rounded-full bg-accent-subtle text-accent-fg">
              {item.badge}
            </span>
          )}
        </>
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <li>
        <Tooltip content={translateUI(item.label, t)} placement="right" variant="nav">
          {content}
        </Tooltip>
      </li>
    );
  }

  return <li>{content}</li>;
}
