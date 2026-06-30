'use client';

import * as React from 'react';
import type { HistoryTabType } from '../types';
import { HISTORY_TAB_CONFIGS } from '../types';

interface HistoryTabsProps {
  activeTab: HistoryTabType;
  onTabChange: (tab: HistoryTabType) => void;
  children: React.ReactNode;
}

export function HistoryTabs({ activeTab, onTabChange, children }: HistoryTabsProps) {
  const tabRefs = React.useRef<Map<HistoryTabType, HTMLButtonElement>>(new Map());

  // 键盘导航处理
  const handleKeyDown = React.useCallback((e: React.KeyboardEvent, currentIndex: number) => {
    const tabCount = HISTORY_TAB_CONFIGS.length;
    let newIndex: number | null = null;

    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        newIndex = (currentIndex + 1) % tabCount;
        break;
      case 'ArrowLeft':
        e.preventDefault();
        newIndex = (currentIndex - 1 + tabCount) % tabCount;
        break;
      case 'Home':
        e.preventDefault();
        newIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        newIndex = tabCount - 1;
        break;
    }

    if (newIndex !== null) {
      const newTab = HISTORY_TAB_CONFIGS[newIndex];
      onTabChange(newTab.id);
      // 聚焦到新标签
      tabRefs.current.get(newTab.id)?.focus();
    }
  }, [onTabChange]);

  return (
    <div>
      {/* 标签页导航 */}
      <div className="yj-panel p-1.5 mb-4">
        <nav
          className="flex gap-1"
          role="tablist"
          aria-label="历史检出统计标签页"
        >
          {HISTORY_TAB_CONFIGS.map((tab, index) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  if (el) tabRefs.current.set(tab.id, el);
                }}
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={isActive}
                aria-controls={`tabpanel-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => onTabChange(tab.id)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                className={`
                  rounded-[12px] px-4 py-2.5 text-sm font-medium transition-colors
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-emphasis focus-visible:ring-offset-2
                  ${isActive
                    ? 'bg-[var(--yj-sage)] text-[var(--yj-text-strong)] shadow-sm'
                    : 'text-fg-muted hover:text-fg-default hover:bg-[var(--yj-panel-subtle)]'
                  }
                `}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* 标签页内容 */}
      <div
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        tabIndex={0}
      >
        {children}
      </div>
    </div>
  );
}
