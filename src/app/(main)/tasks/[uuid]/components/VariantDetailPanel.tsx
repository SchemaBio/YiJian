'use client';
import { useInterpretationReadOnly } from './InterpretationLock';

import * as React from 'react';
import { WorkspaceInspector, InspectorTabs, type InspectorSection } from '@/components/shared/WorkspaceInspector';
import { VariantResourceLinks } from './VariantResourceLinks';
import { ClinVarBadge } from './ClinVarBadge';
import { X, ExternalLink, FileText, Database, Dna, Edit2, Check, Plus, Trash2, MessageSquare } from 'lucide-react';
import { Tag } from '@schema/ui-kit';
import type { SNVIndel, ACMGEvidenceEntry, ACMGClassification } from '../types';
import { ACMG_CONFIG } from '../result-api';
import { formatPopulationFrequency, optionalAnnotationNumber, sourceAnnotation } from '../utils/snv-annotations';
import { getResultRowAdjustmentHistory, type ResultRowAdjustmentEvent } from '../result-api';

interface VariantDetailPanelProps {
  taskId: string;
  referenceGenome?: string;
  variant: SNVIndel | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateClassification?: (variant: SNVIndel, evidence: ACMGEvidenceEntry[], override: ACMGClassification | '', overrideReason: string, reason: string, reset?: boolean) => Promise<void>;
  onSaveInterpretation?: (variant: SNVIndel, interpretation: string, reason: string) => Promise<void>;
}

// 信息项组件
function InfoItem({ label, value, link }: { label: string; value?: React.ReactNode; link?: string }) {
  if (value === undefined || value === null || value === '' || value === '-') {
    return (
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)] gap-3 py-2 border-b border-border-subtle last:border-0">
        <span className="text-fg-muted text-sm">{label}</span>
        <span className="text-fg-subtle text-sm">-</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)] gap-3 py-2 border-b border-border-subtle last:border-0">
      <span className="text-fg-muted text-sm">{label}</span>
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          referrerPolicy="no-referrer"
          className="min-w-0 break-words text-right text-accent-fg text-sm hover:underline flex items-start justify-end gap-1"
        >
          {value}
          <ExternalLink className="w-3 h-3" />
        </a>
      ) : (
        <span className="min-w-0 break-words text-right text-fg-default text-sm font-medium">{value}</span>
      )}
    </div>
  );
}

