'use client';
import { HoverHint } from '@/components/shared/HoverHint';


import type { QCMetric, ResultContext } from '../types';
import { CopyTableButton } from './CopyTableButton';

interface MetricDefinition {
  key: string;
  label: string;
  unit: 'reads' | 'percent' | '×' | 'bp';
  warningMin?: number;
  warningMax?: number;
  prompt?: string;
}

const METRICS: MetricDefinition[] = [
  { key: 'beforeTotalReads', label: '过滤前 reads', unit: 'reads' },
  { key: 'totalReads', label: '过滤后 reads', unit: 'reads', warningMin: 80_000_000, prompt: '≥80,000,000 reads' },
  { key: 'mappedReads', label: '已比对 reads', unit: 'reads' },
  { key: 'mappedReadsFraction', label: '比对率', unit: 'percent', warningMin: 0.95, prompt: '≥95%' },
  { key: 'targetDataFraction', label: '靶向捕获效率', unit: 'percent' },
  { key: 'averageDepth', label: '平均深度', unit: '×', warningMin: 100, prompt: '≥100×' },
  { key: 'dedupDepth', label: '去重深度', unit: '×', warningMin: 80, prompt: '≥80×' },
  { key: 'coverageGt02Avg', label: '均一性（>0.2× 平均深度）', unit: 'percent' },
  { key: 'coverageGte30x', label: '≥30× 覆盖率（去重）', unit: 'percent', warningMin: 0.98, prompt: '≥98%' },
  { key: 'meanTargetCoverage', label: '目标区平均深度', unit: '×' },
  { key: 'pctTargetBases30x', label: '目标碱基 ≥30× 比例', unit: 'percent' },
  { key: 'duplicateRate', label: '重复率', unit: 'percent', warningMax: 0.2, prompt: '≤20%' },
  { key: 'q30Rate', label: 'Q30 比例', unit: 'percent', warningMin: 0.85, prompt: '≥85%' },
  { key: 'gcContent', label: 'GC 比例', unit: 'percent' },
  { key: 'insertSizeMedian', label: '插入片段中位数', unit: 'bp' },
  { key: 'mtAverageDepth', label: '线粒体平均深度', unit: '×' },
  { key: 'mtCoverageGt0x', label: '线粒体 >0× 覆盖率', unit: 'percent' },
];

export function memberRoleLabel(role: string) {
  const roles: Record<string, string> = { proband: '先证者', father: '父亲', paternal: '父亲', mother: '母亲', maternal: '母亲', single: '单样本', patient: '受检者', unknown: '成员未知' };
  return roles[role.toLowerCase()] ?? (role || '成员未知');
}

/** Source-based compatibility with the older API that mislabeled xamdst.
 * Never infer scale from magnitude: 0.5% is a valid percentage.
 */
function percentageScale(metric: QCMetric): number | null {
  if (metric.unit === 'percent' || metric.unit === '%') return 1;
  if (metric.source === 'xamdst' || metric.source === 'mt_xamdst') return 1;
  if (metric.unit === 'fraction') return 100;
  return null;
}

function formatMetric(metric: QCMetric | undefined, definition: MetricDefinition): string {
  if (!metric || metric.value === null || !Number.isFinite(metric.value)) return '未提供';
  if (definition.unit === 'percent') {
    const scale = percentageScale(metric);
    return scale === null ? '单位未确认' : `${(metric.value * scale).toFixed(2)}%`;
  }
  if (definition.unit === 'reads') return metric.value.toLocaleString('en-US', { maximumFractionDigits: 20 });
  if (definition.unit === 'bp') return `${metric.value.toFixed(0)} bp`;
  return `${metric.value.toFixed(2)}×`;
}

function needsAttention(metric: QCMetric | undefined, definition: MetricDefinition): boolean {
  if (!metric || metric.value === null || !Number.isFinite(metric.value)) return false;
  const scale = definition.unit === 'percent' ? percentageScale(metric) : 1;
  if (scale === null) return false;
  const value = definition.unit === 'percent' ? metric.value * scale / 100 : metric.value;
  return (definition.warningMin !== undefined && value < definition.warningMin)
    || (definition.warningMax !== undefined && value > definition.warningMax);
}

function orderedMembers(context: ResultContext) {
  const members = [...context.members];
  for (const member of context.qc) {
    if (!members.some(item => item.id === member.memberId)) members.push({ id: member.memberId, role: member.memberRole, sampleId: member.sampleId });
  }
  const roleOrder: Record<string, number> = { proband: 0, single: 0, patient: 0, father: 1, paternal: 1, mother: 2, maternal: 2 };
  return members.sort((a, b) => (roleOrder[a.role.toLowerCase()] ?? 3) - (roleOrder[b.role.toLowerCase()] ?? 3));
}

function genderLabel(value?: string) { return value === 'male' ? '男' : value === 'female' ? '女' : '未知'; }
function comparisonLabel(value?: string) { return value === 'match' ? '一致' : value === 'mismatch' ? '需核对' : '信息不足'; }

