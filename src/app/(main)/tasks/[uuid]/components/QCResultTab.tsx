'use client';

import * as React from 'react';
import type { QCMemberSummary, QCMetric, ResultContext } from '../types';
import { getResultContext } from '../result-api';

interface QCResultTabProps {
  taskId: string;
  context?: ResultContext | null;
}

interface MetricDefinition {
  key: string;
  label: string;
  format: (value: number) => string;
  // Visual prompts migrated from the previous WES page. They are not an
  // automatic report-release decision.
  warningMin?: number;
  warningMax?: number;
}

const METRICS: MetricDefinition[] = [
  { key: 'totalReads', label: '过滤后 reads', format: value => `${(value / 1_000_000).toFixed(1)} M`, warningMin: 80_000_000 },
  { key: 'mappedReadsFraction', label: '比对率', format: value => percent(value), warningMin: 0.95 },
  { key: 'averageDepth', label: '平均深度', format: value => `${value.toFixed(1)}×`, warningMin: 100 },
  { key: 'dedupDepth', label: '去重深度', format: value => `${value.toFixed(1)}×`, warningMin: 80 },
  { key: 'coverageGte30x', label: '≥30× 覆盖', format: value => percent(value), warningMin: 0.98 },
  { key: 'meanTargetCoverage', label: '目标区平均深度', format: value => `${value.toFixed(1)}×` },
  { key: 'duplicateRate', label: '重复率', format: value => percent(value), warningMax: 0.2 },
  { key: 'q30Rate', label: 'Q30', format: value => percent(value), warningMin: 0.85 },
  { key: 'gcContent', label: 'GC 比例', format: value => percent(value) },
  { key: 'insertSizeMedian', label: '插入片段中位数', format: value => `${value.toFixed(0)} bp` },
  { key: 'targetDataFraction', label: '目标数据占比', format: value => percent(value) },
  { key: 'mtAverageDepth', label: '线粒体平均深度', format: value => `${value.toFixed(1)}×` },
  { key: 'mtCoverageGt0x', label: '线粒体覆盖', format: value => percent(value) },
];

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function memberLabel(member: QCMemberSummary) {
  const roles: Record<string, string> = { proband: '先证者', father: '父亲', mother: '母亲', unknown: '成员未知' };
  return roles[member.memberRole.toLowerCase()] ?? member.memberRole;
}

function metricByKey(member: QCMemberSummary, key: string): QCMetric | undefined {
  return member.metrics.find(metric => metric.key === key);
}

function visualStatus(metric: QCMetric | undefined, definition: MetricDefinition): 'normal' | 'warning' | 'unknown' {
  if (!metric || metric.value === null) return 'unknown';
  if (definition.warningMin !== undefined && metric.value < definition.warningMin) return 'warning';
  if (definition.warningMax !== undefined && metric.value > definition.warningMax) return 'warning';
  return 'normal';
}

function MetricCell({ member, definition }: { member: QCMemberSummary; definition: MetricDefinition }) {
  const metric = metricByKey(member, definition.key);
  const status = visualStatus(metric, definition);
  const styles = status === 'warning'
    ? 'border-warning-emphasis bg-warning-subtle'
    : status === 'unknown'
      ? 'border-border-default bg-canvas-subtle'
      : 'border-border-default bg-canvas-default';
  return (
    <div className={`min-w-[132px] rounded-lg border p-3 ${styles}`}>
      <div className="text-xs text-fg-muted">{definition.label}</div>
      <div className="mt-1 text-base font-semibold text-fg-default">
        {metric?.value === null || !metric ? '未提供' : definition.format(metric.value)}
      </div>
      {metric?.source && <div className="mt-1 text-[11px] text-fg-subtle">来源：{metric.source}</div>}
    </div>
  );
}

export function QCResultTab({ taskId, context: suppliedContext }: QCResultTabProps) {
  const [loadedContext, setLoadedContext] = React.useState<ResultContext | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(!suppliedContext);
  const context = suppliedContext ?? loadedContext;

  const load = React.useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      setLoadedContext(await getResultContext(taskId, signal));
    } catch (cause) {
      if (signal?.aborted) return;
      setError(cause instanceof Error ? cause.message : '无法读取质控结果');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [taskId]);

  React.useEffect(() => {
    if (suppliedContext) return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, suppliedContext]);

  if (loading && !context) {
    return <div className="flex items-center justify-center py-16"><div className="h-6 w-6 animate-spin rounded-full border-b-2 border-accent-emphasis" /></div>;
  }
  if (error && !context) {
    return (
      <div className="rounded-lg border border-danger-emphasis bg-danger-subtle p-5 text-sm text-danger-fg">
        <p>{error}</p>
        <button className="mt-3 rounded bg-canvas-default px-3 py-1.5 text-fg-default" onClick={() => void load()}>重试</button>
      </div>
    );
  }
  if (!context?.qc.length) {
    return <div className="rounded-lg border border-border-default bg-canvas-default p-8 text-center text-fg-muted">该执行尚未导入成员质控数据。</div>;
  }

  return (
    <section aria-labelledby="qc-heading" className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="qc-heading" className="text-lg font-semibold text-fg-default">质控与家系</h2>
          <p className="mt-1 text-sm text-fg-muted">数值来自本次执行归档。提示阈值仅辅助复核，不能作为报告放行结论。</p>
        </div>
        <span className="rounded-full bg-canvas-subtle px-3 py-1 text-xs text-fg-muted">执行 {context.executionAttemptId.slice(0, 8)}</span>
      </div>

      <div className="space-y-4">
        {context.qc.map(member => (
          <article key={member.memberId} className="rounded-xl border border-border-default bg-canvas-default p-4 shadow-sm">
            <header className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-medium text-fg-default">{memberLabel(member)}</h3>
                <p className="text-xs text-fg-muted">{member.sampleId || member.memberId}</p>
              </div>
              <span className="rounded bg-canvas-subtle px-2 py-1 text-xs text-fg-muted">{member.memberRole}</span>
            </header>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {METRICS.map(definition => <MetricCell key={definition.key} member={member} definition={definition} />)}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
