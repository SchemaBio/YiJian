'use client';
import { formatNumericString } from '@/i18n/format';

import { useText } from '@/i18n/useText';
import { chineseText, localizeDisplay, type TextTranslator } from '@/i18n/text';


import * as React from 'react';
import { Tag } from '@schema/ui-kit';
import type { GroupedCNVSegment, HistoryTableFilterState, PaginatedResult } from '../types';
import { DEFAULT_HISTORY_FILTER_STATE } from '../types';
import { getGroupedCNVSegments } from '../api-data';
import { ExpandableTable } from './ExpandableTable';
import { formatLocalDate } from '@/lib/utils';

interface CNVSegmentHistoryTabProps {
  filterState?: HistoryTableFilterState;
  onFilterChange?: (state: HistoryTableFilterState) => void;
}

function cnvTypeLabel(type: GroupedCNVSegment['type'], t: TextTranslator = chineseText): string {
  if (type === 'Amplification') return t("history.duplication1aeb54");
  if (type === 'Deletion') return t("history.deletion2fe9b7");
  return t("history.normalf78d03");
}

function cnvTypeVariant(type: GroupedCNVSegment['type']): 'warning' | 'info' | 'neutral' {
  if (type === 'Deletion') return 'warning';
  if (type === 'Amplification') return 'info';
  return 'neutral';
}

export function CNVSegmentHistoryTab({
  filterState: externalFilterState,
  onFilterChange
}: CNVSegmentHistoryTabProps) {
  const t = useText();
  const [internalFilterState, setInternalFilterState] = React.useState<HistoryTableFilterState>(DEFAULT_HISTORY_FILTER_STATE);
  const [result, setResult] = React.useState<PaginatedResult<GroupedCNVSegment> | null>(null);
  const [loading, setLoading] = React.useState(true);

  const filterState = externalFilterState ?? internalFilterState;
  const setFilterState = onFilterChange ?? setInternalFilterState;

  React.useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const data = await getGroupedCNVSegments(filterState);
        setResult(data);
      } catch {
        setResult({ data: [], total: 0, page: filterState.page, pageSize: filterState.pageSize });
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [filterState]);

  const formatPosition = (pos: number) => {
    if (pos >= 1000000) return `${formatNumericString((pos / 1000000).toFixed(2), t.locale)}Mb`;
    if (pos >= 1000) return `${formatNumericString((pos / 1000).toFixed(1), t.locale)}kb`;
    return `${pos}bp`;
  };

  const columns = [
    {
      id: 'chromosome',
      header: t("history.chromosome326659"),
      width: 80,
      align: 'center' as const,
      accessor: (row: GroupedCNVSegment) => row.chromosome,
    },
    {
      id: 'region',
      header: t("history.region17fc93"),
      width: 180,
      align: 'center' as const,
      accessor: (row: GroupedCNVSegment) => `${formatPosition(row.startPosition)} - ${formatPosition(row.endPosition)}`,
    },
    {
      id: 'length',
      header: t("history.lengtha53949"),
      width: 100,
      align: 'center' as const,
      accessor: (row: GroupedCNVSegment) => formatPosition(row.length),
    },
    {
      id: 'type',
      header: t("history.typee4e46c"),
      width: 80,
      align: 'center' as const,
      accessor: (row: GroupedCNVSegment) => (
        <Tag variant={cnvTypeVariant(row.type)} className="justify-center">
          {cnvTypeLabel(row.type, t)}
        </Tag>
      ),
    },
    {
      id: 'copyNumber',
      header: t("history.copyNumber04d1ca"),
      width: 80,
      align: 'center' as const,
      accessor: (row: GroupedCNVSegment) => row.copyNumber,
    },
    {
      id: 'genes',
      header: t("history.affectedGenes9fbbad"),
      width: 200,
      align: 'center' as const,
      accessor: (row: GroupedCNVSegment) => row.genes.join(', '),
    },
    {
      id: 'confidence',
      header: t("history.confidenceb78c2d"),
      width: 80,
      align: 'center' as const,
      accessor: (row: GroupedCNVSegment) => `${formatNumericString((row.confidence * 100).toFixed(0), t.locale)}%`,
    },
    {
      id: 'detectionCount',
      header: t("history.detectionCountdf2067"),
      width: 80,
      align: 'center' as const,
      accessor: (row: GroupedCNVSegment) => (
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
      accessor: (row: GroupedCNVSegment) => formatLocalDate(row.firstDetectedAt),
    },
    {
      id: 'lastDetectedAt',
      header: t("history.lastDetected4d7fff"),
      width: 120,
      align: 'center' as const,
      accessor: (row: GroupedCNVSegment) => formatLocalDate(row.lastDetectedAt),
    },
  ];

  return (
    <ExpandableTable
      data={result}
      loading={loading}
      filterState={filterState}
      onSearch={(query) => setFilterState({ ...filterState, searchQuery: query, page: 1 })}
      onPageChange={(page) => setFilterState({ ...filterState, page })}
      searchPlaceholder={t("tasks.searchChromosomesOrGenes1bdc34")}
      statsLabel={t("display.cnvRegionsa89d5d")}
      columns={localizeDisplay(columns, t)}
      getGroupId={(row) => row.groupId}
      getRecords={(row) => row.records}
      emptyMessage={t("display.noHistoricalRegionCnvFindingsa63441")}
    />
  );
}
