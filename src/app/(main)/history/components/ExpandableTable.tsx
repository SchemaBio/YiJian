'use client';
import { useText } from '@/i18n/useText';
import { translateUI } from '@/i18n/text';


import * as React from 'react';
import { Input } from '@schema/ui-kit';
import { Search, ChevronRight, ChevronDown, History } from 'lucide-react';
import { EmptyState } from '@/components/shared';
import { getReviewEvents } from '../api-data';
import type { DetectionRecord, HistoryTableFilterState, PaginatedResult, ReviewEvent } from '../types';

interface ExpandableTableProps<T> {
  data: PaginatedResult<T> | null;
  loading: boolean;
  filterState: HistoryTableFilterState;
  onSearch: (query: string) => void;
  onPageChange: (page: number) => void;
  searchPlaceholder?: string;
  statsLabel?: string;
  columns: ColumnDef<T>[];
  getGroupId: (row: T) => string;
  getRecords: (row: T) => DetectionRecord[];
  emptyMessage: string;
}

interface ColumnDef<T> {
  id: string;
  header: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  accessor: (row: T) => React.ReactNode;
}

export function ExpandableTable<T>({
  data,
  loading,
  filterState,
  onSearch,
  onPageChange,
  searchPlaceholder: suppliedSearchPlaceholder,
  statsLabel: suppliedStatsLabel,
  columns,
  getGroupId,
  getRecords,
  emptyMessage,
}: ExpandableTableProps<T>) {
  const t = useText();
  const statsLabel = suppliedStatsLabel ?? t("history.records69d28a");
  const searchPlaceholder = suppliedSearchPlaceholder ?? t("history.search16ad6d");
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set());
	const [auditEvents, setAuditEvents] = React.useState<Record<string, ReviewEvent[]>>({});
	const [loadingAudit, setLoadingAudit] = React.useState<Record<string, boolean>>({});

  const toggleRowExpand = React.useCallback((groupId: string, row: T) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
    if (!expandedRows.has(groupId)) {
			const taskIds = Array.from(new Set(getRecords(row).map(record => record.taskId)));
			setLoadingAudit(prev => ({ ...prev, [groupId]: true }));
			Promise.all(taskIds.map(async taskId => [taskId, await getReviewEvents(taskId)] as const))
				.then(entries => setAuditEvents(prev => ({ ...prev, [groupId]: entries.flatMap(([, events]) => events) })))
				.catch(() => setAuditEvents(prev => ({ ...prev, [groupId]: [] })))
				.finally(() => setLoadingAudit(prev => ({ ...prev, [groupId]: false })));
		}
	}, [expandedRows, getRecords]);

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  const renderExpandedRow = (row: T) => {
    const groupId = getGroupId(row);
    if (!expandedRows.has(groupId)) return null;
    const records = getRecords(row);
		const events = auditEvents[groupId] ?? [];

    return (
      <tr key={`${groupId}-detail`} className="bg-canvas-subtle">
        <td colSpan={columns.length + 1} className="p-0">
          <div className="p-4 border-t border-border-default">
            <div className="text-sm font-medium text-fg-default mb-3">{t("history.detectionDetails9efff2")}</div>
			{loadingAudit[groupId] && <div className="text-xs text-fg-muted mb-2">{t("history.loadingReviewEventTimelinefe829d")}</div>}
			<div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-default">
                    <th className="px-3 py-2 text-left text-fg-muted font-medium">{t("history.taskId6fd967")}</th>
                    <th className="px-3 py-2 text-left text-fg-muted font-medium">{t("history.sampleId6d686e")}</th>
                    <th className="px-3 py-2 text-left text-fg-muted font-medium">{t("history.pipelineName323a83")}</th>
                    <th className="px-3 py-2 text-left text-fg-muted font-medium">{t("history.reviewer15c18d")}</th>
                    <th className="px-3 py-2 text-left text-fg-muted font-medium">{t("history.reviewedAt23a903")}</th>
					<th className="px-3 py-2 text-left text-fg-muted font-medium">{t("admin.actionsf3ea6d")}</th>
					<th className="px-3 py-2 text-left text-fg-muted font-medium">{t("history.executionBatchd6015e")}</th>
					<th className="px-3 py-2 text-left text-fg-muted font-medium">{t("history.genomed74c40")}</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record, index) => (
                    <tr
                      key={record.recordId}
                      className={index < records.length - 1 ? 'border-b border-border-subtle' : ''}
                    >
                      <td className="px-3 py-2 font-mono text-xs">{record.taskId.slice(0, 8)}</td>
                      <td className="px-3 py-2">{record.internalId}</td>
                      <td className="px-3 py-2">{record.pipeline} {record.pipelineVersion}</td>
                      <td className="px-3 py-2">{record.reviewedBy}</td>
						<td className="px-3 py-2">{record.timestampKnown === false ? t("history.historicalDataDateUnknown375c26") : (record.reviewedAt || '-')}</td>
						<td className="px-3 py-2">{record.action === 'REVOKED' ? t("history.revokeReviewd55cbb") : t("history.reviewApproved637104")}</td>
						<td className="px-3 py-2 font-mono text-xs">{record.executionAttemptId?.slice(0, 8) || '-'}</td>
						<td className="px-3 py-2">{record.referenceGenome || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
				{events.length > 0 && (
					<div className="mt-4 border-t border-border-default pt-3">
						<div className="text-sm font-medium text-fg-default mb-2">{t("history.fullReviewTimeline4ee19b")}</div>
						<div className="space-y-1 text-xs text-fg-muted">
							{events
								.filter(event => records.some(record => record.variantFingerprint === event.variantFingerprint && record.executionAttemptId === event.executionAttemptId))
								.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
								.map(event => <div key={event.id}>{event.action === 'REVOKED' ? t("history.revokeReviewd55cbb") : t("history.reviewApproved637104")} · {event.actorEmail || t("history.unknownUser410959")} · {event.timestampKnown && event.occurredAt ? event.occurredAt : t("history.historicalDataDateUnknown375c26")}  {t("interface.attempt38a16a")} {event.executionAttemptId.slice(0, 8)}</div>)}
						</div>
					</div>
				)}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div>
      {/* 工具栏 */}
      <div className="flex items-center justify-between mb-4">
        <div className="w-64">
          <Input
            placeholder={translateUI(searchPlaceholder, t)}
            value={filterState.searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            leftElement={<Search className="w-4 h-4" />}
          />
        </div>
        <div className="flex items-center gap-4 text-sm text-fg-muted">
          <span>{t("history.total497064")}{data?.total ?? 0} {statsLabel}</span>
          {data && data.data.length > 0 && (
            <span>
				{t("history.detected5ed1ca")}{data.data.reduce((sum, item) => sum + getRecords(item).filter(record => record.action !== 'REVOKED').length, 0)} {t("history.times944bb7")}</span>
          )}
        </div>
      </div>

      {/* 数据表格 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent-emphasis" />
        </div>
      ) : data && data.data.length > 0 ? (
        <>
          <div className="border border-border-default rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-canvas-subtle">
                <tr>
                  <th className="px-2 py-2.5 text-sm font-medium text-fg-muted w-10" style={{ textAlign: 'center' }}>
                    {}
                  </th>
                  {columns.map((col) => (
                    <th
                      key={col.id}
                      className="px-3 py-2.5 text-sm font-medium text-fg-muted"
                      style={{ width: col.width, textAlign: col.align || 'left' }}
                    >
                      {translateUI(col.header, t)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.data.map((row) => {
                  const groupId = getGroupId(row);
                  return (
                    <React.Fragment key={groupId}>
                      <tr
                        className="border-b border-border-default hover:bg-canvas-subtle cursor-pointer"
                        onClick={() => toggleRowExpand(groupId, row)}
                      >
                        <td className="px-2 py-2 text-center">
                          <button className="p-1 hover:bg-canvas-inset rounded">
                            {expandedRows.has(groupId) ? (
                              <ChevronDown className="w-4 h-4 text-fg-muted" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-fg-muted" />
                            )}
                          </button>
                        </td>
                        {columns.map((col) => (
                          <td
                            key={col.id}
                            className="px-3 py-2 text-sm"
                            style={{ textAlign: col.align || 'left' }}
                          >
                            {col.accessor(row)}
                          </td>
                        ))}
                      </tr>
                      {renderExpandedRow(row)}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-fg-muted">
                {t("history.pagef49534")}{filterState.page} / {totalPages} {t("history.labelaf8438")}</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onPageChange(filterState.page - 1)}
                  disabled={filterState.page <= 1}
                  className="px-3 py-1 text-sm border border-border-default rounded hover:bg-canvas-subtle disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t("history.previousb41561")}</button>
                <button
                  onClick={() => onPageChange(filterState.page + 1)}
                  disabled={filterState.page >= totalPages}
                  className="px-3 py-1 text-sm border border-border-default rounded hover:bg-canvas-subtle disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t("history.next67a246")}</button>
              </div>
            </div>
          )}
        </>
      ) : (
        <EmptyState
          className="yj-panel"
          icon={<History />}
          title={translateUI(emptyMessage, t)}
          description={t("history.eligibleDetectionHistoryAppearsHereAfterTaskb8ee17")}
        />
      )}
    </div>
  );
}