export function SampleFamilyTable({ context }: { context: ResultContext }) {
  const members = orderedMembers(context);
  const rows = [
    ['成员', '样本编号', '登记性别', '数据性别', 'SRY reads', '对照'],
    ...members.map(member => {
      const qc = context.qc.find(item => item.memberId === member.id);
      const count = qc?.metrics.find(metric => metric.key === 'sryCount')?.value;
      return [memberRoleLabel(member.role), member.sampleId || '未提供', genderLabel(qc?.declaredGender), genderLabel(qc?.predictedGender), count == null ? '未提供' : String(count), comparisonLabel(qc?.genderComparison)];
    }),
  ];
  return <section aria-labelledby="overview-family-heading" className="overflow-hidden rounded-lg border border-border-default bg-canvas-default">
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border-default px-3 py-2">
      <h3 id="overview-family-heading" className="text-sm font-semibold text-fg-default">样本与性别核对</h3>
      {members.length > 0 && <CopyTableButton rows={rows} label="复制" />}
    </header>
    {members.length === 0 ? <p className="p-3 text-xs text-fg-muted">未提供成员信息。</p> : <div className="overflow-x-auto"><table className="w-full select-text border-collapse text-left text-sm">
      <thead className="bg-canvas-subtle text-fg-muted"><tr>{rows[0].map(label => <th key={label} scope="col" className="whitespace-nowrap px-2 py-1.5 font-medium">{label}</th>)}</tr></thead>
      <tbody>{rows.slice(1).map((row, index) => {
        const qc = context.qc.find(item => item.memberId === members[index].id);
        return <tr key={members[index].id} className="border-t border-border-default">{row.map((value, column) => <HoverHint content={column === 3 && qc?.sryCutoff !== undefined ? `SRY reads > ${qc.sryCutoff} 判为男性，否则判为女性` : undefined} key={column}><td key={column}  className={`px-2 py-1.5 ${column === 1 ? 'max-w-[160px] break-all' : 'whitespace-nowrap'} ${column === 5 && qc?.genderComparison === 'mismatch' ? 'bg-warning-subtle font-medium text-warning-fg' : 'text-fg-default'}`}>{value}</td></HoverHint>)}</tr>;
      })}</tbody>
    </table></div>}
    <p className="border-t border-border-default px-3 py-1.5 text-[11px] text-fg-muted">数据性别来自本次 SRY 检测，仅用于样本核对；缺少数据时不推断性别。</p>
  </section>;
}

export function QCAndFamilyTables({ context }: { context: ResultContext }) {
  const members = orderedMembers(context);
  const metricFor = (id: string, key: string) => context.qc.find(member => member.memberId === id)?.metrics.find(metric => metric.key === key);
  const rows = [
    ['指标', ...members.map(member => `${memberRoleLabel(member.role)} · ${member.sampleId || member.id}`), '复核提示'],
    ...METRICS.map(definition => [definition.label, ...members.map(member => formatMetric(metricFor(member.id, definition.key), definition)), definition.prompt || '—']),
  ];
  return <section aria-labelledby="overview-qc-heading" className="overflow-hidden rounded-lg border border-border-default bg-canvas-default">
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border-default px-3 py-2">
      <h3 id="overview-qc-heading" className="text-sm font-semibold text-fg-default">质控统计</h3>
      {members.length > 0 && context.qc.length > 0 && <CopyTableButton rows={rows} label="复制质控" />}
    </header>
    {members.length === 0 || context.qc.length === 0 ? <p className="p-3 text-xs text-fg-muted">该执行尚未提供成员质控数据。</p> : <div className="overflow-x-auto"><table className="w-full select-text border-collapse text-left text-sm">
      <thead className="bg-canvas-subtle text-fg-muted"><tr>
        <th scope="col" className="px-3 py-1.5 font-medium">指标</th>
        {members.map(member => <HoverHint content={member.sampleId || member.id} key={member.id}><th key={member.id} scope="col"  className="min-w-[105px] px-2 py-1.5 font-medium">{memberRoleLabel(member.role)}</th></HoverHint>)}
      </tr></thead>
      <tbody>{METRICS.map(definition => <tr key={definition.key} className="border-t border-border-default hover:bg-canvas-subtle/50">
        <HoverHint content={definition.prompt ? `复核提示：${definition.prompt}` : undefined}><th scope="row"  className="whitespace-nowrap px-3 py-1.5 font-normal text-fg-default">{definition.label}</th></HoverHint>
        {members.map(member => {
          const metric = metricFor(member.id, definition.key);
          const attention = needsAttention(metric, definition);
          return <HoverHint content={`来源：${metric?.source || '未提供'}${definition.prompt ? `；复核提示：${definition.prompt}` : ''}`} key={member.id}><td key={member.id}  className={`whitespace-nowrap px-2 py-1.5 tabular-nums ${attention ? 'bg-warning-subtle text-warning-fg' : 'text-fg-default'}`}>
            <span className="font-medium">{formatMetric(metric, definition)}</span>
          </td></HoverHint>;
        })}
      </tr>)}</tbody>
    </table></div>}
    <p className="border-t border-border-default px-3 py-1.5 text-[11px] text-fg-muted">质控复核提示不作为报告放行结论。</p>
  </section>;
}
