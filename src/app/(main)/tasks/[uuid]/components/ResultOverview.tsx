'use client';

import * as React from 'react';
import { ArrowRight, CheckCircle2, Clock3, FileWarning, Layers3 } from 'lucide-react';
import type { ResultContext, TabType } from '../types';

interface ResultOverviewProps {
  context: ResultContext;
  onNavigate: (tab: TabType) => void;
}

const TYPE_LABELS: Array<{ key: string; label: string; tab: TabType }> = [
  { key: 'snv-indel', label: 'SNP / InDel', tab: 'snv-indel' },
  { key: 'cnv-segment', label: 'CNV 区段', tab: 'cnv-segment' },
  { key: 'cnv-exon', label: 'CNV 外显子', tab: 'cnv-exon' },
  { key: 'str', label: 'STR', tab: 'str' },
  { key: 'mei', label: 'MEI', tab: 'mei' },
  { key: 'mt', label: '线粒体', tab: 'mt' },
  { key: 'upd', label: 'UPD', tab: 'upd' },
  { key: 'roh', label: 'ROH', tab: 'roh' },
];

function stateDescription(context: ResultContext) {
  switch (context.state) {
    case 'ready': return { title: '结果可判读', detail: '结果已固定到当前执行与导入批次，可开始复核。', icon: CheckCircle2, tone: 'text-success-fg bg-success-subtle border-success-emphasis' };
    case 'importing': return { title: '结果导入中', detail: '计算归档完成后正在建立结构化结果，请稍后刷新。', icon: Clock3, tone: 'text-warning-fg bg-warning-subtle border-warning-emphasis' };
    case 'import_failed': return { title: '结果导入失败', detail: '归档存在但结构化导入未完成，请查看运行记录并重试导入。', icon: FileWarning, tone: 'text-danger-fg bg-danger-subtle border-danger-emphasis' };
    case 'workflow_running': return { title: '工作流运行中', detail: '尚未生成可判读结果。', icon: Clock3, tone: 'text-accent-fg bg-accent-subtle border-accent-emphasis' };
    default: return { title: '等待结果导入', detail: '任务尚未产生可判读的结构化结果。', icon: Clock3, tone: 'text-fg-muted bg-canvas-subtle border-border-default' };
  }
}

function MemberLabel({ role }: { role: string }) {
  const labels: Record<string, string> = { proband: '先证者', father: '父亲', mother: '母亲', unknown: '成员未知' };
  return <span>{labels[role.toLowerCase()] ?? role}</span>;
}

