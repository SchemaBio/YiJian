'use client';
import { formatNumericString } from '@/i18n/format';

import { useText } from '@/i18n/useText';
import { chineseText, localizeDisplay, type TextTranslator } from '@/i18n/text';


import * as React from 'react';
import { Tag } from '@/components/shared/Tag';
import type { GroupedCNVExon, HistoryTableFilterState, PaginatedResult } from '../types';
import { DEFAULT_HISTORY_FILTER_STATE } from '../types';
import { getGroupedCNVExons } from '../api-data';
import { ExpandableTable } from './ExpandableTable';
import { formatLocalDate } from '@/lib/utils';

interface CNVExonHistoryTabProps {
  filterState?: HistoryTableFilterState;
  onFilterChange?: (state: HistoryTableFilterState) => void;
}

function cnvTypeLabel(type: GroupedCNVExon['type'], t: TextTranslator = chineseText): string {
  if (type === 'Amplification') return t("history.duplication1aeb54");
  if (type === 'Deletion') return t("history.deletion2fe9b7");
  return t("history.normalf78d03");
}

function cnvTypeVariant(type: GroupedCNVExon['type']): 'warning' | 'info' | 'neutral' {
  if (type === 'Deletion') return 'warning';
  if (type === 'Amplification') return 'info';
  return 'neutral';
}

export function CNVExonHistoryTab({
  filterState: externalFilterState,
  onFilterChange
}: CNVExonHistoryTabProps) {
  const t = useText();
  const [internalFilterState, setInternalFilterState] = React.useState<HistoryTableFilterState>(DEFAULT_HISTORY_FILTER_STATE);
  const [result, setResult] = React.useState<PaginatedResult<GroupedCNVExon> | null>(null);
  const [loading, setLoading] = React.useState(true);

  const filterState = externalFilterState ?? internalFilterState;
  const setFilterState = onFilterChange ?? setInternalFilterState;

  React.useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const data = await getGroupedCNVExons(filterState);
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
      accessor: (row: GroupedCNVExon) => row.gene,
    },
    {
      id: 'transcript',
      header: t("history.transcript96b6d7"),
      width: 130,
      align: 'center' as const,
      accessor: (row: GroupedCNVExon) => row.transcript,
    },
    {
      id: 'exon',
      header: t("history.exonfb0270"),
      width: 100,
      align: 'center' as const,
      accessor: (row: GroupedCNVExon) => row.exon,
    },
    {
      id: 'chromosome',
      header: t("history.chromosome326659"),
      width: 80,
      align: 'center' as const,
      accessor: (row: GroupedCNVExon) => row.chromosome,
    },
    {
      id: 'type',
      header: t("history.typee4e46c"),
      width: 80,
      align: 'center' as const,
      accessor: (row: GroupedCNVExon) => (
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
      accessor: (row: GroupedCNVExon) => row.copyNumber,
    },
    {
      id: 'ratio',
      header: t("history.ratio460e70"),
      width: 80,
      align: 'center' as const,
      accessor: (row: GroupedCNVExon) => formatNumericString(row.ratio.toFixed(2), t.locale),
    },
    {
      id: 'confidence',
      header: t("history.confidenceb78c2d"),
      width: 80,
      align: 'center' as const,
      accessor: (row: GroupedCNVExon) => `${formatNumericString((row.confidence * 100).toFixed(0), t.locale)}%`,
    },
    {
      id: 'detectionCount',
      header: t("history.detectionCountdf2067"),
      width: 80,
      align: 'center' as const,
      accessor: (row: GroupedCNVExon) => (
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
      accessor: (row: GroupedCNVExon) => formatLocalDate(row.firstDetectedAt),
    },
    {
      id: 'lastDetectedAt',
      header: t("history.lastDetected4d7fff"),
      width: 120,
      align: 'center' as const,
      accessor: (row: GroupedCNVExon) => formatLocalDate(row.lastDetectedAt),
    },
  ];

  return (
    <ExpandableTable
      data={result}
      loading={loading}
      filterState={filterState}
      onSearch={(query) => setFilterState({ ...filterState, searchQuery: query, page: 1 })}
      onPageChange={(page) => setFilterState({ ...filterState, page })}
      searchPlaceholder={t("tasks.searchGenesOrExons2fe67e")}
      statsLabel={t("display.cnvExons7aa5f8")}
      columns={localizeDisplay(columns, t)}
      getGroupId={(row) => row.groupId}
      getRecords={(row) => row.records}
      emptyMessage={t("display.noHistoricalExonCnvFindingsad18cd")}
    />
  );
}
