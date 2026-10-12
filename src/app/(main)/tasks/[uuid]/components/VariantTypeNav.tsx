'use client';

import * as React from 'react';
import { HoverHint } from '@/components/shared/HoverHint';
import { TASK_NAV_ICONS, TaskNavigationCollapsed } from './TaskNavigation';
import type { ResultContext, TabType } from '../types';
import { VARIANT_TAB_CONFIGS } from '../types';

interface VariantTypeNavProps {
  activeTab: TabType;
  context: ResultContext | null;
  onTabChange: (tab: TabType) => void;
}

export function VariantTypeNav({ activeTab, context, onTabChange }: VariantTypeNavProps) {
  const collapsed = React.useContext(TaskNavigationCollapsed);
  const buttons = React.useRef<Array<HTMLButtonElement | null>>([]);
  const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
    let next: number;
    if (event.key === 'ArrowDown') next = (index + 1) % VARIANT_TAB_CONFIGS.length;
    else if (event.key === 'ArrowUp') next = (index - 1 + VARIANT_TAB_CONFIGS.length) % VARIANT_TAB_CONFIGS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = VARIANT_TAB_CONFIGS.length - 1;
    else return;
    event.preventDefault();
    onTabChange(VARIANT_TAB_CONFIGS[next].id);
    buttons.current[next]?.focus();
  };
  return (
    <nav className="yj-variant-nav" aria-label="变异类型">
      <p className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-fg-muted">变异类型</p>
      <div className="yj-variant-nav-items">
        {VARIANT_TAB_CONFIGS.map((item, index) => {
          const active = activeTab === item.id;
          const count = context?.types[item.id]?.total;
          const Icon = TASK_NAV_ICONS[item.id];
          const label = `${item.label} ${count?.toLocaleString() ?? '—'}`;
          return (
            <HoverHint key={item.id} content={collapsed ? label : undefined}><button
              key={item.id}
              ref={element => { buttons.current[index] = element; }}
              type="button"
              aria-label={label}
              onKeyDown={event => handleKeyDown(event, index)}
              onClick={() => onTabChange(item.id)}
              className={`flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors ${active ? 'bg-accent-subtle text-accent-fg' : 'text-fg-muted hover:bg-canvas-subtle hover:text-fg-default'}`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={15} aria-hidden="true" className="shrink-0" />
              {!collapsed && <><span className="flex-1 whitespace-nowrap">{item.label}</span><span className="text-xs tabular-nums opacity-80">{count?.toLocaleString() ?? '—'}</span></>}
            </button></HoverHint>
          );
        })}
      </div>
    </nav>
  );
}
