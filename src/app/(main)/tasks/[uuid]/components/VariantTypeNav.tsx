'use client';

import * as React from 'react';
import { ChevronRight } from 'lucide-react';
import type { ResultContext, TabType } from '../types';
import { VARIANT_TAB_CONFIGS } from '../types';

interface VariantTypeNavProps {
  activeTab: TabType;
  context: ResultContext | null;
  onTabChange: (tab: TabType) => void;
}

export function VariantTypeNav({ activeTab, context, onTabChange }: VariantTypeNavProps) {
  return (
    <nav className="yj-variant-nav" aria-label="变异类型">
      <p className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-fg-muted">变异类型</p>
      <div className="yj-variant-nav-items">
        {VARIANT_TAB_CONFIGS.map(item => {
          const active = activeTab === item.id;
          const count = context?.types[item.id]?.total;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={`flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors ${active ? 'bg-accent-subtle text-accent-fg' : 'text-fg-muted hover:bg-canvas-subtle hover:text-fg-default'}`}
              aria-current={active ? 'page' : undefined}
            >
              <span className="flex-1 whitespace-nowrap">{item.label}</span>
              <span className="text-xs tabular-nums opacity-80">{count?.toLocaleString() ?? '—'}</span>
              {active && <ChevronRight className="h-3 w-3 shrink-0" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
