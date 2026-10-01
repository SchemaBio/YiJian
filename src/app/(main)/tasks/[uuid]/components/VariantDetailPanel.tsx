'use client';

import * as React from 'react';
import { X, ExternalLink, FileText, Database, Dna, Edit2, Check, Plus, Trash2, MessageSquare } from 'lucide-react';
import { Tag } from '@schema/ui-kit';
import type { SNVIndel, ACMGEvidenceEntry, ACMGClassification } from '../types';
import { ACMG_CONFIG } from '../result-api';
import { formatPopulationFrequency, sourceAnnotation } from '../utils/snv-annotations';
import { getResultRowAdjustmentHistory, type ResultRowAdjustmentEvent } from '../result-api';

function pubMedURL(pmid: string): string {
  return `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(String(pmid).trim())}`;
}

function clinVarURL(clinvarId: string): string {
  const id = String(clinvarId).trim().replace(/^VCV/i, '');
  return `https://www.ncbi.nlm.nih.gov/clinvar/variation/${encodeURIComponent(id)}`;
}

function dbSnpURL(rsId: string): string {
  return `https://www.ncbi.nlm.nih.gov/snp/${encodeURIComponent(String(rsId).trim())}`;
}

function omimURL(omimId: string): string {
  return `https://omim.org/entry/${encodeURIComponent(String(omimId).trim())}`;
}

interface VariantDetailPanelProps {
  taskId: string;
  variant: SNVIndel | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenIGV?: (chromosome: string, position: number) => void;
  onUpdateClassification?: (variant: SNVIndel, evidence: ACMGEvidenceEntry[], override: ACMGClassification | '', overrideReason: string, reason: string) => Promise<void>;
  onSaveInterpretation?: (variant: SNVIndel, interpretation: string, reason: string) => Promise<void>;
}

// 信息项组件
function InfoItem({ label, value, link }: { label: string; value?: React.ReactNode; link?: string }) {
  if (value === undefined || value === null || value === '' || value === '-') {
    return (
      <div className="flex justify-between py-1.5 border-b border-border-subtle last:border-0">
        <span className="text-fg-muted text-sm">{label}</span>
        <span className="text-fg-subtle text-sm">-</span>
      </div>
    );
  }

  return (
    <div className="flex justify-between py-1.5 border-b border-border-subtle last:border-0">
      <span className="text-fg-muted text-sm">{label}</span>
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-fg text-sm hover:underline flex items-center gap-1"
        >
          {value}
          <ExternalLink className="w-3 h-3" />
        </a>
      ) : (
        <span className="max-w-[65%] break-words text-right text-fg-default text-sm font-medium">{value}</span>
      )}
    </div>
  );
}

// 分组标题组件
function SectionTitle({ icon: Icon, title, action }: { icon: React.ElementType; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3 mt-5 first:mt-0">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-fg-muted" />
        <h4 className="text-sm font-medium text-fg-default">{title}</h4>
      </div>
      {action}
    </div>
  );
}

const POINTS: Record<string, number> = { supporting: 1, moderate: 2, strong: 4, very_strong: 8, standalone: 0 };
const POINT_CRITERIA = [
  { title: '致病性证据', items: ['PVS1', 'PS1', 'PS2', 'PS3', 'PS4', 'PM1', 'PM2', 'PM3', 'PM4', 'PM5', 'PM6', 'PP1', 'PP2', 'PP3', 'PP4', 'PP5'] },
  { title: '良性证据', items: ['BA1', 'BS1', 'BS2', 'BS3', 'BS4', 'BP1', 'BP2', 'BP3', 'BP4', 'BP5', 'BP6', 'BP7'] },
];

function classifyPoints(score: number, count: number): ACMGClassification | undefined {
  if (score >= 10) return 'Pathogenic';
  if (score >= 6) return 'Likely_Pathogenic';
  if (score <= -7) return 'Benign';
  if (score <= -1) return 'Likely_Benign';
  return count ? 'VUS' : undefined;
}

