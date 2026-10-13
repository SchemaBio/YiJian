'use client';
import { useText } from '@/i18n/useText';
import { translateUI, localizeDisplay } from '@/i18n/text';


import * as React from 'react';
import { Tag } from '@schema/ui-kit';
import type { GroupedMEI, HistoryTableFilterState, PaginatedResult } from '../types';
import { DEFAULT_HISTORY_FILTER_STATE } from '../types';
import { getGroupedMEIs, ACMG_CONFIG, MEI_TYPE_CONFIG } from '../api-data';
import { ExpandableTable } from './ExpandableTable';
import { formatLocalDate } from '@/lib/utils';

interface MEIHistoryTabProps {
  filterState?: HistoryTableFilterState;
  onFilterChange?: (state: HistoryTableFilterState) => void;
}

export function MEIHistoryTab({
  filterState: externalFilterState,
  onFilterChange
}: MEIHistoryTabProps) {
  const t = useText();
  const [internalFilterState, setInternalFilterState] = React.useState<HistoryTableFilterState>(DEFAULT_HISTORY_FILTER_STATE);
  const [result, setResult] = React.useState<PaginatedResult<GroupedMEI> | null>(null);
  const [loading, setLoading] = React.useState(true);

  const filterState = externalFilterState ?? internalFilterState;
  const setFilterState = onFilterChange ?? setInternalFilterState;

  React.useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const data = await getGroupedMEIs(filterState);
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
      id: 'chromosome',
      header: t("history.chromosome326659"),
      width: 80,
      align: 'center' as const,
      accessor: (row: GroupedMEI) => row.chromosome,
    },
    {
      id: 'position',
      header: t("history.position88c344"),
      width: 100,
      align: 'center' as const,
      accessor: (row: GroupedMEI) => row.position.toLocaleString(t.locale),
    },
    {
      id: 'gene',
      header: t("history.gene9ef2ed"),
      width: 100,
      align: 'center' as const,
      accessor: (row: GroupedMEI) => row.gene,
    },
    {
      id: 'meiType',
      header: t("history.meiType05cfc0"),
      width: 80,
      align: 'center' as const,
      accessor: (row: GroupedMEI) => {
        const config = MEI_TYPE_CONFIG[row.meiType];
        return <Tag variant={config.variant} className="justify-center">{translateUI(config.label, t)}</Tag>;
      },
    },
    {
      id: 'strand',
      header: t("history.strand94d5ad"),
      width: 50,
      align: 'center' as const,
      accessor: (row: GroupedMEI) => row.strand,
    },
    {
      id: 'length',
      header: t("history.lengtha53949"),
      width: 80,
      align: 'center' as const,
      accessor: (row: GroupedMEI) => `${row.length}bp`,
    },
    {
      id: 'impact',
      header: t("history.impact5be321"),
      width: 80,
      align: 'center' as const,
      accessor: (row: GroupedMEI) => row.impact || '-',
    },
    {
      id: 'acmgClassification',
      header: t("history.acmgClassification7c3099"),
      width: 100,
      align: 'center' as const,
      accessor: (row: GroupedMEI) => {
        if (!row.acmgClassification) return '-';
        const config = ACMG_CONFIG[row.acmgClassification];
        return <Tag variant={config.variant} className="w-20 justify-center">{translateUI(config.label, t)}</Tag>;
      },
    },
    {
      id: 'detectionCount',
      header: t("history.detectionCountdf2067"),
      width: 80,
      align: 'center' as const,
      accessor: (row: GroupedMEI) => (
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
      accessor: (row: GroupedMEI) => formatLocalDate(row.firstDetectedAt),
    },
    {
      id: 'lastDetectedAt',
      header: t("history.lastDetected4d7fff"),
      width: 120,
      align: 'center' as const,
      accessor: (row: GroupedMEI) => formatLocalDate(row.lastDetectedAt),
    },
  ];

  return (
    <ExpandableTable
      data={result}
      loading={loading}
      filterState={filterState}
      onSearch={(query) => setFilterState({ ...filterState, searchQuery: query, page: 1 })}
      onPageChange={(page) => setFilterState({ ...filterState, page })}
      searchPlaceholder={t("display.searchGenesOrChromosomesc67277")}
      statsLabel={t("display.meiLoci69fcc0")}
      columns={localizeDisplay(columns, t)}
      getGroupId={(row) => row.groupId}
      getRecords={(row) => row.records}
      emptyMessage={t("display.noHistoricalMeiFindingsce36e9")}
    />
  );
}
