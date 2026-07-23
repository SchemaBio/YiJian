'use client';

import { PageContent } from '@/components/layout';
import { Button, DataTable, Input, Tag } from '@schema/ui-kit';
import type { Column } from '@schema/ui-kit';
import { FileText, Loader2, Search } from 'lucide-react';
import * as React from 'react';
import { listPipelines, type Pipeline } from '@/lib/pipelines';
import { EmptyState } from '@/components/shared';

interface BedReference {
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

function buildBedReferences(pipelines: Pipeline[]): BedReference[] {
  const map = new Map<string, BedReference>();
  for (const pipeline of pipelines) {
    if (!pipeline.bedFile) continue;
    const key = `${pipeline.bedFile}\u0000${pipeline.referenceGenome}`;
    const existing = map.get(key);
    if (existing) {
      existing.pipelines.push(pipeline.name);
      if (pipeline.status === 'active') existing.activeCount += 1;
      if (pipeline.updatedAt > existing.updatedAt) existing.updatedAt = pipeline.updatedAt;
    } else {
      map.set(key, {
        id: key,
        path: pipeline.bedFile,
        referenceGenome: pipeline.referenceGenome || '-',
        pipelines: [pipeline.name],
        activeCount: pipeline.status === 'active' ? 1 : 0,
        updatedAt: pipeline.updatedAt,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.path.localeCompare(b.path));
}

export default function BedFilesPage() {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [items, setItems] = React.useState<BedReference[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const pipelines = await listPipelines({ page: 1, pageSize: 100 });
      setItems(buildBedReferences(pipelines));
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载 BED 引用失败');
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredFiles = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return items;
    return items.filter(
      (item) =>
        item.path.toLowerCase().includes(query) ||
        item.referenceGenome.toLowerCase().includes(query) ||
        item.pipelines.some((name) => name.toLowerCase().includes(query))
    );
  }, [items, searchQuery]);

  const columns: Column<BedReference>[] = [
    { id: 'path', header: 'BED 文件/Storage Key', accessor: 'path', width: 320, align: 'center' },
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
          <h2 className="yj-page-title">BED 文件</h2>
          <p className="yj-page-subtitle">汇总分析流程正在使用的捕获区域文件与参考基因组。</p>
        </div>
      </div>

      <div className="yj-toolbar-panel">
        <div className="w-72">
          <Input
            placeholder="搜索 BED、参考基因组或流程..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            leftElement={<Search className="w-4 h-4" />}
          />
        </div>
        <Button variant="secondary" onClick={() => void loadData()} disabled={isLoading}>
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
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
          <p className="text-fg-muted">正在加载 BED 引用...</p>
        </div>
      ) : filteredFiles.length === 0 ? (
        <EmptyState
          className="yj-panel"
          icon={<FileText />}
          title="暂无 BED 文件"
          description="请先在流程列表中为分析流程配置 BED 资源文件。"
        />
      ) : (
        <DataTable data={filteredFiles} columns={columns} rowKey="id" density="default" striped />
      )}
    </PageContent>
  );
}
