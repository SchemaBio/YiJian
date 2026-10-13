'use client';
import { formatNumericString } from '@/i18n/format';

import { useText } from '@/i18n/useText';
import { translateUI, localizeDisplay } from '@/i18n/text';


import * as React from 'react';
import { Tag } from '@schema/ui-kit';
import type { GroupedUPDRegion, HistoryTableFilterState, PaginatedResult } from '../types';
import { DEFAULT_HISTORY_FILTER_STATE } from '../types';
import { getGroupedUPDRegions, UPD_TYPE_CONFIG } from '../api-data';
import { ExpandableTable } from './ExpandableTable';
import { formatLocalDate } from '@/lib/utils';

interface UPDHistoryTabProps {
  filterState?: HistoryTableFilterState;
  onFilterChange?: (state: HistoryTableFilterState) => void;
}

const PARENT_CONFIG: Record<string, string> = {
  Maternal: '母源',
  Paternal: '父源',
  Unknown: '未知',
};

export function UPDHistoryTab({
  filterState: externalFilterState,
  onFilterChange
}: UPDHistoryTabProps) {
  const t = useText();
  const [internalFilterState, setInternalFilterState] = React.useState<HistoryTableFilterState>(DEFAULT_HISTORY_FILTER_STATE);
  const [result, setResult] = React.useState<PaginatedResult<GroupedUPDRegion> | null>(null);
  const [loading, setLoading] = React.useState(true);

  const filterState = externalFilterState ?? internalFilterState;
  const setFilterState = onFilterChange ?? setInternalFilterState;

  React.useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const data = await getGroupedUPDRegions(filterState);
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
      accessor: (row: GroupedUPDRegion) => row.chromosome,
    },
    {
      id: 'region',
      header: t("history.region17fc93"),
      width: 180,
      align: 'center' as const,
      accessor: (row: GroupedUPDRegion) => `${formatPosition(row.startPosition)} - ${formatPosition(row.endPosition)}`,
    },
    {
      id: 'length',
      header: t("history.lengtha53949"),
      width: 100,
      align: 'center' as const,
      accessor: (row: GroupedUPDRegion) => formatPosition(row.length),
    },
    {
      id: 'type',
      header: t("history.typee4e46c"),
      width: 80,
      align: 'center' as const,
      accessor: (row: GroupedUPDRegion) => {
        const config = UPD_TYPE_CONFIG[row.type];
        return <Tag variant={config.variant} className="justify-center">{translateUI(config.label, t)}</Tag>;
      },
    },
    {
      id: 'parentOfOrigin',
      header: t("history.parentOfOrigin5c24cc"),
      width: 80,
      align: 'center' as const,
      accessor: (row: GroupedUPDRegion) => row.parentOfOrigin ? PARENT_CONFIG[row.parentOfOrigin] : '-',
    },
    {
      id: 'genes',
      header: t("history.affectedGenes9fbbad"),
      width: 200,
      align: 'center' as const,
      accessor: (row: GroupedUPDRegion) => row.genes.join(', '),
    },
    {
      id: 'detectionCount',
      header: t("history.detectionCountdf2067"),
      width: 80,
      align: 'center' as const,
      accessor: (row: GroupedUPDRegion) => (
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
      accessor: (row: GroupedUPDRegion) => formatLocalDate(row.firstDetectedAt),
    },
    {
      id: 'lastDetectedAt',
      header: t("history.lastDetected4d7fff"),
      width: 120,
      align: 'center' as const,
      accessor: (row: GroupedUPDRegion) => formatLocalDate(row.lastDetectedAt),
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
      statsLabel={t("display.updRegions1c621b")}
      columns={localizeDisplay(columns, t)}
      getGroupId={(row) => row.groupId}
      getRecords={(row) => row.records}
      emptyMessage={t("display.noHistoricalUpdFindings25f35d")}
    />
  );
}
