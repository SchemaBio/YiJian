'use client';
import { useText } from '@/i18n/useText';
import { translateUI } from '@/i18n/text';

import { ActionButton, IconActionButton } from '@/components/shared/ActionButton';


import * as React from 'react';
import * as Popover from '@radix-ui/react-popover';

/** One consistent surface for secondary workspace tools. */
export function ToolbarPopover({ label, icon, children, wide = false, iconOnly = false }: {
  label: string; icon?: React.ReactNode; children: React.ReactNode; wide?: boolean; iconOnly?: boolean;
}) {
  const t = useText();
  return <Popover.Root>
    <Popover.Trigger asChild><ActionButton variant="ghost" type="button" iconOnly={iconOnly} aria-label={translateUI(label, t)} className="yj-tool-button">{icon}{!iconOnly && label}</ActionButton></Popover.Trigger>
    <Popover.Portal><Popover.Content aria-label={translateUI(label, t)} className={`yj-tool-popover${wide ? ' yj-tool-popover-wide' : ''}`} sideOffset={8} align="start" collisionPadding={12}>
      <div className="mb-4 flex items-center justify-between gap-4"><h3 className="text-sm font-semibold">{label}</h3>
        <Popover.Close asChild><IconActionButton action="close" label={t("common.closea1f5fe", {p0: String(label)})} variant="ghost" className="text-fg-muted hover:bg-canvas-subtle" /></Popover.Close>
      </div>
      {children}
    </Popover.Content></Popover.Portal>
  </Popover.Root>;
}
