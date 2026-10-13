'use client';
import { useText } from '@/i18n/useText';
import { translateUI, localizeDisplay } from '@/i18n/text';


import * as React from 'react';
import { Tag } from '@schema/ui-kit';
import type { GroupedSTR, HistoryTableFilterState, PaginatedResult } from '../types';
import { DEFAULT_HISTORY_FILTER_STATE } from '../types';
import { getGroupedSTRs, STR_STATUS_CONFIG } from '../api-data';
import { ExpandableTable } from './ExpandableTable';
import { formatLocalDate } from '@/lib/utils';

interface STRHistoryTabProps {
  filterState?: HistoryTableFilterState;
  onFilterChange?: (state: HistoryTableFilterState) => void;
}

export function STRHistoryTab({
  filterState: externalFilterState,
  onFilterChange
}: STRHistoryTabProps) {
  const t = useText();
  const [internalFilterState, setInternalFilterState] = React.useState<HistoryTableFilterState>(DEFAULT_HISTORY_FILTER_STATE);
  const [result, setResult] = React.useState<PaginatedResult<GroupedSTR> | null>(null);
  const [loading, setLoading] = React.useState(true);

  const filterState = externalFilterState ?? internalFilterState;
  const setFilterState = onFilterChange ?? setInternalFilterState;

  React.useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const data = await getGroupedSTRs(filterState);
        setResult(data);
      } catch {
        setResult({ data: [], total: 0, page: filterState.page, pageSize: filterState.pageSize });
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [filterState]);

  const columns = [
    {
      id: 'gene',
      header: t("history.gene9ef2ed"),
      width: 100,
      align: 'center' as const,
      accessor: (row: GroupedSTR) => row.gene,
    },
    {
      id: 'transcript',
      header: t("history.transcript96b6d7"),
      width: 130,
      align: 'center' as const,
      accessor: (row: GroupedSTR) => row.transcript,
    },
    {
      id: 'locus',
      header: t("history.locus6a6cc9"),
      width: 100,
      align: 'center' as const,
      accessor: (row: GroupedSTR) => row.locus,
    },
    {
      id: 'repeatUnit',
      header: t("history.repeatUnit61e6fe"),
      width: 80,
      align: 'center' as const,
      accessor: (row: GroupedSTR) => row.repeatUnit,
    },
    {
      id: 'repeatCount',
      header: t("history.repeatCountbfcb1f"),
      width: 120,
      align: 'center' as const,
      accessor: (row: GroupedSTR) => {
        if (row.minRepeatCount === row.maxRepeatCount) {
          return row.minRepeatCount;
        }
        return `${row.minRepeatCount} - ${row.maxRepeatCount}`;
      },
    },
    {
      id: 'normalRange',
      header: t("history.normalRangecc88cc"),
      width: 100,
      align: 'center' as const,
      accessor: (row: GroupedSTR) => `${row.normalRangeMin}-${row.normalRangeMax}`,
    },
    {
      id: 'status',
      header: t("admin.status62e951"),
      width: 80,
      align: 'center' as const,
      accessor: (row: GroupedSTR) => {
        const config = STR_STATUS_CONFIG[row.status];
        return <Tag variant={config.variant} className="justify-center">{translateUI(config.label, t)}</Tag>;
      },
    },
    {
      id: 'detectionCount',
      header: t("history.detectionCountdf2067"),
      width: 80,
      align: 'center' as const,
      accessor: (row: GroupedSTR) => (
        <span className={row.detectionCount > 1 ? 'font-medium text-accent-fg' : ''}>
          {row.detectionCount}
        </span>
      ),
    },
    {
      id: 'firstDetectedAt',
      header: t("history.firstDetected16ef1a"),
      width: 120,
      align: 'center' as const,
      accessor: (row: GroupedSTR) => formatLocalDate(row.firstDetectedAt),
    },
    {
      id: 'lastDetectedAt',
      header: t("history.lastDetected4d7fff"),
      width: 120,
      align: 'center' as const,
      accessor: (row: GroupedSTR) => formatLocalDate(row.lastDetectedAt),
    },
  ];

  return (
    <ExpandableTable
      data={result}
      loading={loading}
      filterState={filterState}
      onSearch={(query) => setFilterState({ ...filterState, searchQuery: query, page: 1 })}
      onPageChange={(page) => setFilterState({ ...filterState, page })}
      searchPlaceholder={t("tasks.searchGenesOrLoci3f8752")}
      statsLabel={t("display.strLoci1c92ba")}
      columns={localizeDisplay(columns, t)}
      getGroupId={(row) => row.groupId}
      getRecords={(row) => row.records}
      emptyMessage={t("display.noHistoricalRepeatExpansionFindingsc60e02")}
    />
  );
}
