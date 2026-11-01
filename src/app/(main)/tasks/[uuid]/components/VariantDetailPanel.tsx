'use client';
import { readSNVSample } from '@/lib/snv-sample-metrics';
import { formatSampleVaf, sampleZygosityLabel } from './SNVSampleColumns';
import { errorText } from '@/i18n/errors';
import { useText } from '@/i18n/useText';
import { resultHistoryReason } from '@/i18n/result-history';
import { chineseText, translateUI, type TextTranslator } from '@/i18n/text';
import { ActionButton, IconActionButton } from '@/components/shared/ActionButton';
import { useInterpretationReadOnly } from './InterpretationLock';
import * as React from 'react';
import { WorkspaceInspector, InspectorTabs, type InspectorSection } from '@/components/shared/WorkspaceInspector';
import { VariantResourceLinks } from './VariantResourceLinks';
import { dbSnpIdentifiers } from '../utils/variant-resource-links';
import { ClinVarBadge } from './ClinVarBadge';
import { ClinicalSignificanceBadge } from './ClinicalSignificanceBadge';
import { PhenotypeSummary, AnnotationScreeningNotes } from './PhenotypeSummary';
import { ExternalLink, FileText, Database, Dna, MessageSquare, Sparkles, Calculator } from 'lucide-react';
import { Tag } from '@/components/shared/Tag';
import type { SNVIndel, ACMGEvidenceEntry, ACMGClassification } from '../types';
import { ACMG_CONFIG } from '../result-api';
import { clinvarReviewStars, formatPopulationFrequency, formatPredictionLabel, sourceAnnotation, transcriptLocation } from '../utils/snv-annotations';
import { getResultRowAdjustmentHistory, type ResultRowAdjustmentEvent } from '../result-api';
import { AIAssistanceAction, AIResultCard } from '@/components/shared/AIAssistanceAction';
import type { AIAssistanceResult } from '@/lib/ai-assistance';
import { aiVariantContext } from '../utils/ai-context';
import { VariantAssessmentOverview, type AdoptedSource } from './VariantAssessmentOverview';