function AnnotationField({ label, value }: { label: string; value?: string }) {
  return <div><dt className="text-xs text-fg-muted">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-fg-default">{value && !['.', '-'].includes(value) ? value : '未提供'}</dd></div>;
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

function adjustmentDiff(beforeJSON: Record<string, unknown> | string, afterJSON: Record<string, unknown> | string): Array<{ key: string; before: string; after: string }> {
  try {
    const before = (typeof beforeJSON === 'string' ? JSON.parse(beforeJSON || '{}') : beforeJSON) as Record<string, unknown>;
    const after = (typeof afterJSON === 'string' ? JSON.parse(afterJSON || '{}') : afterJSON) as Record<string, unknown>;
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
  onSave: (evidence: ACMGEvidenceEntry[], override: ACMGClassification | '', overrideReason: string, reason: string, reset?: boolean) => Promise<void>;
  onCancel: () => void;
}) {
  const initialEvidence = variant.acmgEvidence ?? variant.automaticAcmg?.criteria ?? [];
  const [evidence, setEvidence] = React.useState<Record<string, ACMGEvidenceEntry>>(() => Object.fromEntries(initialEvidence.map(item => [item.code, item])));
  const [override, setOverride] = React.useState<ACMGClassification | ''>(variant.acmgOverride ?? '');
  const [overrideReason, setOverrideReason] = React.useState(variant.acmgOverrideReason ?? '');
  const [reason, setReason] = React.useState('');
  const [restoreAutomatic, setRestoreAutomatic] = React.useState(false);
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

  const toggle = (code: string, checked: boolean) => { setRestoreAutomatic(false); setEvidence(previous => {
    const next = { ...previous };
    if (!checked) delete next[code];
    else {
      if (code === 'PP3') delete next.BP4;
      if (code === 'BP4') delete next.PP3;
      const strength = code === 'BA1' ? 'standalone' : (code === 'PVS1' ? 'very_strong' : code.startsWith('P') && code.slice(0, 2) === 'PS' || code.startsWith('B') && code.slice(0, 2) === 'BS' ? 'strong' : code.startsWith('PM') ? 'moderate' : 'supporting');
      next[code] = { code, strength, source: code === 'PP3' || code === 'BP4' ? 'AlphaMissense' : '人工证据' };
    }
    return next;
  }); };

  const save = async () => {
    if (override && !overrideReason.trim()) { setError('人工覆写分类必须填写理由'); return; }
    if (changed && !reason.trim()) { setError('请填写本次调整理由'); return; }
    setSaving(true); setError('');
    try {
      await onSave(Object.values(evidence), override, overrideReason.trim(), reason.trim(), restoreAutomatic);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存 ACMG 证据失败');
    } finally {
      setSaving(false);
    }
  };

  return <div className="space-y-4">
    <div className="rounded-lg border border-accent-subtle bg-accent-subtle/30 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">自动初评 · {auto?.profile ?? 'acmg-snv-points-v2'}</span><span>自动分类：{auto?.classification ? ACMG_CONFIG[auto.classification]?.label : '证据不足'} · {auto?.score ?? 0} 分</span></div>
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
            {item && code !== 'BA1' && <select value={item.strength} onChange={event => { setRestoreAutomatic(false); setEvidence(previous => ({ ...previous, [code]: { ...previous[code], strength: event.target.value as ACMGEvidenceEntry['strength'] } })); }} aria-label={`${code} 强度`} className="min-w-0 flex-1 rounded border border-border-default bg-canvas-default px-1.5 py-1 text-xs">
              {(code === 'PVS1' ? [['very_strong', '非常强']]:[['supporting','支持'],['moderate','中等'],['strong','强'],...(code.startsWith('P') ? [['very_strong','非常强']] : [])]).map(([value, label]) => <option key={value} value={value}>{label}（{POINTS[value]} 分）</option>)}
            </select>}
            {item && code === 'BA1' && <span className="text-xs text-success-fg">独立良性证据</span>}
          </div>;
        })}
      </div>
    </section>)}
    <div className="rounded-lg border border-border-subtle bg-canvas-default p-3 text-sm"><div className="flex justify-between"><span>证据积分</span><strong>{score}</strong></div><div className="mt-1 flex justify-between"><span>积分分类</span><strong>{calculated ? ACMG_CONFIG[calculated].label : '证据不足'}</strong></div></div>
    <div><label className="mb-1 block text-sm font-medium">人工覆写最终分类</label><select value={override} onChange={event => { setRestoreAutomatic(false); setOverride(event.target.value as ACMGClassification | ''); }} className="w-full rounded-md border border-border-default bg-canvas-default px-3 py-2 text-sm"><option value="">按证据积分显示</option>{Object.entries(ACMG_CONFIG).map(([key, config]) => <option key={key} value={key}>{config.label}</option>)}</select></div>
    {override && <textarea value={overrideReason} onChange={event => setOverrideReason(event.target.value)} placeholder="人工覆写理由（必填）" className="min-h-16 w-full rounded-md border border-border-default bg-canvas-default p-2 text-sm" />}
    <textarea value={reason} onChange={event => setReason(event.target.value)} placeholder={changed ? '本次证据调整理由（必填）' : '调整理由（如有）'} className="min-h-16 w-full rounded-md border border-border-default bg-canvas-default p-2 text-sm" />
    {error && <p role="alert" className="text-sm text-danger-fg">{error}</p>}
    <button type="button" disabled={saving} onClick={() => { setEvidence(Object.fromEntries((auto?.criteria ?? []).map(item => [item.code, item]))); setOverride(''); setOverrideReason(''); setReason('恢复当前版本自动初评基线'); setRestoreAutomatic(true); }} className="rounded-md border border-border-default px-3 py-2 text-sm">恢复自动基线后保存</button>
    <div className="flex gap-2"><button type="button" disabled={saving} onClick={() => void save()} className="flex flex-1 items-center justify-center gap-1 rounded-md bg-accent-emphasis px-3 py-2 text-sm text-fg-on-emphasis disabled:opacity-50"><Check className="h-4 w-4" />{saving ? '保存中…' : '保存证据与分类'}</button><button type="button" onClick={onCancel} className="rounded-md border border-border px-3 py-2 text-sm">取消</button></div>
  </div>;
}

