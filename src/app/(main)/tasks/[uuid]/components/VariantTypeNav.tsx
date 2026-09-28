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
    <nav className="rounded-xl border border-border-default bg-canvas-default p-2 shadow-sm" aria-label="变异类型">
      <p className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-fg-muted">变异类型</p>
      <div className="space-y-1">
        {VARIANT_TAB_CONFIGS.map(item => {
          const active = activeTab === item.id;
          const count = context?.types[item.id]?.total;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${active ? 'bg-accent-subtle text-accent-fg' : 'text-fg-muted hover:bg-canvas-subtle hover:text-fg-default'}`}
              aria-current={active ? 'page' : undefined}
            >
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              <span className="text-xs tabular-nums opacity-80">{count?.toLocaleString() ?? '—'}</span>
              {active && <ChevronRight className="h-4 w-4" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