interface VariantDetailPanelProps {
  taskId: string;
  referenceGenome?: string;
  variant: SNVIndel | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateClassification?: (variant: SNVIndel, evidence: ACMGEvidenceEntry[], override: ACMGClassification | '', overrideReason: string, reason: string, reset?: boolean) => Promise<void>;
  onSaveInterpretation?: (variant: SNVIndel, interpretation: string, reason: string) => Promise<void>;
  onSaveVersionedAssessment?: (variant: SNVIndel, adjustments: Record<string, unknown>, reason: string) => Promise<void>;
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
  const t = useText();
  return <div><dt className="text-xs text-fg-muted">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-fg-default">{value && !['.', '-'].includes(value) ? value : t("history.notProvided071fb2")}</dd></div>;
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

function adjustmentDiff(beforeJSON: Record<string, unknown> | string, afterJSON: Record<string, unknown> | string, t: TextTranslator = chineseText): Array<{ key: string; before: string; after: string }> {
  try {
    const before = (typeof beforeJSON === 'string' ? JSON.parse(beforeJSON || '{}') : beforeJSON) as Record<string, unknown>;
    const after = (typeof afterJSON === 'string' ? JSON.parse(afterJSON || '{}') : afterJSON) as Record<string, unknown>;
    return [...new Set([...Object.keys(before), ...Object.keys(after)])]
      .filter(key => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
      .map(key => ({
        key,
        before: before[key] === undefined ? t("tasks.notSet55a04b") : JSON.stringify(before[key]),
        after: after[key] === undefined ? t("tasks.notSet55a04b") : JSON.stringify(after[key]),
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
  onSave: (evidence: ACMGEvidenceEntry[], override: ACMGClassification | '', overrideReason: string, reason: string, reset?: boolean, adopt?: boolean) => Promise<void>;
  onCancel?: () => void;
}) {
  const t = useText();
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
  const auto = variant.automaticAcmg;
  const suggested = React.useMemo(() => {
    const list: Array<{ code: string; label: string; source: string }> = [];
    for (const item of auto?.criteria ?? []) {
      if (!evidence[item.code]) list.push({ code: item.code, label: `${item.code} (算法推荐)`, source: 'auto' });
    }
    return list;
  }, [auto, evidence]);

  const toggle = (code: string, checked: boolean) => {
    setRestoreAutomatic(false);
    setEvidence(previous => {
      const next = { ...previous };
      if (!checked) delete next[code];
      else {
        if (code === 'PP3') delete next.BP4;
        if (code === 'BP4') delete next.PP3;
        const strength = code === 'BA1' ? 'standalone' : (code === 'PVS1' ? 'very_strong' : code.startsWith('P') && code.slice(0, 2) === 'PS' || code.startsWith('B') && code.slice(0, 2) === 'BS' ? 'strong' : code.startsWith('PM') ? 'moderate' : 'supporting');
        next[code] = { code, strength, source: t("tasks.manualEvidencea288d3") };
      }
      return next;
    });
  };

  const save = async (adopt = true) => {
    setSaving(true);
    setError('');
    try {
      await onSave(Object.values(evidence), override, overrideReason.trim(), reason.trim(), restoreAutomatic, adopt);
    } catch (cause) {
      setError(cause instanceof Error ? errorText(cause, t) : t("tasks.unableToSaveAcmgEvidencedb2f9e"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-accent-subtle bg-accent-subtle/30 p-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold">{t("tasks.automaticAssessmentc4ff36")}{auto?.profile ?? 'acmg-snv-points-v2'}</span>
          <span>{t("tasks.automaticClassification8daa4b")}{auto?.classification ? ACMG_CONFIG[auto.classification]?.label : t("tasks.insufficientEvidence70568c")} · {auto?.score ?? 0} {t("tasks.pointsdecb3b")}</span>
        </div>
        {auto?.pending?.length ? (
          <p className="mt-1 text-xs text-fg-muted">{t("tasks.unconfirmed7c7684")}{auto.pending.join('；')}</p>
        ) : (
          <p className="mt-1 text-xs text-fg-muted">{t("tasks.populationDiseaseMechanismFamilyAndLaboratoryEvidencebc757f")}</p>
        )}
      </div>

      {suggested.length > 0 && (
        <div className="rounded-lg border border-accent-subtle bg-accent-subtle/15 p-2.5">
          <span className="text-xs font-semibold text-accent-fg">💡 算法初评推荐（点击快速采纳）：</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {suggested.map(s => (
              <button
                key={s.code}
                type="button"
                onClick={() => toggle(s.code, true)}
                className="inline-flex items-center gap-1 rounded border border-accent-emphasis/30 bg-canvas-default px-2 py-0.5 text-xs text-accent-fg hover:bg-accent-subtle transition-colors shadow-xs"
              >
                <span className="font-bold">+</span>
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {Object.keys(evidence).length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-canvas-subtle p-2 text-xs">
          <span className="text-fg-muted">已激活 <strong>{Object.keys(evidence).length}</strong> 项证据条款</span>
          <div className="flex flex-wrap gap-1">
            {Object.keys(evidence).map(c => (
              <span key={c} className={`rounded px-1.5 py-0.5 font-semibold text-xs ${c.startsWith('B') ? 'bg-success-subtle text-success-fg' : 'bg-danger-subtle text-danger-fg'}`}>
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {POINT_CRITERIA.map(group => (
        <section key={group.title} className="space-y-2">
          <h5 className="text-sm font-semibold text-fg-default">{translateUI(group.title, t)}</h5>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {group.items.map(code => {
              const item = evidence[code];
              return (
                <div key={code} className={`flex min-w-0 flex-wrap items-center gap-2 rounded-md border p-2 ${item ? (code.startsWith('B') ? 'border-success-emphasis/40 bg-success-subtle/30' : 'border-danger-emphasis/40 bg-danger-subtle/30') : 'border-border-subtle bg-canvas-default'}`}>
                  <input type="checkbox" checked={Boolean(item)} onChange={event => toggle(code, event.target.checked)} aria-label={t("tasks.selectAcmgEvidencef17a92", {p0: String(code)})} />
                  <span className="w-12 shrink-0 text-xs font-semibold">{code}</span>
                  {item && code !== 'BA1' && (
                    <select
                      value={item.strength}
                      onChange={event => {
                        setRestoreAutomatic(false);
                        setEvidence(previous => ({ ...previous, [code]: { ...previous[code], strength: event.target.value as ACMGEvidenceEntry['strength'] } }));
                      }}
                      aria-label={t("tasks.strengthc0b275", {p0: String(code)})}
                      className="min-w-0 flex-1 rounded border border-border-default bg-canvas-default px-1.5 py-1 text-xs"
                    >
                      {([['supporting',t("tasks.supportinga9aab1")],['moderate',t("tasks.moderate839de2")],['strong',t("tasks.strong275680")],...(code.startsWith('P') ? [['very_strong',t("tasks.veryStrong103c20")]] : [])]).map(([value, label]) => (
                        <option key={value} value={value}>{label}（{POINTS[value]} {t("tasks.points505d62")}</option>
                      ))}
                    </select>
                  )}
                  {item && code === 'BA1' && <span className="text-xs text-success-fg">{t("tasks.independentBenignEvidence8ecbad")}</span>}
                  {item && (
                    <label className="basis-full space-y-1 text-xs text-fg-muted">
                      <span>{t('variantAssessment.evidenceReason')} · {item.source}</span>
                      <textarea
                        aria-label={`${code} ${t('variantAssessment.evidenceReason')}`}
                        className="min-h-16 w-full rounded border border-border-default bg-canvas-default p-2 text-fg-default"
                        value={item.note ?? ''}
                        onChange={event => {
                          setRestoreAutomatic(false);
                          setEvidence(previous => ({ ...previous, [code]: { ...previous[code], note: event.target.value } }));
                        }}
                      />
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <div className="rounded-lg border border-border-subtle bg-canvas-default p-3 text-sm">
        <div className="flex justify-between"><span>{t("tasks.evidencePoints76bde1")}</span><strong>{score}</strong></div>
        <div className="mt-1 flex justify-between"><span>{t("tasks.pointBasedClassification845a04")}</span><strong>{calculated ? ACMG_CONFIG[calculated].label : t("tasks.insufficientEvidence70568c")}</strong></div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">{t("tasks.manualFinalClassificationOverridedb887b")}</label>
        <select
          value={override}
          onChange={event => { setRestoreAutomatic(false); setOverride(event.target.value as ACMGClassification | ''); }}
          className="w-full rounded-md border border-border-default bg-canvas-default px-3 py-2 text-sm"
        >
          <option value="">{t("tasks.showByEvidencePoints055e03")}</option>
          {Object.entries(ACMG_CONFIG).map(([key, config]) => <option key={key} value={key}>{translateUI(config.label, t)}</option>)}
        </select>
      </div>

      {override && (
        <textarea
          value={overrideReason}
          onChange={event => setOverrideReason(event.target.value)}
          placeholder={t("tasks.overrideReasonOptional")}
          className="min-h-16 w-full rounded-md border border-border-default bg-canvas-default p-2 text-sm"
        />
      )}

      <textarea
        value={reason}
        onChange={event => setReason(event.target.value)}
        placeholder={t("tasks.evidenceChangeReasonOptional")}
        className="min-h-16 w-full rounded-md border border-border-default bg-canvas-default p-2 text-sm"
      />

      {error && <p role="alert" className="text-sm text-danger-fg">{error}</p>}

      <ActionButton
        action="save"
        variant="ghost"
        type="button"
        disabled={saving}
        onClick={() => {
          setEvidence(Object.fromEntries((auto?.criteria ?? []).map(item => [item.code, item])));
          setOverride('');
          setOverrideReason('');
          setReason(t("tasks.restoreCurrentAutomaticAssessmentBaselineffd9de"));
          setRestoreAutomatic(true);
        }}
        className="rounded-md border border-border-default px-3 py-2 text-sm"
      >
        {t('variantAssessment.restoreDraft')}
      </ActionButton>

      <div className="flex flex-wrap gap-2">
        <ActionButton loading={saving} loadingLabel={t("tasks.saving6644f0")} action="save" variant="primary" type="button" disabled={saving} onClick={() => void save(true)} className="flex-1">
          {t('variantAssessment.saveAdopt')}
        </ActionButton>
        <ActionButton action="save" variant="ghost" type="button" disabled={saving} onClick={() => void save(false)}>
          {t('variantAssessment.saveOnly')}
        </ActionButton>
        {onCancel && (
          <ActionButton variant="ghost" type="button" onClick={onCancel} className="rounded-md border border-border px-3 py-2 text-sm">
            {t("admin.cancel4d0b46")}
          </ActionButton>
        )}
      </div>
    </div>
  );
}

export function VariantDetailPanel({ taskId, referenceGenome, variant, isOpen, onClose, onUpdateClassification, onSaveInterpretation, onSaveVersionedAssessment }: VariantDetailPanelProps) {
  const t = useText();
  const [section, setSection] = React.useState<InspectorSection>('overview');
  const [aiResult, setAIResult] = React.useState<AIAssistanceResult>();
  const [aiError, setAIError] = React.useState('');
  const selectedRef = React.useRef(variant?.id);
  selectedRef.current = variant?.id;
  const [localClassification, setLocalClassification] = React.useState<ACMGClassification | null>(null);
  const [localCriteria, setLocalCriteria] = React.useState<string[] | null>(null);
  const [localEvidence, setLocalEvidence] = React.useState<ACMGEvidenceEntry[] | null>(null);
  const [localSource, setLocalSource] = React.useState<SNVIndel['acmgAssessmentSource']>();
  const [localAdoptedACMG, setLocalAdoptedACMG] = React.useState<SNVIndel['adoptedACMG'] | null>(null);
  const [interpretation, setInterpretation] = React.useState('');
  const [versionBusy, setVersionBusy] = React.useState(false);
  const [interpretationSaving, setInterpretationSaving] = React.useState(false);
  const [interpretationError, setInterpretationError] = React.useState('');
  const [adjustmentHistory, setAdjustmentHistory] = React.useState<ResultRowAdjustmentEvent[]>([]);
  const readOnly = useInterpretationReadOnly();

  // 当 variant 变化时重置状态
  React.useEffect(() => {
    setSection('overview');
    setAIError('');
    setAIResult(typeof variant?.acmgAIResult === 'object' && variant.acmgAIResult !== null ? variant.acmgAIResult : undefined);
    setLocalClassification(null);
    setLocalCriteria(null);
    setLocalEvidence(null);
    setLocalSource(undefined);
    setLocalAdoptedACMG(null);
    setInterpretation(variant?.interpretation ?? '');
    setVersionBusy(false);
    setInterpretationError('');
    setInterpretationSaving(false);
  }, [taskId, variant?.id]);

  React.useEffect(() => {
    if (!variant) { setAdjustmentHistory([]); return; }
    const controller = new AbortController();
    void getResultRowAdjustmentHistory(taskId, 'snv-indel', variant.id, controller.signal)
      .then(setAdjustmentHistory)
      .catch(() => { if (!controller.signal.aborted) setAdjustmentHistory([]); });
    return () => controller.abort();
  }, [taskId, variant?.id]);

  if (!isOpen || !variant) return null;

  const effectiveAdopted = localAdoptedACMG ?? variant.adoptedACMG;
  const currentClassification = localClassification ?? variant.legacyAcmgClassification ?? variant.acmgClassification;
  const currentCriteria = localCriteria ?? variant.acmgCriteria ?? [];
  const currentEvidence = localEvidence ?? variant.acmgEvidence ?? variant.automaticAcmg?.criteria ?? [];
  const assessmentSource = localSource ?? variant.acmgAssessmentSource ?? 'automatic';
  const currentScore = assessmentSource === 'automatic' ? variant.automaticAcmg?.score : currentEvidence.reduce((sum, item) => sum + (item.code === 'BA1' ? 0 : (item.code.startsWith('B') ? -1 : 1) * (POINTS[item.strength] ?? 0)), 0);
  const activeClassification = effectiveAdopted?.classification ?? (
    effectiveAdopted ? variant.acmgClassification :
    (currentClassification ?? variant.automaticAcmg?.classification)
  );
  const activeConfig = activeClassification ? ACMG_CONFIG[activeClassification] : undefined;

  const saveVersioned = async (adjustments: Record<string, unknown>, reason: string) => {
    if (!onSaveVersionedAssessment) return;
    await onSaveVersionedAssessment(variant, adjustments, reason);
    if (selectedRef.current === variant.id) {
      try {
        const history = await getResultRowAdjustmentHistory(taskId, 'snv-indel', variant.id);
        if (selectedRef.current === variant.id) setAdjustmentHistory(history);
      } catch {
        /* Saved data remains successful if history refresh fails. */
      }
    }
  };

  const handleAIResult = async (result: AIAssistanceResult) => {
    setAIResult(result);
    setAIError('');
    if (onSaveVersionedAssessment) {
      setVersionBusy(true);
      try {
        await saveVersioned({ acmgAIResult: result }, 'AI评估自动保存');
      } catch (e) {
        setAIError(e instanceof Error ? errorText(e, t) : '保存AI评估失败');
      } finally {
        setVersionBusy(false);
      }
    }
  };

  const handleAdoptSource = async (source: AdoptedSource, classification?: string | null) => {
    if (readOnly) return;
    const targetClass = (classification && !['缺失', '尚未评定', '尚未进行 AI 评估', '证据不足，待补充'].includes(classification))
      ? classification as ACMGClassification
      : undefined;

    const adoptedData: NonNullable<SNVIndel['adoptedACMG']> = {
      version: 'legacy',
      source,
      classification: targetClass,
      savedAt: new Date().toISOString(),
    };

    setLocalAdoptedACMG(adoptedData);

    if (onSaveVersionedAssessment) {
      const labelMap: Record<AdoptedSource, string> = {
        database: '数据库参考',
        quick: '本地快速初评',
        ai: 'AI证据建议',
        manual: '人工评估',
      };
      await saveVersioned({ adoptedACMG: adoptedData }, `采用${labelMap[source]}结果`);
    }
  };

  const annotation = (column: string, fallback?: string | number) => sourceAnnotation(variant, column, fallback);
  const dbSnpIds = dbSnpIdentifiers(variant);
  const proband = variant.proband ?? readSNVSample({...variant, ...variant.annotationValues});
  const transcriptInfo = transcriptLocation(variant);

  // 保存 ACMG 分类
  const handleSaveACMG = async (evidence: ACMGEvidenceEntry[], override: ACMGClassification | '', overrideReason: string, reason: string, reset = false, adopt = true) => {
    const score = evidence.reduce((total, item) => total + (item.code === 'BA1' ? 0 : (item.code.startsWith('B') ? -1 : 1) * (POINTS[item.strength] ?? 0)), 0);
    const calculated = override || (evidence.some(item => item.code === 'BA1') ? 'Benign' : classifyPoints(score, evidence.length)) || null;

    if (onSaveVersionedAssessment) {
      const changes: Record<string, unknown> = {
        acmgEvidence: evidence,
        acmgOverride: override,
        acmgOverrideReason: overrideReason,
        resetAcmg: reset,
        acmgSavedAt: new Date().toISOString(),
      };
      if (adopt) {
        changes.activeAcmgVersion = 'legacy';
        const adoptedData: NonNullable<SNVIndel['adoptedACMG']> = {
          version: 'legacy',
          source: 'manual',
          classification: calculated ?? undefined,
          score,
          savedAt: new Date().toISOString(),
        };
        changes.adoptedACMG = adoptedData;
        setLocalAdoptedACMG(adoptedData);
      }
      await saveVersioned(changes, reason);
    } else if (onUpdateClassification) await onUpdateClassification(variant, evidence, override, overrideReason, reason, reset);
    else return;
    if (selectedRef.current !== variant.id) return;
    try {
      const history = await getResultRowAdjustmentHistory(taskId, 'snv-indel', variant.id);
      if (selectedRef.current !== variant.id) return;
      setAdjustmentHistory(history);
    } catch {
      // The saved assessment remains successful even if history refresh is unavailable.
    }
    setLocalClassification(calculated);
    setLocalCriteria(evidence.map(item => item.code));
    setLocalEvidence(evidence);
    setLocalSource(reset ? 'automatic' : override ? 'manual_override' : 'manual_evidence');
  };

  const handleSaveInterpretation = async () => {
    if (!variant || !onSaveInterpretation || interpretationSaving) return;
    if (interpretation === (variant.interpretation ?? '')) return;
    setInterpretationSaving(true);
    setInterpretationError('');
    try {
      await onSaveInterpretation(variant, interpretation, '');
      if (selectedRef.current !== variant.id) return;
      try {
        const history = await getResultRowAdjustmentHistory(taskId, 'snv-indel', variant.id);
        if (selectedRef.current === variant.id) setAdjustmentHistory(history);
      } catch {
        /* Saving succeeded even if history refresh is unavailable. */
      }
    } catch (cause) {
      if (selectedRef.current === variant.id) setInterpretationError(cause instanceof Error ? errorText(cause, t) : t("tasks.unableToSaveInterpretation3f40ed"));
    } finally {
      if (selectedRef.current === variant.id) setInterpretationSaving(false);
    }
  };

  return (
    <>
      <WorkspaceInspector label={t("tasks.variantDetails7ca440")} onClose={onClose}>
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-canvas-subtle">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-medium text-fg-default">{t("tasks.variantDetails7ca440")}</h3>
            {activeConfig ? (
              <ClinicalSignificanceBadge value={activeClassification ?? undefined}>
                {activeConfig.label}
              </ClinicalSignificanceBadge>
            ) : (
              <Tag variant="neutral">{t("tasks.acmgNotAssessed1ea79b")}</Tag>
            )}
          </div>
          <IconActionButton
            label={t("tasks.close6c14bd")}
            action="close"
            variant="ghost"
            onClick={onClose}
            className="p-1.5 text-fg-muted hover:text-fg-default hover:bg-canvas-inset rounded transition-colors"
          />
        </div>

        <div className="yj-inspector-summary">
          <strong className="text-fg-default">{variant.gene || t("tasks.geneNotProvidedac7186")}</strong> · {variant.chromosome}:{variant.position}<br />
          {variant.ref} → {variant.alt} · {variant.automaticAcmg?.classificationBasis && variant.automaticAcmg.classificationBasis !== 'acmg_evidence' ? t("tasks.quickAssessmentAwaitingManualReview573655") : t("tasks.automaticAssessmentPointsce3c65", {p0: String(variant.automaticAcmg?.score ?? '—')})}
          {!activeConfig && <p className="mt-1 text-warning-fg">{t("tasks.insufficientEvidenceForAcmgClassification822f20")}</p>}
        </div>

        {/* 内容区域 */}
        <InspectorTabs
          id="variant-inspector"
          value={section}
          onChange={setSection}
          sections={['overview', 'annotation', 'evidence', 'ai', 'acmg', 'interpretation', 'history']}
          labels={{ overview: t('variantAssessment.overview'), ai: 'AI评估' }}
        />

        <div id="variant-inspector-content" role="tabpanel" aria-labelledby={`variant-inspector-${section}`} className="yj-inspector-content">
          {/* 1. 总览 */}
          <section hidden={section !== 'overview'}>
            <VariantAssessmentOverview
              variant={{
                ...variant,
                adoptedACMG: effectiveAdopted,
                acmgClassification: localClassification ?? variant.acmgClassification,
                acmgEvidence: localEvidence ?? variant.acmgEvidence,
                acmgAssessmentSource: localSource ?? variant.acmgAssessmentSource,
              }}
              ai={aiResult}
              aiError={aiError}
              onCalculator={() => setSection('acmg')}
              onAIEvaluation={() => setSection('ai')}
              onAdoptSource={handleAdoptSource}
            />
          </section>

          {/* 2. 注释 */}
          <section hidden={section !== 'annotation'} className="yj-annotation-layout">
            <section aria-labelledby="transcript-heading">
              <h4 id="transcript-heading" className="yj-annotation-heading">{t("tasks.transcriptAndHgvsee0106")}</h4>
              <dl className="yj-annotation-fields">
                <AnnotationField label={t("tasks.transcriptIdd6daab")} value={annotation('Transcript', variant.transcript)} />
                <AnnotationField label={t("tasks.exonNumber43bc13")} value={transcriptInfo.exonNumber} />
                <AnnotationField label={t("tasks.intronNumber44f9c7")} value={transcriptInfo.intronNumber} />
                <AnnotationField label={t("tasks.totalExons0e3eaf")} value={transcriptInfo.exonTotal ? `${transcriptInfo.exonTotal}${transcriptInfo.exonTotalDerived ? t("tasks.inferredFromIntronCount67556c") : ''}` : undefined} />
                <AnnotationField label={t("tasks.totalIntrons1db3b5")} value={transcriptInfo.intronTotal ? `${transcriptInfo.intronTotal}${transcriptInfo.intronTotalDerived ? t("tasks.inferredFromExonCount252265") : ''}` : undefined} />
                <AnnotationField label={t("tasks.originalPositionAnnotationae0a50")} value={transcriptInfo.location} />
                <AnnotationField label="HGVSc" value={annotation('HGVS_c', variant.hgvsc)} />
                <AnnotationField label="HGVSp" value={annotation('HGVS_p', variant.hgvsp)} />
                <AnnotationField label={t("history.variantConsequence95666e")} value={variant.consequence} />
              </dl>
            </section>
            <section aria-labelledby="gencc-heading">
              <h4 id="gencc-heading" className="yj-annotation-heading">{t("tasks.genccGeneDiseaseAssociation85a5a5")}</h4>
              <dl className="yj-annotation-fields">
                <AnnotationField label={t("tasks.diseaseAssociation8e7820")} value={annotation('GenCC_disease_title', variant.diseaseAssociation)} />
                <AnnotationField label={t("tasks.inheritancePattern5de3fe")} value={annotation('GenCC_moi_title') || ({ AD: t("tasks.autosomalDominant1594de"), AR: t("tasks.autosomalRecessive8973b8"), XL: t("tasks.xLinked48ce00"), XLD: t("tasks.xLinkedDominantbea7f6"), XLR: t("tasks.xLinkedRecessivec385b8") }[variant.inheritanceMode || '']) || annotation('GenCC_moi_curie', variant.inheritanceMode)} />
                <AnnotationField label={t("tasks.inheritanceIdentifiere42271")} value={annotation('GenCC_moi_curie', variant.inheritanceMode)} />
                <AnnotationField label={t("tasks.diseaseIdentifier3697b1")} value={annotation('GenCC_disease_original_curie')} />
              </dl>
            </section>
            {(dbSnpIds.length > 0 || variant.rsId || annotation('HGNC_ID') || annotation('Cytoband')) && (
              <section aria-labelledby="variant-ids-heading">
                <h4 id="variant-ids-heading" className="yj-annotation-heading">{t("tasks.variantIdentifiera3a10c")}</h4>
                {(dbSnpIds.length > 0 || variant.rsId) && <InfoItem label="dbSNP" value={dbSnpIds.length ? <span className="inline-flex flex-wrap gap-x-2 gap-y-1">{dbSnpIds.map(id => <a key={id} href={`https://www.ncbi.nlm.nih.gov/snp/${id}`} target="_blank" rel="noopener noreferrer" className="text-accent-fg hover:underline">{id}</a>)}</span> : variant.rsId} />}
                {annotation('HGNC_ID') && <InfoItem label="HGNC ID" value={annotation('HGNC_ID')} />}
                {annotation('Cytoband') && <InfoItem label={t("tasks.cytobandc12b02")} value={annotation('Cytoband')} />}
              </section>
            )}
            <section aria-labelledby="variant-links-heading">
              <h4 id="variant-links-heading" className="yj-annotation-heading">{t("tasks.databasesAndInterpretationResources02d5cc")}</h4>
              <VariantResourceLinks variant={variant} referenceGenome={referenceGenome} />
            </section>
          </section>

          {/* 3. 证据 */}
          <section hidden={section !== 'evidence'}>
            <SectionTitle icon={FileText} title={t("tasks.sequencingQuality74e3b6")} />
            <div className="space-y-0">
              <InfoItem label="VAF" value={formatSampleVaf(proband.alleleFrequency, t)} />
              {proband.vafSource==='ad' && <p className="text-xs text-fg-muted">{t('tasks.sampleVafFromAd',{p0:proband.alleleDepth ?? '-'})}</p>}
              {(['father','mother'] as const).map(role => variant[role] && (
                <React.Fragment key={role}>
                  <InfoItem label={t('tasks.'+role+'Zygosity')} value={sampleZygosityLabel(variant[role]!.zygosity,t)} />
                  <InfoItem label={t('tasks.'+role+'Vaf')} value={formatSampleVaf(variant[role]!.alleleFrequency,t)} />
                </React.Fragment>
              ))}
              <InfoItem label="QUAL" value={annotation('Quality') ?? t("history.notProvided071fb2")} />
              <InfoItem label="FILTER" value={annotation('Filter') ?? t("history.notProvided071fb2")} />
              <InfoItem label={t("tasks.dpReadDepth438651")} value={annotation('Depth') ?? t("history.notProvided071fb2")} />
              <InfoItem label={t("tasks.adAlleleDepthd2d259")} value={annotation('AD') ?? t("history.notProvided071fb2")} />
              <InfoItem label={t("tasks.gqGenotypeQualitycc49b1")} value={annotation('GQ') ?? t("history.notProvided071fb2")} />
              <p className="mt-2 text-xs text-fg-muted">{t("tasks.valuesComeFromOriginalAnnotationsQualIsb4e964")}</p>
            </div>

            <SectionTitle icon={Database} title={t("tasks.clinvarAnnotations48099f")} />
            <div className="space-y-0">
              <InfoItem label={t("tasks.clinicalSignificancecd0866")} value={<ClinVarBadge value={annotation('ClinVar_Sig', variant.clinvarSignificance)} />} />
              <InfoItem label={t("tasks.reviewStatusa62215")} value={annotation('ClinVar_RevStat', variant.clinvarReviewStatus)} />
              <InfoItem label={t("tasks.reviewStars29d243")} value={clinvarReviewStars(annotation('ClinVar_RevStat', variant.clinvarReviewStatus))} />
              <InfoItem label={t("history.associatedDiseasea79330")} value={annotation('ClinVar_DN', variant.clinvarDisease)} />
            </div>

            <SectionTitle icon={Database} title={t("tasks.populationFrequency1705e3")} />
            <div className="space-y-0">
              <InfoItem label={t("tasks.gnomadOverallAf6abfe1")} value={formatPopulationFrequency(annotation('GnomAD_AF', variant.gnomadAF), t)} />
              <InfoItem label={t("tasks.gnomadEastAsianAfe9255d")} value={formatPopulationFrequency(annotation('GnomAD_AF_EAS', variant.gnomadEasAF), t)} />
              <InfoItem label="VEP MAX_AF" value={formatPopulationFrequency(annotation('MAX_AF', variant.maxAF), t)} />
              <InfoItem label="gnomAD nhomalt XX" value={annotation('GnomAD_nhomalt_XX', variant.gnomadNhomaltXX)} />
              <InfoItem label="gnomAD nhomalt XY" value={annotation('GnomAD_nhomalt_XY', variant.gnomadNhomaltXY)} />
              <p className="mt-2 text-xs text-fg-muted">{t("tasks.afIsTheOriginalRatioFromTo137eda")}</p>
            </div>

            <SectionTitle icon={Dna} title={t("tasks.functionalPredictions9b8bd4")} />
            <div className="space-y-0">
              <InfoItem label={t("interface.pangolinGaindcee65")} value={annotation('Pangolin_Gain', variant.pangolinGain)} />
              <InfoItem label={t("interface.pangolinLoss653f20")} value={annotation('Pangolin_Loss', variant.pangolinLoss)} />
              <InfoItem label={t("tasks.pangolinPredictionLabel4595a9")} value={annotation('Pangolin_AN', variant.pangolinAnnotation)} />
              <InfoItem label="EVOScore2" value={annotation('EVOScore', variant.evoScore)} />
              <InfoItem label={t("tasks.evoscorePredictionLabel9c87e9")} value={annotation('EVOScore_AN', variant.evoAnnotation)} />
              <InfoItem label={t("tasks.alphamissenseScore84aae0")} value={annotation('AlphaMissense_AM', variant.alphaMissenseScore)} />
              <InfoItem label={t("tasks.alphamissensePredictionLabel5a4a6e")} value={formatPredictionLabel(annotation('AlphaMissense_AMC', variant.alphaMissenseClass))} />
              <p className="mt-2 text-xs text-fg-muted">{t("tasks.workflowMultivaluesAndLabelsArePreservedFunctional8c01b5")}</p>
            </div>
          </section>

          {/* 4. AI 评估 */}
          <section hidden={section !== 'ai'} className="space-y-4">
            <div className="flex items-center justify-between gap-3 border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="w-4 h-4 text-accent-fg shrink-0" />
                <h4 className="text-sm font-semibold text-fg-default truncate">ACMG 智能研判</h4>
              </div>
              <div className="shrink-0 flex items-center justify-end ml-auto">
                <AIAssistanceAction
                  onError={setAIError}
                  key={`${taskId}/${variant.id}/acmg-ai`}
                  disabled={readOnly || versionBusy}
                  input={{
                    feature: 'acmg',
                    taskId,
                    reference: referenceGenome,
                    variant: aiVariantContext(variant),
                    calculator: {
                      evidence: variant.acmgEvidence ?? variant.automaticAcmg?.criteria,
                      override: variant.acmgOverride,
                    },
                  }}
                  onResult={handleAIResult}
                />
              </div>
            </div>

            {versionBusy && (
              <div className="flex items-center gap-2 rounded-md bg-canvas-subtle p-3 text-xs text-fg-muted border border-border-subtle">
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent-emphasis border-t-transparent" />
                <span>正在自动保存 AI 评估结果至版本记录...</span>
              </div>
            )}

            {aiError && (
              <p role="alert" className="text-sm text-danger-fg bg-danger-subtle/30 border border-danger-emphasis/30 rounded p-2.5">
                {aiError}
              </p>
            )}

            {aiResult ? (
              <div className="space-y-4">
                {/* 1. AI 评定证据与结论（置顶放置） */}
                <div className="rounded-lg border border-border-subtle bg-canvas-subtle p-3.5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle/60 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-fg-default">AI评定证据与结论</span>
                      {((aiResult.suggestedClassification || aiResult.classification) as ACMGClassification | undefined) && (
                        <ClinicalSignificanceBadge value={((aiResult.suggestedClassification || aiResult.classification) as ACMGClassification)}>
                          {ACMG_CONFIG[((aiResult.suggestedClassification || aiResult.classification) as ACMGClassification)]?.label ?? (aiResult.suggestedClassification || aiResult.classification)}
                        </ClinicalSignificanceBadge>
                      )}
                    </div>
                    {aiResult.requestId && (
                      <span className="text-xs text-fg-muted font-mono">
                        归档ID: {aiResult.requestId}
                      </span>
                    )}
                  </div>

                  {(() => {
                    const effectiveEvidence = (aiResult.evidence ?? []).filter(item => item.status !== 'insufficient_data' && item.status !== 'not_applicable');
                    return effectiveEvidence.length > 0 ? (
                      <div className="space-y-2">
                        {effectiveEvidence.map((item, idx) => (
                          <div
                            key={item.code || idx}
                            className="rounded border border-border-default/60 bg-canvas-default p-2.5 text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className={`px-1.5 py-0.5 rounded font-bold text-xs ${item.code?.startsWith('B') ? 'bg-success-subtle text-success-fg' : 'bg-danger-subtle text-danger-fg'}`}>
                                  {item.code}
                                </span>
                                <span className="font-semibold text-fg-default">{item.strength}</span>
                                {item.status && <span className="text-fg-muted">· {item.status}</span>}
                              </div>
                            </div>
                            {item.reason && (
                              <p className="text-fg-muted leading-relaxed pl-0.5">{item.reason}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-fg-muted py-1">未产生满足条件的证据项。</p>
                    );
                  })()}
                </div>

                {/* 2. AI 研究内容（放在评定证据与结论下方） */}
                <AIResultCard
                  result={aiResult}
                  humanReviewSaved={Boolean(aiResult.requestId && variant.acmgAIResult?.requestId === aiResult.requestId)}
                />
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border-subtle p-8 text-center text-fg-muted space-y-2">
                <Sparkles className="w-8 h-8 mx-auto text-accent-fg/60" />
                <p className="text-sm font-medium text-fg-default">暂无 AI 评估记录</p>
                <p className="text-xs">点击右上角的“AI 评估”按钮，系统将根据位点注释和证据库生成智能判定建议。</p>
              </div>
            )}
          </section>

          {/* 5. ACMG 计算器 */}
          <section hidden={section !== 'acmg'}>
            <div className="space-y-4">
              <SectionTitle icon={Calculator} title="ACMG 证据计算器" />
              <ACMGPointsEditor
                key={`${taskId}/${variant.id}/manual`}
                variant={{ ...variant, acmgEvidence: localEvidence ?? variant.acmgEvidence }}
                onSave={handleSaveACMG}
                onCancel={() => setSection('overview')}
              />
            </div>
          </section>

          {/* 6. 人工解读 */}
          <section hidden={section !== 'interpretation'}>
            <SectionTitle icon={MessageSquare} title={t("tasks.manualInterpretation1fcaef")} />
            <div className="space-y-0">
              <textarea
                readOnly={readOnly}
                value={interpretation}
                onChange={(e) => setInterpretation(e.target.value)}
                placeholder={t("tasks.enterYourInterpretationOfThisVariantee0d51")}
                className="w-full min-h-[260px] px-3 py-2 text-sm border border-border-default rounded-md bg-canvas-default text-fg-default resize-y focus:outline-none focus:ring-2 focus:ring-accent-emphasis focus:border-transparent leading-relaxed"
              />
              <div className="mt-2 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-fg-muted">{interpretation.length} {t("tasks.characters9f8ba6")}</span>
                  <ActionButton
                    loading={interpretationSaving}
                    loadingLabel={t("tasks.saving6644f0")}
                    action="save"
                    variant="ghost"
                    type="button"
                    disabled={readOnly || interpretationSaving || interpretation === (variant.interpretation ?? '')}
                    onClick={() => void handleSaveInterpretation()}
                    className="rounded-md bg-accent-emphasis px-3 py-1.5 text-sm text-fg-on-emphasis disabled:opacity-50"
                  >
                    {t("tasks.saveInterpretationac1ec3")}
                  </ActionButton>
                </div>
                {interpretationError && <p role="alert" className="text-sm text-danger-fg">{interpretationError}</p>}
              </div>
            </div>
          </section>

          {/* 7. 历史记录 */}
          <section hidden={section !== 'history'}>
            <SectionTitle icon={FileText} title={t("tasks.interpretationChangeHistory8ee03f")} />
            <div className="space-y-2">
              {adjustmentHistory.length === 0 ? (
                <p className="text-sm text-fg-muted">{t("tasks.noChangesd43ef6")}</p>
              ) : (
                adjustmentHistory.map(event => (
                  <article key={event.id} className="rounded-md border border-border-subtle bg-canvas-default p-2.5">
                    <div className="flex flex-wrap justify-between gap-1 text-xs text-fg-muted">
                      <span>{event.actor || t("tasks.user9ba763")}</span>
                      <time>{event.createdAt ? new Date(event.createdAt).toLocaleString(t.locale) : ''}</time>
                    </div>
                    <p className="mt-1 text-sm text-fg-default">{resultHistoryReason(event.reason, t)}</p>
                    {adjustmentDiff(event.before, event.after, t).map(change => (
                      <p key={change.key} className="mt-1 break-words text-xs text-fg-muted">
                        <span className="font-medium">{change.key}：</span>{change.before} → {change.after}
                      </p>
                    ))}
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      </WorkspaceInspector>
    </>
  );
}