function adjustmentDiff(beforeJSON: string, afterJSON: string): Array<{ key: string; before: string; after: string }> {
  try {
    const before = JSON.parse(beforeJSON || '{}') as Record<string, unknown>;
    const after = JSON.parse(afterJSON || '{}') as Record<string, unknown>;
    return [...new Set([...Object.keys(before), ...Object.keys(after)])]
      .filter(key => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
      .map(key => ({
        key,
        before: before[key] === undefined ? '未设置' : JSON.stringify(before[key]),
        after: after[key] === undefined ? '未设置' : JSON.stringify(after[key]),
      }));
  } catch {
    return [];
  }
}

function ACMGPointsEditor({
  variant,
  onSave,
  onCancel,
}: {
  variant: SNVIndel;
  onSave: (evidence: ACMGEvidenceEntry[], override: ACMGClassification | '', overrideReason: string, reason: string) => Promise<void>;
  onCancel: () => void;
}) {
  const initialEvidence = variant.acmgEvidence ?? variant.automaticAcmg?.criteria ?? [];
  const [evidence, setEvidence] = React.useState<Record<string, ACMGEvidenceEntry>>(() => Object.fromEntries(initialEvidence.map(item => [item.code, item])));
  const [override, setOverride] = React.useState<ACMGClassification | ''>(variant.acmgOverride ?? '');
  const [overrideReason, setOverrideReason] = React.useState(variant.acmgOverrideReason ?? '');
  const [reason, setReason] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const score = Object.values(evidence).reduce((sum, item) => {
    if (item.code === 'BA1') return sum;
    const points = POINTS[item.strength] ?? 0;
    return sum + (item.code.startsWith('B') ? -points : points);
  }, 0);
  const calculated = Object.values(evidence).some(item => item.code === 'BA1') ? 'Benign' : classifyPoints(score, Object.keys(evidence).length);
  const effective = override || calculated;
  const auto = variant.automaticAcmg;
  const changed = JSON.stringify(Object.values(evidence).sort((a, b) => a.code.localeCompare(b.code))) !== JSON.stringify([...initialEvidence].sort((a, b) => a.code.localeCompare(b.code))) || override !== (variant.acmgOverride ?? '') || overrideReason !== (variant.acmgOverrideReason ?? '');

  const toggle = (code: string, checked: boolean) => setEvidence(previous => {
    const next = { ...previous };
    if (!checked) delete next[code];
    else {
      if (code === 'PP3') delete next.BP4;
      if (code === 'BP4') delete next.PP3;
      const strength = code === 'BA1' ? 'standalone' : (code === 'PVS1' ? 'very_strong' : code.startsWith('P') && code.slice(0, 2) === 'PS' || code.startsWith('B') && code.slice(0, 2) === 'BS' ? 'strong' : 'supporting');
      next[code] = { code, strength, source: code === 'PP3' || code === 'BP4' ? 'AlphaMissense' : '人工证据' };
    }
    return next;
  });

  const save = async () => {
    if (override && !overrideReason.trim()) { setError('人工覆写分类必须填写理由'); return; }
    if (changed && !reason.trim()) { setError('请填写本次调整理由'); return; }
    setSaving(true); setError('');
    try {
      await onSave(Object.values(evidence), override, overrideReason.trim(), reason.trim());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存 ACMG 证据失败');
    } finally {
      setSaving(false);
    }
  };

  return <div className="space-y-4">
    <div className="rounded-lg border border-accent-subtle bg-accent-subtle/30 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">自动初评 · {auto?.profile ?? 'acmg-snv-points-v1'}</span><span>自动分类：{auto?.classification ? ACMG_CONFIG[auto.classification]?.label : '证据不足'} · {auto?.score ?? 0} 分</span></div>
      {auto?.pending?.length ? <p className="mt-1 text-xs text-fg-muted">待确认：{auto.pending.join('；')}</p> : <p className="mt-1 text-xs text-fg-muted">未纳入缺乏当前证据前提的人群、疾病机制、家系或实验室证据。</p>}
    </div>
    {POINT_CRITERIA.map(group => <section key={group.title} className="space-y-2">
      <h5 className="text-sm font-semibold text-fg-default">{group.title}</h5>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {group.items.map(code => {
          const item = evidence[code];
          return <div key={code} className={`flex min-w-0 items-center gap-2 rounded-md border p-2 ${item ? (code.startsWith('B') ? 'border-success-emphasis/40 bg-success-subtle/30' : 'border-danger-emphasis/40 bg-danger-subtle/30') : 'border-border-subtle bg-canvas-default'}`}>
            <input type="checkbox" checked={Boolean(item)} onChange={event => toggle(code, event.target.checked)} aria-label={`选择 ACMG 证据 ${code}`} />
            <span className="w-12 shrink-0 text-xs font-semibold">{code}</span>
            {item && code !== 'BA1' && <select value={item.strength} onChange={event => setEvidence(previous => ({ ...previous, [code]: { ...previous[code], strength: event.target.value as ACMGEvidenceEntry['strength'] } }))} aria-label={`${code} 强度`} className="min-w-0 flex-1 rounded border border-border-default bg-canvas-default px-1.5 py-1 text-xs">
              {(code === 'PVS1' ? [['very_strong', '非常强']]:[['supporting','支持'],['moderate','中等'],['strong','强'],...(code.startsWith('P') ? [['very_strong','非常强']] : [])]).map(([value, label]) => <option key={value} value={value}>{label}（{POINTS[value]} 分）</option>)}
            </select>}
            {item && code === 'BA1' && <span className="text-xs text-success-fg">独立良性证据</span>}
          </div>;
        })}
      </div>
    </section>)}
    <div className="rounded-lg border border-border-subtle bg-canvas-default p-3 text-sm"><div className="flex justify-between"><span>证据积分</span><strong>{score}</strong></div><div className="mt-1 flex justify-between"><span>积分分类</span><strong>{calculated ? ACMG_CONFIG[calculated].label : '证据不足'}</strong></div></div>
    <div><label className="mb-1 block text-sm font-medium">人工覆写最终分类</label><select value={override} onChange={event => setOverride(event.target.value as ACMGClassification | '')} className="w-full rounded-md border border-border-default bg-canvas-default px-3 py-2 text-sm"><option value="">按证据积分显示</option>{Object.entries(ACMG_CONFIG).map(([key, config]) => <option key={key} value={key}>{config.label}</option>)}</select></div>
    {override && <textarea value={overrideReason} onChange={event => setOverrideReason(event.target.value)} placeholder="人工覆写理由（必填）" className="min-h-16 w-full rounded-md border border-border-default bg-canvas-default p-2 text-sm" />}
    <textarea value={reason} onChange={event => setReason(event.target.value)} placeholder={changed ? '本次证据调整理由（必填）' : '调整理由（如有）'} className="min-h-16 w-full rounded-md border border-border-default bg-canvas-default p-2 text-sm" />
    {error && <p role="alert" className="text-sm text-danger-fg">{error}</p>}
    <div className="flex gap-2"><button type="button" disabled={saving} onClick={() => void save()} className="flex flex-1 items-center justify-center gap-1 rounded-md bg-accent-emphasis px-3 py-2 text-sm text-fg-on-emphasis disabled:opacity-50"><Check className="h-4 w-4" />{saving ? '保存中…' : '保存证据与分类'}</button><button type="button" onClick={onCancel} className="rounded-md border border-border px-3 py-2 text-sm">取消</button></div>
  </div>;
}

export function VariantDetailPanel({ taskId, variant, isOpen, onClose, onOpenIGV, onUpdateClassification, onSaveInterpretation }: VariantDetailPanelProps) {
  const [isEditingACMG, setIsEditingACMG] = React.useState(false);
  const [localClassification, setLocalClassification] = React.useState<ACMGClassification | null>(null);
  const [localCriteria, setLocalCriteria] = React.useState<string[] | null>(null);
  const [interpretation, setInterpretation] = React.useState('');
  const [interpretationReason, setInterpretationReason] = React.useState('');
  const [interpretationSaving, setInterpretationSaving] = React.useState(false);
  const [interpretationError, setInterpretationError] = React.useState('');
  const [adjustmentHistory, setAdjustmentHistory] = React.useState<ResultRowAdjustmentEvent[]>([]);
  const canEditACMG = Boolean(onUpdateClassification);

  // 当 variant 变化时重置编辑状态
  React.useEffect(() => {
    setIsEditingACMG(false);
    setLocalClassification(null);
    setLocalCriteria(null);
    setInterpretation(variant?.interpretation ?? '');
    setInterpretationReason('');
    setInterpretationError('');
  }, [variant?.id]);

  React.useEffect(() => {
    if (!variant) { setAdjustmentHistory([]); return; }
    const controller = new AbortController();
    void getResultRowAdjustmentHistory(taskId, 'snv-indel', variant.id, controller.signal)
      .then(setAdjustmentHistory)
      .catch(() => { if (!controller.signal.aborted) setAdjustmentHistory([]); });
    return () => controller.abort();
  }, [taskId, variant?.id]);

  if (!isOpen || !variant) return null;

  const currentClassification = localClassification ?? variant.acmgClassification;
  const currentCriteria = localCriteria ?? variant.acmgCriteria ?? [];
  const acmgConfig = currentClassification ? ACMG_CONFIG[currentClassification] : undefined;
  
  const annotation = (column: string, fallback?: string | number) => sourceAnnotation(variant, column, fallback);

  // 保存 ACMG 分类
  const handleSaveACMG = async (evidence: ACMGEvidenceEntry[], override: ACMGClassification | '', overrideReason: string, reason: string) => {
    if (!onUpdateClassification) return;
    await onUpdateClassification(variant, evidence, override, overrideReason, reason);
    try {
      setAdjustmentHistory(await getResultRowAdjustmentHistory(taskId, 'snv-indel', variant.id));
    } catch {
      // The saved assessment remains successful even if history refresh is unavailable.
    }
    const score = evidence.reduce((total, item) => total + (item.code === 'BA1' ? 0 : (item.code.startsWith('B') ? -1 : 1) * (POINTS[item.strength] ?? 0)), 0);
    setLocalClassification(override || classifyPoints(score, evidence.length) || null);
    setLocalCriteria(evidence.map(item => item.code));
    setIsEditingACMG(false);
  };

  const handleSaveInterpretation = async () => {
    if (!variant || !onSaveInterpretation || interpretationSaving) return;
    if (interpretation === (variant.interpretation ?? '')) return;
    if (!interpretationReason.trim()) {
      setInterpretationError('请填写本次判读调整理由');
      return;
    }
    setInterpretationSaving(true);
    setInterpretationError('');
    try {
      await onSaveInterpretation(variant, interpretation, interpretationReason.trim());
      setInterpretationReason('');
      const history = await getResultRowAdjustmentHistory(taskId, 'snv-indel', variant.id);
      setAdjustmentHistory(history);
    } catch (cause) {
      setInterpretationError(cause instanceof Error ? cause.message : '保存人工解读失败');
    } finally {
      setInterpretationSaving(false);
    }
  };

  return (
    <>
      {/* 背景遮罩 */}
      <div 
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />
      
      {/* 侧边面板 */}
      <div className="fixed right-0 top-0 h-full w-[480px] max-w-full bg-white dark:bg-[#0d1117] border-l border-border shadow-xl z-50 flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-canvas-subtle">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-medium text-fg-default">变异详情</h3>
            {acmgConfig ? <Tag variant={acmgConfig.variant}>{acmgConfig.label}</Tag> : <Tag variant="neutral">ACMG 未评定</Tag>}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-fg-muted hover:text-fg-default hover:bg-canvas-inset rounded transition-colors"
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* 基本信息 */}
          <SectionTitle icon={Dna} title="基本信息" />
          <div className="bg-canvas-subtle rounded-lg p-3">
            <InfoItem label="基因" value={variant.gene} />
            <InfoItem 
              label="位置" 
              value={
                <button
                  onClick={() => onOpenIGV?.(variant.chromosome, variant.position)}
                  className="text-accent-fg hover:underline"
                >
                  {variant.chromosome}:{variant.position}
                </button>
              }
            />
            <InfoItem label="参考/变异" value={`${variant.ref} > ${variant.alt}`} />
            <InfoItem label="变异类型" value={variant.variantType} />
            <InfoItem label="杂合性" value={
              variant.zygosity === 'Heterozygous' ? '杂合' :
              variant.zygosity === 'Homozygous' ? '纯合' :
              variant.zygosity === 'Hemizygous' ? '半合' : '未提供'
            } />
            <InfoItem label="转录本" value={variant.transcript} />
            <InfoItem label="cDNA变化" value={variant.hgvsc} />
            <InfoItem label="蛋白质变化" value={variant.hgvsp} />
            <InfoItem label="变异后果" value={variant.consequence} />
          </div>

          {/* 测序质量 */}
          <SectionTitle icon={FileText} title="测序质量" />
          <div className="bg-canvas-subtle rounded-lg p-3">
            <InfoItem label="样本变异等位基因比例（VAF）" value={`${(variant.alleleFrequency * 100).toFixed(1)}%`} />
            <InfoItem label="覆盖深度" value={`${variant.depth}X`} />
          </div>

          <SectionTitle icon={Database} title="ClinVar 注释" />
          <div className="bg-canvas-subtle rounded-lg p-3">
            <InfoItem label="临床意义" value={annotation('ClinVar_Sig', variant.clinvarSignificance)} />
            <InfoItem label="审核状态" value={annotation('ClinVar_RevStat', variant.clinvarReviewStatus)} />
            <InfoItem label="审核星级" value={annotation('ClinVar_Star', variant.clinvarStars)} />
            <InfoItem label="关联疾病" value={annotation('ClinVar_DN', variant.clinvarDisease)} />
          </div>

          {/* 人群频率 */}
          <SectionTitle icon={Database} title="人群频率" />
          <div className="bg-canvas-subtle rounded-lg p-3">
            <InfoItem label="gnomAD 总体 AF" value={formatPopulationFrequency(annotation('GnomAD_AF', variant.gnomadAF))} />
            <InfoItem label="gnomAD 东亚 AF" value={formatPopulationFrequency(annotation('GnomAD_AF_EAS', variant.gnomadEasAF))} />
            <InfoItem label="VEP MAX_AF" value={formatPopulationFrequency(annotation('MAX_AF', variant.maxAF))} />
            <InfoItem label="gnomAD nhomalt XX" value={annotation('GnomAD_nhomalt_XX', variant.gnomadNhomaltXX)} />
            <InfoItem label="gnomAD nhomalt XY" value={annotation('GnomAD_nhomalt_XY', variant.gnomadNhomaltXY)} />
            <p className="mt-2 text-xs text-fg-muted">AF 为 0–1 的原始比值；nhomalt 为纯合变异计数。</p>
          </div>

          {/* 功能预测 */}
          <SectionTitle icon={Dna} title="功能预测" />
          <div className="bg-canvas-subtle rounded-lg p-3">
            <InfoItem label="Pangolin gain" value={annotation('Pangolin_Gain', variant.pangolinGain)} />
            <InfoItem label="Pangolin loss" value={annotation('Pangolin_Loss', variant.pangolinLoss)} />
            <InfoItem label="Pangolin 预测标签" value={annotation('Pangolin_AN', variant.pangolinAnnotation)} />
            <InfoItem label="EVOScore2" value={annotation('EVOScore', variant.evoScore)} />
            <InfoItem label="EVOScore2 预测标签" value={annotation('EVOScore_AN', variant.evoAnnotation)} />
            <InfoItem label="AlphaMissense 分数" value={annotation('AlphaMissense_AM', variant.alphaMissenseScore)} />
            <InfoItem label="AlphaMissense 预测标签" value={annotation('AlphaMissense_AMC', variant.alphaMissenseClass)} />
            <p className="mt-2 text-xs text-fg-muted">保留流程输出的多值与标签；功能预测标签不是 ACMG 分级。</p>
          </div>

          {/* ACMG 分类 */}
          <SectionTitle 
            icon={FileText} 
            title="ACMG 分类" 
            action={
              canEditACMG && !isEditingACMG && (
                <button
                  onClick={() => setIsEditingACMG(true)}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-fg-muted hover:text-fg-default hover:bg-canvas-inset rounded transition-colors"
                >
                  <Edit2 className="w-3 h-3" />
                  编辑
                </button>
              )
            }
          />
          <div className="bg-canvas-subtle rounded-lg p-3">
            {isEditingACMG ? (
              <ACMGPointsEditor
                variant={variant}
                onSave={handleSaveACMG}
                onCancel={() => setIsEditingACMG(false)}
              />
            ) : (
              <>
                <InfoItem label="分类" value={acmgConfig ? <Tag variant={acmgConfig.variant}>{acmgConfig.label}</Tag> : '未评定'} />
                <InfoItem label="评估来源" value={variant.acmgAssessmentSource === 'manual_override' ? '人工覆写' : variant.acmgAssessmentSource === 'manual_evidence' ? '已保存证据积分' : '自动初评'} />
                <InfoItem label="自动初评分数" value={variant.automaticAcmg ? `${variant.automaticAcmg.score} 分` : undefined} />
                {!acmgConfig && <p className="mt-2 text-xs text-fg-muted">当前注释不足以形成 ACMG 分类；缺失的人群、疾病机制、家系或实验室证据不会自动补推。</p>}
                <InfoItem 
                  label="证据项" 
                  value={currentCriteria.length ? (
                    <div className="flex flex-wrap gap-1">
                      {currentCriteria.map((c) => (
                        <span key={c} className="px-1.5 py-0.5 text-xs bg-canvas-inset rounded">
                          {c}
                        </span>
                      ))}
                    </div>
                  ) : undefined}
                />
              </>
            )}
          </div>

          <SectionTitle icon={FileText} title="判读变更记录" />
          <div className="space-y-2 rounded-lg bg-canvas-subtle p-3">
            {adjustmentHistory.length === 0 ? <p className="text-sm text-fg-muted">暂无调整记录</p> : adjustmentHistory.map(event => <article key={event.id} className="rounded-md border border-border-subtle bg-canvas-default p-2.5">
              <div className="flex flex-wrap justify-between gap-1 text-xs text-fg-muted"><span>{event.actor || '用户'}</span><time>{event.createdAt ? new Date(event.createdAt).toLocaleString() : ''}</time></div>
              <p className="mt-1 text-sm text-fg-default">{event.reason || '未填写理由'}</p>
              {adjustmentDiff(event.before, event.after).map(change => <p key={change.key} className="mt-1 break-words text-xs text-fg-muted"><span className="font-medium">{change.key}：</span>{change.before} → {change.after}</p>)}
            </article>)}
          </div>

          {/* 人工解读 */}
          <SectionTitle icon={MessageSquare} title="人工解读" />
          <div className="bg-canvas-subtle rounded-lg p-3">
            <textarea
              value={interpretation}
              onChange={(e) => setInterpretation(e.target.value)}
              placeholder="请输入您对该变异的解读分析..."
              className="w-full min-h-[120px] px-3 py-2 text-sm border border-border-default rounded-md bg-canvas-default text-fg-default resize-y focus:outline-none focus:ring-2 focus:ring-accent-emphasis focus:border-transparent"
            />
            <div className="mt-2 space-y-2">
              <input value={interpretationReason} onChange={event => setInterpretationReason(event.target.value)} placeholder="本次调整理由（保存时必填）" className="h-9 w-full rounded-md border border-border-default bg-canvas-default px-2 text-sm" />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-fg-muted">{interpretation.length} 字</span>
                <button type="button" disabled={interpretationSaving || interpretation === (variant.interpretation ?? '')} onClick={() => void handleSaveInterpretation()} className="rounded-md bg-accent-emphasis px-3 py-1.5 text-sm text-fg-on-emphasis disabled:opacity-50">{interpretationSaving ? '保存中…' : '保存人工解读'}</button>
              </div>
              {interpretationError && <p role="alert" className="text-sm text-danger-fg">{interpretationError}</p>}
            </div>
          </div>

          {/* 临床意义 */}
          <SectionTitle icon={Database} title="GenCC 与变异标识" />
          <div className="bg-canvas-subtle rounded-lg p-3">
            <InfoItem 
              label="dbSNP" 
              value={variant.rsId}
              link={variant.rsId ? dbSnpURL(variant.rsId) : undefined}
            />
            <InfoItem label="HGNC ID" value={annotation('HGNC_ID')} />
            <InfoItem label="Cytoband" value={annotation('Cytoband')} />
            <InfoItem label="GenCC 疾病关联" value={annotation('GenCC_disease_title', variant.diseaseAssociation)} />
            <InfoItem label="GenCC 遗传模式名称" value={annotation('GenCC_moi_title')} />
            <InfoItem label="GenCC 疾病标识" value={annotation('GenCC_disease_original_curie')} />
            <InfoItem label="遗传模式" value={
              variant.inheritanceMode === 'AD' ? '常染色体显性' :
              variant.inheritanceMode === 'AR' ? '常染色体隐性' :
              variant.inheritanceMode === 'XL' ? 'X连锁' :
              variant.inheritanceMode === 'XLD' ? 'X连锁显性' :
              variant.inheritanceMode === 'XLR' ? 'X连锁隐性' :
              annotation('GenCC_moi_curie', variant.inheritanceMode)
            } />
          </div>

          {/* 文献 */}
          {variant.pubmedIds && variant.pubmedIds.length > 0 && (
            <>
              <SectionTitle icon={FileText} title="相关文献" />
              <div className="bg-canvas-subtle rounded-lg p-3">
                <div className="flex flex-wrap gap-2">
                  {variant.pubmedIds.map((pmid) => (
                    <a
                      key={pmid}
                      href={pubMedURL(pmid)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-canvas-inset text-accent-fg rounded hover:bg-accent-subtle transition-colors"
                    >
                      PMID:{pmid}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* 底部操作栏 */}
        <div className="border-t border-border p-4 bg-canvas-subtle">
          <div className="flex gap-2">
            <button
              onClick={() => onOpenIGV?.(variant.chromosome, variant.position)}
              className="flex-1 px-4 py-2 text-sm bg-accent-emphasis text-fg-on-emphasis rounded-md hover:bg-accent-emphasis/90 transition-colors"
            >
              在 IGV 中查看
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm border border-border rounded-md hover:bg-canvas-inset transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
