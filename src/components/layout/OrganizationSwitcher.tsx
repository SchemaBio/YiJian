'use client';

import { Building2 } from 'lucide-react';
import { Tooltip } from '@schema/ui-kit';
import { useAuth } from '@/components/providers/AuthProvider';
import { cn } from '@/lib/utils';

interface OrganizationSwitcherProps {
  className?: string;
  collapsed?: boolean;
}

export function OrganizationSwitcher({ className, collapsed = false }: OrganizationSwitcherProps) {
  const { currentOrg } = useAuth();
  const orgName = currentOrg?.name || '组织';

  if (collapsed) {
    return (
      <div className={cn('flex w-full items-center justify-center py-2', className)}>
        <Tooltip content={orgName} placement="right" variant="nav">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--yj-panel-subtle)] text-fg-muted">
            <Building2 className="h-4 w-4" />
          </div>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className={cn('my-2 flex items-center gap-2 rounded-md bg-[var(--yj-panel-subtle)] px-3 py-2', className)}>
      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-fg-muted">
        <Building2 className="h-4 w-4" />
      </div>
      <span className="truncate text-sm font-medium text-[var(--yj-text-strong)]">
        {orgName}
      </span>
    </div>
  );
}
