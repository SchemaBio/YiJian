'use client';

import * as React from 'react';
import { PageContent } from '@/components/layout';
import { Button, Select, Tag } from '@schema/ui-kit';
import { AlertCircle, Database, RefreshCw, Settings } from 'lucide-react';
import { listPipelines, type Pipeline } from '@/lib/pipelines';

const BASE_TYPE_LABEL: Record<string, string> = {
  wes_single: 'WES 单样本分析',
  wes_family: 'WES 家系分析',
  panel: 'Panel 分析',
};

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values.map(value => value.trim()).filter(Boolean))).sort();
}

export default function PipelineConfigPage() {
  const [pipelines, setPipelines] = React.useState<Pipeline[]>([]);
  const [selectedId, setSelectedId] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  const loadPipelines = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listPipelines({ page: 1, pageSize: 100 });
      setPipelines(data);
      setSelectedId(current => current && data.some(item => item.id === current) ? current : data[0]?.id ?? '');
    } catch (err) {
      setPipelines([]);
      setSelectedId('');
      setError(err instanceof Error ? err.message : '加载流程配置失败');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadPipelines();
  }, [loadPipelines]);

  const selected = pipelines.find(item => item.id === selectedId) ?? pipelines[0];
  const bedFiles = uniqueValues(pipelines.map(item => item.bedFile));
  const cnvBaselines = uniqueValues(pipelines.map(item => item.cnvBaseline));
  const references = uniqueValues(pipelines.map(item => item.referenceGenome));
  const activeCount = pipelines.filter(item => item.status === 'active').length;

  return (
    <PageContent className="yj-page-shell">
      <div className="yj-page-header">
        <div>
          <h2 className="yj-page-title">流程配置</h2>
          <p className="yj-page-subtitle">汇总当前分析流程、参考基因组和资源文件配置。</p>
        </div>
        <Button
          variant="secondary"
          leftIcon={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}
          onClick={() => void loadPipelines()}
          disabled={loading}
        >
          刷新
        </Button>
      </div>

      {error && (
        <div className="yj-panel border border-danger-muted bg-danger-subtle text-danger-fg flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="yj-panel p-4">
          <div className="text-xs text-fg-muted">流程总数</div>
          <div className="mt-2 text-2xl font-semibold text-fg-default">{pipelines.length}</div>
        </div>
        <div className="yj-panel p-4">
          <div className="text-xs text-fg-muted">启用流程</div>
          <div className="mt-2 text-2xl font-semibold text-success-fg">{activeCount}</div>
        </div>
        <div className="yj-panel p-4">
          <div className="text-xs text-fg-muted">参考基因组</div>
          <div className="mt-2 text-sm text-fg-default">{references.join(' / ') || '-'}</div>
        </div>
        <div className="yj-panel p-4">
          <div className="text-xs text-fg-muted">BED 引用</div>
          <div className="mt-2 text-2xl font-semibold text-fg-default">{bedFiles.length}</div>
        </div>
      </div>

      <div className="yj-panel yj-form-card-wide space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-emphasis" />
          </div>
        ) : pipelines.length === 0 ? (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-canvas-subtle">
            <AlertCircle className="w-5 h-5 text-fg-muted mt-0.5" />
            <div>
              <div className="text-sm font-medium text-fg-default">暂无流程配置</div>
              <p className="text-sm text-fg-muted mt-1">请先在“流程列表”中创建分析流程。</p>
            </div>
          </div>
        ) : (
          <>
            <section className="space-y-3">
              <h3 className="text-sm font-medium text-fg-default pb-2 border-b border-border flex items-center gap-2">
                <Settings className="w-4 h-4" />
                当前流程
              </h3>
              <Select
                value={selected?.id ?? ''}
                onChange={(value) => setSelectedId(Array.isArray(value) ? value[0] : value)}
                options={pipelines.map(item => ({
                  value: item.id,
                  label: `${item.name} (${item.version || '未标版本'})`,
                }))}
              />
            </section>

            {selected && (
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-fg-default">{selected.name}</h3>
                  <Tag variant={selected.status === 'active' ? 'success' : 'neutral'}>
                    {selected.status === 'active' ? '启用' : '停用'}
                  </Tag>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Info label="流程 ID" value={selected.id} mono />
                  <Info label="基础流程" value={BASE_TYPE_LABEL[selected.baseType] ?? selected.baseType} />
                  <Info label="版本" value={selected.version || '-'} />
                  <Info label="参考基因组" value={selected.referenceGenome || '-'} />
                  <Info label="BED 文件" value={selected.bedFile || '-'} mono />
                  <Info label="CNV baseline" value={selected.cnvBaseline || '未配置'} mono />
                  <Info label="创建时间" value={selected.createdAt || '-'} />
                  <Info label="更新时间" value={selected.updatedAt || '-'} />
                </div>
                {selected.description && (
                  <div>
                    <div className="text-xs text-fg-muted">描述</div>
                    <p className="mt-1 text-sm text-fg-default whitespace-pre-wrap">{selected.description}</p>
                  </div>
                )}
              </section>
            )}

            <section className="space-y-3">
              <h3 className="text-sm font-medium text-fg-default pb-2 border-b border-border flex items-center gap-2">
                <Database className="w-4 h-4" />
                已配置资源引用
              </h3>
              <ResourceList title="BED 文件" values={bedFiles} />
              <ResourceList title="CNV baseline" values={cnvBaselines} emptyText="未配置 CNV baseline" />
            </section>

          </>
        )}
      </div>
    </PageContent>
  );
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg bg-canvas-subtle p-3">
      <div className="text-xs text-fg-muted">{label}</div>
      <div className={`mt-1 text-sm text-fg-default break-all ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  );
}

function ResourceList({ title, values, emptyText = '暂无引用' }: { title: string; values: string[]; emptyText?: string }) {
  return (
    <div>
      <div className="text-xs text-fg-muted mb-2">{title}</div>
      {values.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {values.map(value => (
            <span key={value} className="px-2 py-1 rounded bg-canvas-subtle text-xs font-mono text-fg-default">
              {value}
            </span>
          ))}
        </div>
      ) : (
        <div className="text-sm text-fg-muted">{emptyText}</div>
      )}
    </div>
  );
}
