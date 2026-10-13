'use client';
import { formatNumericString } from '@/i18n/format';

import { useText } from '@/i18n/useText';
import { translateUI, localizeDisplay } from '@/i18n/text';


import * as React from 'react';
import { Tag } from '@schema/ui-kit';
import type { GroupedSNVIndel, HistoryTableFilterState, PaginatedResult } from '../types';
import { DEFAULT_HISTORY_FILTER_STATE } from '../types';
import { getGroupedSNVIndels, ACMG_CONFIG } from '../api-data';
import { ExpandableTable } from './ExpandableTable';
import { formatLocalDate } from '@/lib/utils';

interface SNVIndelHistoryTabProps {
  filterState?: HistoryTableFilterState;
  onFilterChange?: (state: HistoryTableFilterState) => void;
}

// 变异后果中文映射
const CONSEQUENCE_LABELS: Record<string, string> = {
  'frameshift_variant': '移码变异',
  'missense_variant': '错义变异',
  'inframe_deletion': '框内缺失',
  'inframe_insertion': '框内插入',
  'stop_gained': '获得终止密码子',
  'splice_acceptor_variant': '剪接受体变异',
  'splice_donor_variant': '剪接供体变异',
  'synonymous_variant': '同义变异',
};

export function SNVIndelHistoryTab({
  filterState: externalFilterState,
  onFilterChange
}: SNVIndelHistoryTabProps) {
  const t = useText();
  const [internalFilterState, setInternalFilterState] = React.useState<HistoryTableFilterState>(DEFAULT_HISTORY_FILTER_STATE);
  const [result, setResult] = React.useState<PaginatedResult<GroupedSNVIndel> | null>(null);
  const [loading, setLoading] = React.useState(true);

  const filterState = externalFilterState ?? internalFilterState;
  const setFilterState = onFilterChange ?? setInternalFilterState;

  React.useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const data = await getGroupedSNVIndels(filterState);
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
      sortable: true,
      accessor: (row: GroupedSNVIndel) => row.gene,
    },
    {
      id: 'hgvsc',
      header: 'HGVSc',
      width: 180,
      align: 'left' as const,
      sortable: true,
      accessor: (row: GroupedSNVIndel) => row.hgvsc,
    },
    {
      id: 'hgvsp',
      header: 'HGVSp',
      width: 180,
      align: 'left' as const,
      sortable: true,
      accessor: (row: GroupedSNVIndel) => row.hgvsp,
    },
    {
      id: 'transcript',
      header: t("history.transcript96b6d7"),
      width: 130,
      align: 'center' as const,
      accessor: (row: GroupedSNVIndel) => row.transcript,
    },
    {
      id: 'acmgClassification',
      header: t("history.acmgClassification7c3099"),
      width: 100,
      align: 'center' as const,
      sortable: true,
      accessor: (row: GroupedSNVIndel) => {
        const config = ACMG_CONFIG[row.acmgClassification];
        return <Tag variant={config.variant} className="w-20 justify-center">{translateUI(config.label, t)}</Tag>;
      },
    },
    {
      id: 'consequence',
      header: t("history.variantConsequence95666e"),
      width: 100,
      align: 'center' as const,
      accessor: (row: GroupedSNVIndel) => CONSEQUENCE_LABELS[row.consequence] || row.consequence,
    },
    {
      id: 'gnomadAF',
      header: 'gnomAD',
      width: 100,
      align: 'center' as const,
      accessor: (row: GroupedSNVIndel) => row.gnomadAF !== undefined ? `${formatNumericString((row.gnomadAF * 100).toFixed(4), t.locale)}%` : '-',
    },
    {
      id: 'clinvarId',
      header: 'ClinVar',
      width: 120,
      align: 'center' as const,
      accessor: (row: GroupedSNVIndel) => row.clinvarId || '-',
    },
    {
      id: 'detectionCount',
      header: t("history.detectionCountdf2067"),
      width: 80,
      align: 'center' as const,
      sortable: true,
      accessor: (row: GroupedSNVIndel) => (
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
      sortable: true,
      accessor: (row: GroupedSNVIndel) => formatLocalDate(row.firstDetectedAt),
    },
    {
      id: 'lastDetectedAt',
      header: t("history.lastDetected4d7fff"),
      width: 120,
      align: 'center' as const,
      sortable: true,
      accessor: (row: GroupedSNVIndel) => formatLocalDate(row.lastDetectedAt),
    },
  ];

  return (
    <ExpandableTable
      data={result}
      loading={loading}
      filterState={filterState}
      onSearch={(query) => setFilterState({ ...filterState, searchQuery: query, page: 1 })}
      onPageChange={(page) => setFilterState({ ...filterState, page })}
      searchPlaceholder={t("display.searchGenesHgvscOrSamples0bf430")}
      statsLabel={t("display.uniqueLoci3f0be5")}
      columns={localizeDisplay(columns, t)}
      getGroupId={(row) => row.groupId}
      getRecords={(row) => row.records}
      emptyMessage={t("display.noHistoricalSnpIndelFindings1b3e3d")}
    />
  );
}
