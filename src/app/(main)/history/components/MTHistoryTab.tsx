'use client';
import { formatNumericString } from '@/i18n/format';

import { useText } from '@/i18n/useText';
import { translateUI, localizeDisplay } from '@/i18n/text';


import * as React from 'react';
import { Tag } from '@/components/shared/Tag';
import type { GroupedMTVariant, HistoryTableFilterState, PaginatedResult } from '../types';
import { DEFAULT_HISTORY_FILTER_STATE } from '../types';
import { getGroupedMTVariants, ACMG_CONFIG } from '../api-data';
import { ExpandableTable } from './ExpandableTable';
import { formatLocalDate } from '@/lib/utils';

interface MTHistoryTabProps {
  filterState?: HistoryTableFilterState;
  onFilterChange?: (state: HistoryTableFilterState) => void;
}

const MT_PATHOGENICITY_CONFIG: Record<string, { label: string; variant: 'danger' | 'warning' | 'neutral' | 'info' | 'success' }> = {
  Pathogenic: { label: '致病', variant: 'danger' },
  Likely_Pathogenic: { label: '可能致病', variant: 'warning' },
  VUS: { label: '意义未明', variant: 'neutral' },
  Likely_Benign: { label: '可能良性', variant: 'info' },
  Benign: { label: '良性', variant: 'success' },
};

export function MTHistoryTab({
  filterState: externalFilterState,
  onFilterChange
}: MTHistoryTabProps) {
  const t = useText();
  const [internalFilterState, setInternalFilterState] = React.useState<HistoryTableFilterState>(DEFAULT_HISTORY_FILTER_STATE);
  const [result, setResult] = React.useState<PaginatedResult<GroupedMTVariant> | null>(null);
  const [loading, setLoading] = React.useState(true);

  const filterState = externalFilterState ?? internalFilterState;
  const setFilterState = onFilterChange ?? setInternalFilterState;

  React.useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const data = await getGroupedMTVariants(filterState);
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
      id: 'position',
      header: t("history.position88c344"),
      width: 80,
      align: 'center' as const,
      accessor: (row: GroupedMTVariant) => row.position,
    },
    {
      id: 'change',
      header: t("history.variant5fdfca"),
      width: 80,
      align: 'center' as const,
      accessor: (row: GroupedMTVariant) => `${row.ref}>${row.alt}`,
    },
    {
      id: 'gene',
      header: t("history.gene9ef2ed"),
      width: 100,
      align: 'center' as const,
      accessor: (row: GroupedMTVariant) => row.gene,
    },
    {
      id: 'heteroplasmy',
      header: t("history.heteroplasmye05e78"),
      width: 100,
      align: 'center' as const,
      accessor: (row: GroupedMTVariant) => {
        if (row.minHeteroplasmy === row.maxHeteroplasmy) {
          return `${formatNumericString((row.minHeteroplasmy * 100).toFixed(1), t.locale)}%`;
        }
        return `${formatNumericString((row.minHeteroplasmy * 100).toFixed(1), t.locale)}% - ${formatNumericString((row.maxHeteroplasmy * 100).toFixed(1), t.locale)}%`;
      },
    },
    {
      id: 'pathogenicity',
      header: t("history.pathogenicityfa6024"),
      width: 100,
      align: 'center' as const,
      accessor: (row: GroupedMTVariant) => {
        const config = MT_PATHOGENICITY_CONFIG[row.pathogenicity];
        return <Tag variant={config.variant} className="w-20 justify-center">{translateUI(config.label, t)}</Tag>;
      },
    },
    {
      id: 'associatedDisease',
      header: t("history.associatedDiseasea79330"),
      width: 180,
      align: 'center' as const,
      accessor: (row: GroupedMTVariant) => row.associatedDisease,
    },
    {
      id: 'haplogroup',
      header: t("history.haplogroupd4fd42"),
      width: 80,
      align: 'center' as const,
      accessor: (row: GroupedMTVariant) => row.haplogroup || '-',
    },
    {
      id: 'detectionCount',
      header: t("history.detectionCountdf2067"),
      width: 80,
      align: 'center' as const,
      accessor: (row: GroupedMTVariant) => (
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
      accessor: (row: GroupedMTVariant) => formatLocalDate(row.firstDetectedAt),
    },
    {
      id: 'lastDetectedAt',
      header: t("history.lastDetected4d7fff"),
      width: 120,
      align: 'center' as const,
      accessor: (row: GroupedMTVariant) => formatLocalDate(row.lastDetectedAt),
    },
  ];

  return (
    <ExpandableTable
      data={result}
      loading={loading}
      filterState={filterState}
      onSearch={(query) => setFilterState({ ...filterState, searchQuery: query, page: 1 })}
      onPageChange={(page) => setFilterState({ ...filterState, page })}
      searchPlaceholder={t("tasks.searchGeneOrDisease26b2d3")}
      statsLabel={t("display.mitochondrialVariants6e494d")}
      columns={localizeDisplay(columns, t)}
      getGroupId={(row) => row.groupId}
      getRecords={(row) => row.records}
      emptyMessage={t("display.noHistoricalMitochondrialFindings41a3fd")}
    />
  );
}