export function VariantDetailPanel({ taskId, referenceGenome, variant, isOpen, onClose, onUpdateClassification, onSaveInterpretation }: VariantDetailPanelProps) {
  const [section, setSection] = React.useState<InspectorSection>('annotation');
  const selectedRef = React.useRef(variant?.id); selectedRef.current = variant?.id;
  const [isEditingACMG, setIsEditingACMG] = React.useState(false);
  const [localClassification, setLocalClassification] = React.useState<ACMGClassification | null>(null);
  const [localCriteria, setLocalCriteria] = React.useState<string[] | null>(null);
  const [interpretation, setInterpretation] = React.useState('');
  const [interpretationReason, setInterpretationReason] = React.useState('');
  const [interpretationSaving, setInterpretationSaving] = React.useState(false);
  const [interpretationError, setInterpretationError] = React.useState('');
  const [adjustmentHistory, setAdjustmentHistory] = React.useState<ResultRowAdjustmentEvent[]>([]);
  const readOnly = useInterpretationReadOnly();
  const canEditACMG = !readOnly && Boolean(onUpdateClassification);
  React.useEffect(() => { if (readOnly) setIsEditingACMG(false); }, [readOnly]);

  // 当 variant 变化时重置编辑状态
  React.useEffect(() => {
    setSection('annotation');
    setIsEditingACMG(false);
    setLocalClassification(null);
    setLocalCriteria(null);
    setInterpretation(variant?.interpretation ?? '');
    setInterpretationReason('');
    setInterpretationError('');
    setInterpretationSaving(false);
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
  const vaf = optionalAnnotationNumber(sourceAnnotation(variant, 'VAF'));

  // 保存 ACMG 分类
  const handleSaveACMG = async (evidence: ACMGEvidenceEntry[], override: ACMGClassification | '', overrideReason: string, reason: string, reset = false) => {
    if (!onUpdateClassification) return;
    await onUpdateClassification(variant, evidence, override, overrideReason, reason, reset);
    if (selectedRef.current !== variant.id) return;
    try {
      const history = await getResultRowAdjustmentHistory(taskId, 'snv-indel', variant.id);
      if (selectedRef.current !== variant.id) return;
      setAdjustmentHistory(history);
    } catch {
      // The saved assessment remains successful even if history refresh is unavailable.
    }
    const score = evidence.reduce((total, item) => total + (item.code === 'BA1' ? 0 : (item.code.startsWith('B') ? -1 : 1) * (POINTS[item.strength] ?? 0)), 0);
    setLocalClassification(override || (evidence.some(item => item.code === 'BA1') ? 'Benign' : classifyPoints(score, evidence.length)) || null);
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
      if (selectedRef.current !== variant.id) return;
      setInterpretationReason('');
      const history = await getResultRowAdjustmentHistory(taskId, 'snv-indel', variant.id);
      if (selectedRef.current === variant.id) setAdjustmentHistory(history);
    } catch (cause) {
      if (selectedRef.current === variant.id) setInterpretationError(cause instanceof Error ? cause.message : '保存人工解读失败');
    } finally {
      if (selectedRef.current === variant.id) setInterpretationSaving(false);
    }
  };

  return (
    <>
      <WorkspaceInspector label="变异详情" onClose={onClose}>
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

        <div className="yj-inspector-summary">
          <strong className="text-fg-default">{variant.gene || '未提供基因'}</strong> · {variant.chromosome}:{variant.position}<br />
          {variant.ref} → {variant.alt} · 自动初评 {variant.automaticAcmg?.score ?? '—'} 分
          {!acmgConfig && <p className="mt-1 text-warning-fg">证据不足，当前无法形成 ACMG 分类</p>}
        </div>
        {/* 内容区域 */}
        <InspectorTabs id="variant-inspector" value={section} onChange={setSection} sections={['annotation', 'evidence', 'assessment', 'history']} />
        <div id="variant-inspector-content" role="tabpanel" aria-labelledby={`variant-inspector-${section}`} className="yj-inspector-content">
          <section hidden={section !== 'assessment'} >
          {/* 人工解读 */}
          <SectionTitle icon={MessageSquare} title="人工解读" />
          <div className="space-y-0">
            <textarea
              readOnly={readOnly}
              value={interpretation}
              onChange={(e) => setInterpretation(e.target.value)}
              placeholder="请输入您对该变异的解读分析..."
              className="w-full min-h-[90px] px-3 py-2 text-sm border border-border-default rounded-md bg-canvas-default text-fg-default resize-y focus:outline-none focus:ring-2 focus:ring-accent-emphasis focus:border-transparent"
            />
            <div className="mt-2 space-y-2">
              <input readOnly={readOnly} value={interpretationReason} onChange={event => setInterpretationReason(event.target.value)} placeholder="本次调整理由（保存时必填）" className="h-9 w-full rounded-md border border-border-default bg-canvas-default px-2 text-sm" />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-fg-muted">{interpretation.length} 字</span>
                <button type="button" disabled={readOnly || interpretationSaving || interpretation === (variant.interpretation ?? '')} onClick={() => void handleSaveInterpretation()} className="rounded-md bg-accent-emphasis px-3 py-1.5 text-sm text-fg-on-emphasis disabled:opacity-50">{interpretationSaving ? '保存中…' : '保存人工解读'}</button>
              </div>
              {interpretationError && <p role="alert" className="text-sm text-danger-fg">{interpretationError}</p>}
            </div>
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
          <div className="space-y-0">
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

          </section>
          <section hidden={section !== 'evidence'} >
          {/* 测序质量 */}
          <SectionTitle icon={FileText} title="测序质量" />
          <div className="space-y-0">
            <InfoItem label="VAF" value={vaf === undefined || vaf < 0 || vaf > 1 ? '未提供' : `${(vaf * 100).toFixed(1)}%`} />
            <InfoItem label="QUAL" value={annotation('Quality') ?? '未提供'} />
            <InfoItem label="FILTER" value={annotation('Filter') ?? '未提供'} />
            <InfoItem label="DP（覆盖深度）" value={annotation('Depth') ?? '未提供'} />
            <InfoItem label="AD（等位基因深度）" value={annotation('AD') ?? '未提供'} />
            <InfoItem label="GQ（基因型质量）" value={annotation('GQ') ?? '未提供'} />
            <p className="mt-2 text-xs text-fg-muted">数值来自原始注释；QUAL 是位点质量，GQ 是基因型质量，不能相互替代。</p>
          </div>

          <SectionTitle icon={Database} title="ClinVar 注释" />
          <div className="space-y-0">
            <InfoItem label="临床意义" value={<ClinVarBadge value={annotation('ClinVar_Sig', variant.clinvarSignificance)} />} />
            <InfoItem label="审核状态" value={annotation('ClinVar_RevStat', variant.clinvarReviewStatus)} />
            <InfoItem label="审核星级" value={annotation('ClinVar_Star', variant.clinvarStars)} />
            <InfoItem label="关联疾病" value={annotation('ClinVar_DN', variant.clinvarDisease)} />
          </div>

          {/* 人群频率 */}
          <SectionTitle icon={Database} title="人群频率" />
          <div className="space-y-0">
            <InfoItem label="gnomAD 总体 AF" value={formatPopulationFrequency(annotation('GnomAD_AF', variant.gnomadAF))} />
            <InfoItem label="gnomAD 东亚 AF" value={formatPopulationFrequency(annotation('GnomAD_AF_EAS', variant.gnomadEasAF))} />
            <InfoItem label="VEP MAX_AF" value={formatPopulationFrequency(annotation('MAX_AF', variant.maxAF))} />
            <InfoItem label="gnomAD nhomalt XX" value={annotation('GnomAD_nhomalt_XX', variant.gnomadNhomaltXX)} />
            <InfoItem label="gnomAD nhomalt XY" value={annotation('GnomAD_nhomalt_XY', variant.gnomadNhomaltXY)} />
            <p className="mt-2 text-xs text-fg-muted">AF 为 0–1 的原始比值；nhomalt 为纯合变异计数。</p>
          </div>

          {/* 功能预测 */}
          <SectionTitle icon={Dna} title="功能预测" />
          <div className="space-y-0">
            <InfoItem label="Pangolin gain" value={annotation('Pangolin_Gain', variant.pangolinGain)} />
            <InfoItem label="Pangolin loss" value={annotation('Pangolin_Loss', variant.pangolinLoss)} />
            <InfoItem label="Pangolin 预测标签" value={annotation('Pangolin_AN', variant.pangolinAnnotation)} />
            <InfoItem label="EVOScore2" value={annotation('EVOScore', variant.evoScore)} />
            <InfoItem label="EVOScore2 预测标签" value={annotation('EVOScore_AN', variant.evoAnnotation)} />
            <InfoItem label="AlphaMissense 分数" value={annotation('AlphaMissense_AM', variant.alphaMissenseScore)} />
            <InfoItem label="AlphaMissense 预测标签" value={annotation('AlphaMissense_AMC', variant.alphaMissenseClass)} />
            <p className="mt-2 text-xs text-fg-muted">保留流程输出的多值与标签；功能预测标签不是 ACMG 分级。</p>
          </div>

          </section>
          <section hidden={section !== 'history'} >
          <SectionTitle icon={FileText} title="判读变更记录" />
          <div className="space-y-2">
            {adjustmentHistory.length === 0 ? <p className="text-sm text-fg-muted">暂无调整记录</p> : adjustmentHistory.map(event => <article key={event.id} className="rounded-md border border-border-subtle bg-canvas-default p-2.5">
              <div className="flex flex-wrap justify-between gap-1 text-xs text-fg-muted"><span>{event.actor || '用户'}</span><time>{event.createdAt ? new Date(event.createdAt).toLocaleString() : ''}</time></div>
              <p className="mt-1 text-sm text-fg-default">{event.reason || '未填写理由'}</p>
              {adjustmentDiff(event.before, event.after).map(change => <p key={change.key} className="mt-1 break-words text-xs text-fg-muted"><span className="font-medium">{change.key}：</span>{change.before} → {change.after}</p>)}
            </article>)}
          </div>

          </section>
          <section hidden={section !== 'annotation'} className="yj-annotation-layout">
            <section aria-labelledby="gencc-heading">
              <h4 id="gencc-heading" className="yj-annotation-heading">GenCC · 基因与疾病关联</h4>
              <dl className="yj-annotation-fields">
                <AnnotationField label="疾病关联" value={annotation('GenCC_disease_title', variant.diseaseAssociation)} />
                <AnnotationField label="遗传模式" value={annotation('GenCC_moi_title') || ({ AD: '常染色体显性', AR: '常染色体隐性', XL: 'X 连锁', XLD: 'X 连锁显性', XLR: 'X 连锁隐性' }[variant.inheritanceMode || '']) || annotation('GenCC_moi_curie', variant.inheritanceMode)} />
                <AnnotationField label="遗传模式标识" value={annotation('GenCC_moi_curie', variant.inheritanceMode)} />
                <AnnotationField label="疾病标识" value={annotation('GenCC_disease_original_curie')} />
              </dl>
            </section>
            {(variant.rsId || annotation('HGNC_ID') || annotation('Cytoband')) && <section aria-labelledby="variant-ids-heading">
              <h4 id="variant-ids-heading" className="yj-annotation-heading">变异标识</h4>
              {variant.rsId && <InfoItem label="dbSNP" value={variant.rsId} />}
              {annotation('HGNC_ID') && <InfoItem label="HGNC ID" value={annotation('HGNC_ID')} />}
              {annotation('Cytoband') && <InfoItem label="染色体带区" value={annotation('Cytoband')} />}
            </section>}
            <section aria-labelledby="variant-links-heading">
              <h4 id="variant-links-heading" className="yj-annotation-heading">数据库与判读资源</h4>
              <VariantResourceLinks variant={variant} referenceGenome={referenceGenome} />
            </section>
          </section>
        </div>

      </WorkspaceInspector>
    </>
  );
}
