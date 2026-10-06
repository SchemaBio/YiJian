'use client';

import { CheckCircle2, Clock3, FileWarning } from 'lucide-react';
import type { ResultContext, TabType } from '../types';
import { CopyTableButton } from './CopyTableButton';
import { QCAndFamilyTables, SampleFamilyTable } from './QCResultTab';

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
    case 'ready': return { title: '结果可判读', detail: '下方统计及质控来自本次执行。', icon: CheckCircle2, tone: 'text-success-fg bg-success-subtle border-success-emphasis' };
    case 'importing': return { title: '结果导入中', detail: '正在准备结果，页面会自动刷新。', icon: Clock3, tone: 'text-warning-fg bg-warning-subtle border-warning-emphasis' };
    case 'import_failed': return { title: '结果导入失败', detail: '归档结果尚未完成导入，请重试导入或联系管理员。', icon: FileWarning, tone: 'text-danger-fg bg-danger-subtle border-danger-emphasis' };
    case 'workflow_running': return { title: '尚未产生结果', detail: '分析完成后将在此展示结果。', icon: Clock3, tone: 'text-accent-fg bg-accent-subtle border-accent-emphasis' };
    default: return { title: '等待结果', detail: '该执行尚未提供可判读结果。', icon: Clock3, tone: 'text-fg-muted bg-canvas-subtle border-border-default' };
  }
}

export function ResultOverview({ context, onNavigate }: { context: ResultContext; onNavigate: (tab: TabType) => void }) {
  const state = context.parquet?.available && context.importStatus === 'failed'
    ? { title: '检出表可判读', detail: '原始检出表已可读取，部分辅助数据尚未完成导入。', icon: CheckCircle2, tone: 'text-success-fg bg-success-subtle border-success-emphasis' }
    : stateDescription(context);
  const StateIcon = state.icon;
  const counts = TYPE_LABELS.map(item => {
    const unqueried = Boolean(context.parquet?.available && context.parquet.tables.includes(item.key) && !context.parquet.preparedTables.includes(item.key));
    const count = context.types[item.key];
    const known = Boolean(count) && !unqueried;
    return { ...item, count, known, status: unqueried ? '待查询' : !count ? '未提供' : count.total === 0 ? '无检出结果' : '可判读' };
  });
  const value = (item: typeof counts[number], key: 'total' | 'reported') => item.known ? String(item.count[key]) : '—';
  const rows = [
    ['结果类型', '检出数量', '回报', '数据状态'],
    ...counts.map(item => [item.label, value(item, 'total'), value(item, 'reported'), item.status]),
  ];
  const allKnown = counts.every(item => item.known);
  const totals = ['total', 'reported'].map(key => allKnown ? String(counts.reduce((sum, item) => sum + item.count[key as 'total' | 'reported'], 0)) : '—');
  rows.push(['合计', ...totals, allKnown ? '完整统计' : '部分数据未就绪']);

  return (
    <section className="space-y-2" aria-labelledby="result-overview-heading">
      <div className={`flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 ${state.tone}`}>
        <StateIcon className="h-5 w-5 shrink-0" />
        <div><h2 id="result-overview-heading" className="font-semibold">{state.title}</h2><span className="sr-only">{state.detail}</span></div>
        <span className="ml-auto shrink-0 rounded bg-canvas-default/70 px-2 py-1 text-xs">{context.reference.declaredId || '参考未知'}</span>
      </div>

      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      <div className="space-y-3">
      <section aria-labelledby="result-counts-heading" className="overflow-hidden rounded-lg border border-border-default bg-canvas-default">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border-default px-3 py-2">
          <div><h3 id="result-counts-heading" className="text-sm font-semibold text-fg-default">结果类型概览</h3></div>
          <CopyTableButton rows={rows} label="复制" />
        </header>
        <div className="overflow-x-auto">
          <table className="w-full select-text border-collapse text-center text-xs">
            <thead className="bg-canvas-subtle text-xs text-fg-muted"><tr>{rows[0].map(label => <th key={label} scope="col" className="whitespace-nowrap px-2 py-1 font-medium">{label}</th>)}</tr></thead>
            <tbody>{counts.map(item => (
              <tr key={item.key} className="border-t border-border-default hover:bg-canvas-subtle/50">
                <th scope="row" className="whitespace-nowrap px-2 py-1 font-medium text-fg-default"><button type="button" onClick={() => onNavigate(item.tab)} className="text-accent-fg hover:underline" title={`查看 ${item.label}`}>{item.label}</button></th>
                {(['total', 'reported'] as const).map(key => <td key={key} className="px-2 py-1 tabular-nums text-fg-default">{value(item, key)}</td>)}
                <td className="whitespace-nowrap px-2 py-1 text-xs text-fg-muted">{item.status}</td>
              </tr>
            ))}</tbody>
            <tfoot className="border-t border-border-default bg-canvas-subtle font-medium text-fg-default"><tr><th scope="row" className="px-2 py-1">合计</th>{totals.map((total, index) => <td key={index} className="px-2 py-1 tabular-nums">{total}</td>)}<td colSpan={1} className="px-2 py-1 text-xs font-normal text-fg-muted">{allKnown ? '完整统计' : '部分数据未就绪'}</td></tr></tfoot>
          </table>
        </div>
        <p className="border-t border-border-default px-2 py-1 text-xs text-fg-muted">“回报”不等同于正式报告签发。</p>
      </section>

      <SampleFamilyTable context={context} />
      </div>
      <QCAndFamilyTables context={context} />
      </div>

      <div className="rounded-lg border border-border-default bg-canvas-subtle px-3 py-2 text-xs text-fg-muted">
        <span className="mr-2 font-medium text-fg-default">测序证据</span>
        {context.reference.available ? '参考资源已配置。选择变异后可在 IGV 中核对 reads。' : (context.reference.reason || '该执行尚未配置可判读参考。')}
      </div>
    </section>
  );
}
