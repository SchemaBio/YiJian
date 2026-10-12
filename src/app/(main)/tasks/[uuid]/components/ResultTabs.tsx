'use client';

import * as React from 'react';
import type { TabType } from '../types';
import { TAB_CONFIGS, VARIANT_TAB_CONFIGS } from '../types';
import { Microscope, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { HoverHint } from '@/components/shared/HoverHint';
import { TASK_NAV_ICONS, TaskNavigationCollapsed } from './TaskNavigation';

interface ResultTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  children: React.ReactNode;
  tools?: React.ReactNode;
  variantNavigation?: React.ReactNode;
}

export function ResultTabs({ activeTab, onTabChange, children, tools, variantNavigation }: ResultTabsProps) {
  const tabRefs = React.useRef<Map<TabType, HTMLButtonElement>>(new Map());
  const [collapsed, setCollapsed] = React.useState(false);
	const lastVariantTab = React.useRef<TabType>('snv-indel');
	const isVariantTab = VARIANT_TAB_CONFIGS.some(tab => tab.id === activeTab);
	React.useEffect(() => { if (isVariantTab) lastVariantTab.current = activeTab; }, [activeTab, isVariantTab]);
	const primaryActiveTab: TabType = isVariantTab ? 'snv-indel' : activeTab;
	const selectPrimaryTab = React.useCallback((tab: TabType) => onTabChange(tab === 'snv-indel' ? lastVariantTab.current : tab), [onTabChange]);

  // 键盘导航处理
  const handleKeyDown = React.useCallback((e: React.KeyboardEvent, currentIndex: number) => {
    const tabCount = TAB_CONFIGS.length;
    let newIndex: number | null = null;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        newIndex = (currentIndex + 1) % tabCount;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
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
      selectPrimaryTab(newTab.id);
      // 聚焦到新标签
      tabRefs.current.get(newTab.id)?.focus();
    }
  }, [selectPrimaryTab]);

  return (
    <TaskNavigationCollapsed.Provider value={collapsed}><div className="yj-task-workspace">
      {/* 标签页导航 */}
      <aside className="yj-task-nav" data-collapsed={collapsed} aria-label="任务解读导航">
        <HoverHint content={collapsed ? '展开解读导航' : '收起解读导航'}><button type="button" className="yj-task-nav-toggle" aria-label={collapsed ? '展开解读导航' : '收起解读导航'} aria-expanded={!collapsed} onClick={() => setCollapsed(value => !value)}>
          {collapsed ? <PanelLeftOpen size={16} aria-hidden="true" /> : <><PanelLeftClose size={16} aria-hidden="true" /><span>收起导航</span></>}
        </button></HoverHint>
        <nav
			className="yj-task-nav-primary"
          aria-label="分析结果标签页"
        >
          {TAB_CONFIGS.map((tab, index) => {
						const isActive = primaryActiveTab === tab.id;
            const Icon = tab.id === 'snv-indel' ? Microscope : TASK_NAV_ICONS[tab.id];
            return (
              <React.Fragment key={tab.id}><HoverHint content={collapsed ? tab.label : undefined}><button
                key={tab.id}
                ref={(el) => {
                  if (el) tabRefs.current.set(tab.id, el);
                }}
                id={`tab-${tab.id}`}
                aria-label={tab.label}
                aria-current={isActive ? 'page' : undefined}
                aria-controls={`tabpanel-${tab.id}`}
                tabIndex={0}
                onClick={() => selectPrimaryTab(tab.id)}
                onKeyDown={(e) => handleKeyDown(e, index)}
				className={`
				  yj-task-nav-button text-sm font-medium transition-colors
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-emphasis focus-visible:ring-offset-2
                  ${isActive
                    ? 'bg-accent-subtle text-accent-fg'
                    : 'text-fg-muted hover:bg-canvas-subtle hover:text-fg-default'
                  }
                `}
              >
                <Icon size={16} aria-hidden="true" className="shrink-0" />
                {!collapsed && <span>{tab.label}</span>}
              </button></HoverHint>{tab.id === 'snv-indel' && isVariantTab && variantNavigation}</React.Fragment>
            );
          })}
        </nav>
        <div className="yj-task-nav-tools">{tools}</div>
      </aside>

      {/* 标签页内容 */}
      <div
        className="yj-task-workspace-panel"
        role="region"
			id={`tabpanel-${primaryActiveTab}`}
			aria-labelledby={`tab-${primaryActiveTab}`}
        tabIndex={0}
      >
        {children}
      </div>
    </div></TaskNavigationCollapsed.Provider>
  );
}
