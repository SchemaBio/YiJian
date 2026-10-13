'use client';
import { errorText } from '@/i18n/errors';

import { useText } from '@/i18n/useText';
import { chineseText, translateUI, type TextTranslator } from '@/i18n/text';

import { ActionButton as Button } from '@/components/shared/ActionButton';


import * as React from 'react';
import { PageContent } from '@/components/layout';
import { Select, Tag } from '@schema/ui-kit';
import { AlertCircle, Database, Settings } from 'lucide-react';
import { listPipelines, type Pipeline } from '@/lib/pipelines';
import { EmptyState } from '@/components/shared';

const BASE_TYPE_LABEL: Record<string, string> = {
  wes_single: 'WES 单样本分析',
  wes_family: 'WES 家系分析',
  panel: 'Panel 分析',
};

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values.map(value => value.trim()).filter(Boolean))).sort();
}

export default function PipelineConfigPage() {
  const t = useText();
  const [pipelines, setPipelines] = React.useState<Pipeline[]>([]);
  const [selectedId, setSelectedId] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [hasLoaded, setHasLoaded] = React.useState(false);
  const [error, setError] = React.useState('');

  const loadPipelines = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listPipelines({ page: 1, pageSize: 100 });
      setPipelines(data);
      setHasLoaded(true);
      setSelectedId(current => current && data.some(item => item.id === current) ? current : data[0]?.id ?? '');
    } catch (err) {
      setError(err instanceof Error ? errorText(err, t) : t("pipeline.unableToLoadPipelineSettings1430d3"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  React.useEffect(() => {
    void loadPipelines();
  }, [loadPipelines]);

  const selected = pipelines.find(item => item.id === selectedId) ?? pipelines[0];
  const bedFiles = uniqueValues(pipelines.map(item => item.bedFile));
  const cnvBaselines = uniqueValues(pipelines.map(item => item.cnvBaseline));
  const references = uniqueValues(pipelines.map(item => item.referenceGenome));
  const activeCount = pipelines.filter(item => item.status === 'active').length;

  return (
    <PageContent className="yj-page-shell space-y-4">
      <div className="yj-page-header">
        <div>
          <h2 className="yj-page-title">{t("pipeline.pipelineSettingsbaa6d3")}</h2>
          <p className="yj-page-subtitle">{t("pipeline.reviewAnalysisPipelinesReferenceGenomesAndResourcef10912")}</p>
        </div>
        <Button action="refresh"
          variant="secondary"
          className="yj-tool-button"

          onClick={() => void loadPipelines()}
          disabled={loading}
        >
          {t("admin.refresh38108e")}</Button>
      </div>

      {error && (
        <div role="alert" className="yj-panel border border-danger-muted bg-danger-subtle px-4 py-3 text-danger-fg flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="min-w-0 break-words text-sm">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="yj-panel min-w-0 p-4">
          <div className="text-xs text-fg-muted">{t("pipeline.totalPipelinescb2d36")}</div>
          <div className="mt-2 text-2xl font-semibold text-fg-default">{!hasLoaded ? '—' : pipelines.length}</div>
        </div>
        <div className="yj-panel min-w-0 p-4">
          <div className="text-xs text-fg-muted">{t("pipeline.enabledPipelines80fa57")}</div>
          <div className="mt-2 text-2xl font-semibold text-success-fg">{!hasLoaded ? '—' : activeCount}</div>
        </div>
        <div className="yj-panel min-w-0 p-4">
          <div className="text-xs text-fg-muted">{t("pipeline.referenceGenome903ba5")}</div>
          <div className="mt-2 break-words text-sm text-fg-default">{!hasLoaded ? '—' : references.join(' / ') || '—'}</div>
        </div>
        <div className="yj-panel min-w-0 p-4">
          <div className="text-xs text-fg-muted">{t("pipeline.bedReferences6c9e36")}</div>
          <div className="mt-2 text-2xl font-semibold text-fg-default">{!hasLoaded ? '—' : bedFiles.length}</div>
        </div>
      </div>

      {(!error || hasLoaded) && <div className="yj-panel p-5 space-y-6">
        {loading && !hasLoaded ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-emphasis" />
          </div>
        ) : pipelines.length === 0 ? (
          <EmptyState
            className="min-h-[220px]"
            icon={<Settings />}
            title={t("pipeline.noPipelineSettings837c2b")}
            description={t("pipeline.createAnAnalysisPipelineInThePipeline541117")}
          />
        ) : (
          <>
            <section className="space-y-3">
              <h3 className="text-sm font-medium text-fg-default pb-2 border-b border-border flex items-center gap-2">
                <Settings className="w-4 h-4" />
                {t("pipeline.currentPipelineac8056")}</h3>
              <Select
                value={selected?.id ?? ''}
                onChange={(value) => setSelectedId(Array.isArray(value) ? value[0] : value)}
                options={pipelines.map(item => ({
                  value: item.id,
                  label: `${item.name} (${item.version || t("pipeline.versionUnspecifiedfb6d6c")})`,
                }))}
              />
            </section>

            {selected && (
              <section className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-fg-default">{selected.name}</h3>
                  <Tag variant={selected.status === 'active' ? 'success' : 'neutral'}>
                    {selected.status === 'active' ? t("admin.enabledd4e9ca") : t("admin.disabledd989e5")}
                  </Tag>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  <Info label={t("pipeline.pipelineId8c44a5")} value={selected.id} mono />
                  <Info label={t("pipeline.basePipeline41689b")} value={translateUI(BASE_TYPE_LABEL[selected.baseType] ?? selected.baseType, t)} />
                  <Info label={t("pipeline.version989d1a")} value={selected.version || '-'} />
                  <Info label={t("pipeline.referenceGenome903ba5")} value={selected.referenceGenome || '-'} />
                  <Info label={t("pipeline.bedFiles8ee058")} value={selected.bedFile || '-'} />
                  <Info label={t("pipeline.cnvBaselinefd84b0")} value={selected.cnvBaseline || t("pipeline.notConfigured63595e")} />
                  <Info label={t("admin.createdAt84e380")} value={formatTime(selected.createdAt, t)} />
                  <Info label={t("pipeline.updatedAt093dea")} value={formatTime(selected.updatedAt, t)} />
                </div>
                {selected.description && (
                  <div>
                    <div className="text-xs text-fg-muted">{t("admin.description412f54")}</div>
                    <p className="mt-1 text-sm text-fg-default whitespace-pre-wrap">{selected.description}</p>
                  </div>
                )}
              </section>
            )}

            {pipelines.length > 1 && <section className="space-y-3">
              <h3 className="text-sm font-medium text-fg-default pb-2 border-b border-border flex items-center gap-2">
                <Database className="w-4 h-4" />
                {t("pipeline.configuredResourceReferencese4443b")}</h3>
              <ResourceList title={t("pipeline.bedFiles8ee058")} values={bedFiles} />
              <ResourceList title={t("pipeline.cnvBaselinefd84b0")} values={cnvBaselines} emptyText={t("pipeline.cnvBaselineNotConfigured686b34")} />
            </section>}

          </>
        )}
      </div>}
    </PageContent>
  );
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0 border-b border-[var(--yj-border-subtle)] pb-3">
      <div className="text-xs text-fg-muted">{label}</div>
      <div className={`mt-1 text-sm text-fg-default break-all ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  );
}

function ResourceList({ title, values, emptyText: suppliedEmptyText }: { title: string; values: string[]; emptyText?: string }) {
  const t = useText();
  const emptyText = suppliedEmptyText ?? t("pipeline.noReferencesea524e");
  return (
    <div>
      <div className="text-xs text-fg-muted mb-2">{title}</div>
      {values.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {values.map(value => (
            <span key={value} className="max-w-full break-all px-2 py-1 rounded bg-canvas-subtle text-xs font-mono text-fg-default">
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

function formatTime(value: string, t: TextTranslator = chineseText): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(t.locale, { hour12: false });
}
