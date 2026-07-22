'use client';

import { PageContent } from '@/components/layout';
import { Button, DataTable, Input, Tag } from '@schema/ui-kit';
import type { Column } from '@schema/ui-kit';
import { Database, Loader2, Search } from 'lucide-react';
import * as React from 'react';
import { listPipelines, type Pipeline } from '@/lib/pipelines';

interface BaselineReference {
  id: string;
  path: string;
  referenceGenome: string;
  pipelines: string[];
  activeCount: number;
  updatedAt: string;
}

function formatTime(value: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
}

function buildBaselineReferences(pipelines: Pipeline[]): BaselineReference[] {
  const map = new Map<string, BaselineReference>();
  for (const pipeline of pipelines) {
    if (!pipeline.cnvBaseline) continue;
    const key = `${pipeline.cnvBaseline}\u0000${pipeline.referenceGenome}`;
    const existing = map.get(key);
    if (existing) {
      existing.pipelines.push(pipeline.name);
      if (pipeline.status === 'active') existing.activeCount += 1;
      if (pipeline.updatedAt > existing.updatedAt) existing.updatedAt = pipeline.updatedAt;
    } else {
      map.set(key, {
        id: key,
        path: pipeline.cnvBaseline,
        referenceGenome: pipeline.referenceGenome || '-',
        pipelines: [pipeline.name],
        activeCount: pipeline.status === 'active' ? 1 : 0,
        updatedAt: pipeline.updatedAt,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.path.localeCompare(b.path));
}

export default function BaselinePage() {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [items, setItems] = React.useState<BaselineReference[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const pipelines = await listPipelines({ page: 1, pageSize: 100 });
      setItems(buildBaselineReferences(pipelines));
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载 CNV baseline 引用失败');
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredItems = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return items;
    return items.filter(
      (item) =>
        item.path.toLowerCase().includes(query) ||
        item.referenceGenome.toLowerCase().includes(query) ||
        item.pipelines.some((name) => name.toLowerCase().includes(query))
    );
  }, [items, searchQuery]);

  const columns: Column<BaselineReference>[] = [
    { id: 'path', header: 'CNV Baseline 文件/Storage Key', accessor: 'path', width: 340, align: 'center' },
    {
      id: 'referenceGenome',
      header: '参考基因组',
      accessor: (row) => <Tag variant="info">{row.referenceGenome}</Tag>,
      width: 110,
      align: 'center',
    },
    {
      id: 'pipelines',
      header: '引用流程',
      accessor: (row) => row.pipelines.join(', '),
      width: 260,
      align: 'center',
    },
    {
      id: 'activeCount',
      header: '启用流程数',
      accessor: (row) => row.activeCount,
      width: 110,
      align: 'center',
    },
    {
      id: 'updatedAt',
      header: '最近更新',
      accessor: (row) => formatTime(row.updatedAt),
      width: 180,
      align: 'center',
    },
  ];

  return (
    <PageContent className="yj-page-shell">
      <div className="yj-page-header">
        <div>
          <h2 className="yj-page-title">CNV Baseline</h2>
          <p className="yj-page-subtitle">汇总分析流程正在使用的 CNV baseline 与参考基因组。</p>
        </div>
      </div>

      <div className="yj-toolbar-panel">
        <div className="w-80">
          <Input
            placeholder="搜索 baseline、参考基因组或流程..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            leftElement={<Search className="w-4 h-4" />}
          />
        </div>
        <Button variant="secondary" onClick={() => void loadData()} disabled={isLoading}>
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
          刷新
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-danger-muted bg-danger-subtle px-4 py-3 text-sm text-danger-fg">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="yj-empty-state">
          <Loader2 className="w-6 h-6 animate-spin text-accent-fg" />
          <p className="text-fg-muted">正在加载 CNV baseline 引用...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="yj-empty-state">
          <p className="text-fg-muted">暂无 CNV baseline，请先在流程列表中配置资源文件。</p>
        </div>
      ) : (
        <DataTable data={filteredItems} columns={columns} rowKey="id" density="default" striped />
      )}
    </PageContent>
  );
}
