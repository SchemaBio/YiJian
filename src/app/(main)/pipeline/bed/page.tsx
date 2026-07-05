'use client';

import { PageContent } from '@/components/layout';
import { Button, DataTable, Input, Tag } from '@schema/ui-kit';
import type { Column } from '@schema/ui-kit';
import { FileText, Loader2, Search } from 'lucide-react';
import * as React from 'react';
import { listPipelines, type Pipeline } from '@/lib/pipelines';

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
        <h2 className="yj-page-title">BED 文件引用</h2>
      </div>

      <div className="yj-info-panel mb-4">
        <p className="text-sm text-fg-muted">
          Octopus 当前没有独立 BED 文件库 CRUD；BED 通过上传文件生成的 storage key 绑定在 Pipeline 的 `bed_file` 字段中。本页展示真实流程配置中正在引用的 BED 文件，不再使用前端 mock 列表或伪造上传/删除。
        </p>
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
        <div className="yj-empty-state">
          <p className="text-fg-muted">暂无 BED 引用。请在流程配置中设置 `bed_file`。</p>
        </div>
      ) : (
        <DataTable data={filteredFiles} columns={columns} rowKey="id" density="default" striped />
      )}
    </PageContent>
  );
}
