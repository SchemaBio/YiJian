'use client';

import * as React from 'react';
import { PageContent } from '@/components/layout';
import type { HistoryTabType } from './types';
import { DEFAULT_HISTORY_FILTER_STATE } from './types';
import {
  HistoryTabs,
  SNVIndelHistoryTab,
  CNVSegmentHistoryTab,
  CNVExonHistoryTab,
  STRHistoryTab,
  MEIHistoryTab,
  MTHistoryTab,
  UPDHistoryTab,
} from './components';

export default function HistoryPage() {
  const [activeTab, setActiveTab] = React.useState<HistoryTabType>('snv-indel');
  const [filterState, setFilterState] = React.useState(DEFAULT_HISTORY_FILTER_STATE);

  // 当切换标签页时重置筛选状态
  const handleTabChange = React.useCallback((tab: HistoryTabType) => {
    setActiveTab(tab);
    setFilterState(DEFAULT_HISTORY_FILTER_STATE);
  }, []);

  // 渲染当前标签页内容
  const renderTabContent = React.useCallback(() => {
    switch (activeTab) {
      case 'snv-indel':
        return (
          <SNVIndelHistoryTab
            filterState={filterState}
            onFilterChange={setFilterState}
          />
        );
      case 'cnv-segment':
        return (
          <CNVSegmentHistoryTab
            filterState={filterState}
            onFilterChange={setFilterState}
          />
        );
      case 'cnv-exon':
        return (
          <CNVExonHistoryTab
            filterState={filterState}
            onFilterChange={setFilterState}
          />
        );
      case 'str':
        return (
          <STRHistoryTab
            filterState={filterState}
            onFilterChange={setFilterState}
          />
        );
      case 'mei':
        return (
          <MEIHistoryTab
            filterState={filterState}
            onFilterChange={setFilterState}
          />
        );
      case 'mt':
        return (
          <MTHistoryTab
            filterState={filterState}
            onFilterChange={setFilterState}
          />
        );
      case 'upd':
        return (
          <UPDHistoryTab
            filterState={filterState}
            onFilterChange={setFilterState}
          />
        );
      default:
        return null;
    }
  }, [activeTab, filterState, setFilterState]);

  return (
    <PageContent className="yj-page-shell">
      <div className="yj-page-header">
        <div>
          <h2 className="yj-page-title">历史检出统计</h2>
          <p className="yj-page-subtitle">
          统计所有任务中已审核通过的位点，按变异类型分类展示
          </p>
        </div>
		<label className="flex items-center gap-2 text-sm text-fg-muted cursor-pointer">
			<input
				type="checkbox"
				checked={Boolean(filterState.includeRevoked)}
				onChange={(event) => setFilterState((prev) => ({ ...prev, includeRevoked: event.target.checked, page: 1 }))}
			/>
			包含已撤销审核
		</label>
      </div>

      <HistoryTabs activeTab={activeTab} onTabChange={handleTabChange}>
        {renderTabContent()}
      </HistoryTabs>
    </PageContent>
  );
}
