'use client';

import * as React from 'react';
import * as Popover from '@radix-ui/react-popover';
import { X } from 'lucide-react';

/** One consistent surface for secondary workspace tools. */
export function ToolbarPopover({ label, icon, children }: {
  label: string; icon?: React.ReactNode; children: React.ReactNode;
}) {
  return <Popover.Root>
    <Popover.Trigger asChild><button type="button" className="yj-tool-button">{icon}{label}</button></Popover.Trigger>
    <Popover.Portal><Popover.Content className="yj-tool-popover" sideOffset={8} align="start" collisionPadding={12}>
      <div className="mb-4 flex items-center justify-between gap-4"><h3 className="text-sm font-semibold">{label}</h3>
        <Popover.Close aria-label={`关闭${label}`} className="rounded p-1 text-fg-muted hover:bg-canvas-subtle"><X size={16} /></Popover.Close>
      </div>
      {children}
    </Popover.Content></Popover.Portal>
  </Popover.Root>;
}
