'use client';

import * as React from 'react';
import type { TabType } from '../types';
import { TAB_CONFIGS, VARIANT_TAB_CONFIGS } from '../types';

interface ResultTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  children: React.ReactNode;
}

export function ResultTabs({ activeTab, onTabChange, children }: ResultTabsProps) {
  const tabRefs = React.useRef<Map<TabType, HTMLButtonElement>>(new Map());
	const isVariantTab = VARIANT_TAB_CONFIGS.some(tab => tab.id === activeTab);
	const primaryActiveTab: TabType = isVariantTab ? 'snv-indel' : activeTab;

  // 键盘导航处理
  const handleKeyDown = React.useCallback((e: React.KeyboardEvent, currentIndex: number) => {
    const tabCount = TAB_CONFIGS.length;
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
      const newTab = TAB_CONFIGS[newIndex];
      onTabChange(newTab.id);
      // 聚焦到新标签
      tabRefs.current.get(newTab.id)?.focus();
    }
  }, [onTabChange]);

  return (
    <div className="h-full min-h-0 flex flex-col">
      {/* 标签页导航 */}
      <div className="shrink-0 border-b border-border-default mb-4 bg-canvas-default">
        <nav
			className="flex gap-1 overflow-x-auto whitespace-nowrap"
          role="tablist"
          aria-label="分析结果标签页"
        >
          {TAB_CONFIGS.map((tab, index) => {
						const isActive = primaryActiveTab === tab.id;
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
				  shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-emphasis focus-visible:ring-offset-2
                  ${isActive
                    ? 'border-accent-emphasis text-accent-fg'
                    : 'border-transparent text-fg-muted hover:text-fg-default hover:border-border-default'
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
        className="min-h-0 flex-1 overflow-hidden"
        role="tabpanel"
			id={`tabpanel-${primaryActiveTab}`}
			aria-labelledby={`tab-${primaryActiveTab}`}
        tabIndex={0}
      >
        {children}
      </div>
    </div>
  );
}