export function ResultOverview({ context, onNavigate }: ResultOverviewProps) {
  const state = context.parquet?.available && context.importStatus === 'failed'
    ? { title: 'Parquet 检出表可查询', detail: '当前执行的原始 Parquet 归档可直接查询；旧的结构化数据库导入失败不会阻断检出表。', icon: CheckCircle2, tone: 'text-success-fg bg-success-subtle border-success-emphasis' }
    : stateDescription(context);
  const StateIcon = state.icon;
  const allCounts = TYPE_LABELS.map(item => ({
    ...item,
    count: context.types[item.key]?.total ?? 0,
    unqueried: Boolean(context.parquet?.available && context.parquet.tables.includes(item.key) && !context.parquet.preparedTables.includes(item.key)),
  }));
  const countsPending = allCounts.some(item => item.unqueried);
  const total = allCounts.reduce((sum, item) => sum + item.count, 0);
  const reviewed = TYPE_LABELS.reduce((sum, item) => sum + (context.types[item.key]?.reviewed ?? 0), 0);
  const reported = TYPE_LABELS.reduce((sum, item) => sum + (context.types[item.key]?.reported ?? 0), 0);
  const maxCount = Math.max(1, ...allCounts.map(item => item.count));
  const progress = total === 0 ? 0 : Math.round((reviewed / total) * 100);

  return (
    <section className="space-y-5" aria-labelledby="result-overview-heading">
      <div className={`flex flex-wrap items-start gap-3 rounded-xl border p-4 ${state.tone}`}>
        <StateIcon className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <h2 id="result-overview-heading" className="font-semibold">{state.title}</h2>
          <p className="mt-1 text-sm opacity-90">{state.detail}</p>
          {context.state === 'import_failed' && (
            <button type="button" onClick={() => onNavigate('runtime')} className="mt-2 text-sm font-medium underline underline-offset-2">
              查看运行记录并重试导入
            </button>
          )}
        </div>
        <div className="ml-auto flex flex-wrap gap-2 text-xs">
          <span className="rounded bg-canvas-default/70 px-2 py-1">{context.reference.declaredId || '参考未知'}</span>
          <span className="rounded bg-canvas-default/70 px-2 py-1">尝试 {context.executionAttemptId.slice(0, 8)}</span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label={context.parquet?.available ? 'Parquet 候选' : '已导入候选'} value={countsPending && total === 0 ? '按需查询' : total.toLocaleString()} detail={countsPending && total === 0 ? '打开结果类型后读取 Parquet 完整计数' : '完整结果集，不受当前筛选影响'} icon={<Layers3 className="h-5 w-5" />} />
        <SummaryCard label="已复核" value={countsPending && total === 0 ? '按需查询' : `${reviewed.toLocaleString()} / ${total.toLocaleString()}`} detail={countsPending && total === 0 ? '复核调整与结果查询同步读取' : `复核进度 ${progress}%`} icon={<CheckCircle2 className="h-5 w-5" />} />
        <SummaryCard label="已标记回报" value={reported.toLocaleString()} detail="此标记不等同于正式报告签发" icon={<FileWarning className="h-5 w-5" />} />
        <SummaryCard label="质控成员" value={context.qc.length.toLocaleString()} detail={context.members.map(member => member.role).join(' · ') || '未导入'} icon={<Clock3 className="h-5 w-5" />} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <article className="rounded-xl border border-border-default bg-canvas-default p-5 shadow-sm">
          <header className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-fg-default">结果类型概览</h3>
              <p className="mt-1 text-sm text-fg-muted">每一项来自当前执行的完整结果集。</p>
            </div>
            <button onClick={() => onNavigate('snv-indel')} className="inline-flex items-center gap-1 text-sm text-accent-fg hover:underline">开始判读 <ArrowRight className="h-4 w-4" /></button>
          </header>
          <div className="mt-5 space-y-3">
            {allCounts.map(item => (
              <button key={item.key} onClick={() => onNavigate(item.tab)} className="group grid w-full grid-cols-[112px_minmax(0,1fr)_56px] items-center gap-3 text-left">
                <span className="text-sm text-fg-default group-hover:text-accent-fg">{item.label}</span>
                <span className="h-3 overflow-hidden rounded-full bg-canvas-subtle" aria-label={item.unqueried ? `${item.label} Parquet待查询` : `${item.label} ${item.count} 条`}>
                  <span className={`block h-full rounded-full transition-[width] ${item.unqueried ? 'bg-accent-subtle' : 'bg-accent-emphasis'}`} style={{ width: `${item.unqueried ? 12 : (item.count / maxCount) * 100}%` }} />
                </span>
                <span className="text-right text-xs tabular-nums text-fg-muted">{item.unqueried ? '待查询' : item.count.toLocaleString()}</span>
              </button>
            ))}
          </div>
        </article>

        <aside className="rounded-xl border border-border-default bg-canvas-default p-5 shadow-sm">
          <h3 className="font-semibold text-fg-default">家系与证据</h3>
          <div className="mt-4 space-y-2">
            {context.members.length > 0 ? context.members.map(member => (
              <div key={member.id} className="flex items-center justify-between rounded-lg bg-canvas-subtle px-3 py-2 text-sm">
                <MemberLabel role={member.role} />
                <span className="max-w-[145px] truncate text-xs text-fg-muted">{member.sampleId || member.id}</span>
              </div>
            )) : <p className="text-sm text-fg-muted">尚未从归档识别成员信息。</p>}
          </div>
          <div className="mt-5 border-t border-border-default pt-4 text-sm">
            <p className="font-medium text-fg-default">测序证据</p>
            <p className="mt-1 text-fg-muted">{context.reference.available ? '参考资源已配置。选择变异后可在 IGV 中核对 reads。' : (context.reference.reason || '该执行尚未配置可判读参考。')}</p>
          </div>
        </aside>
      </div>
    </section>
  );
}

function SummaryCard({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: React.ReactNode }) {
  return (
    <article className="rounded-xl border border-border-default bg-canvas-default p-4 shadow-sm">
      <div className="flex items-center justify-between text-fg-muted"><span className="text-sm">{label}</span>{icon}</div>
      <p className="mt-3 text-2xl font-semibold tabular-nums text-fg-default">{value}</p>
      <p className="mt-1 text-xs text-fg-muted">{detail}</p>
    </article>
  );
}
