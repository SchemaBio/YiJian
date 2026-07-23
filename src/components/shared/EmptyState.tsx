import * as React from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  className?: string;
}

export function EmptyState({ icon, title, description, className }: EmptyStateProps) {
  return (
    <div className={cn('flex min-h-64 flex-col items-center justify-center px-6 py-10 text-center', className)} role="status">
      <span className="text-fg-muted [&_svg]:h-6 [&_svg]:w-6" aria-hidden="true">
        {icon}
      </span>
      <p className="mt-3 text-sm font-medium text-fg-default">{title}</p>
      {description && <p className="mt-1 max-w-md text-xs leading-5 text-fg-muted">{description}</p>}
    </div>
  );
}
