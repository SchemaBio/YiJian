'use client';
import { readSNVSample } from '@/lib/snv-sample-metrics';
import { formatSampleVaf, sampleZygosityLabel } from './SNVSampleColumns';
import { formatNumericString } from '@/i18n/format';

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
import { ExternalLink, FileText, Database, Dna, MessageSquare } from 'lucide-react';
import { Tag } from '@/components/shared/Tag';
import type { SNVIndel, ACMGEvidenceEntry, ACMGClassification } from '../types';
import { ACMG_CONFIG } from '../result-api';
import { clinvarReviewStars, formatPopulationFrequency, formatPredictionLabel, sourceAnnotation, transcriptLocation } from '../utils/snv-annotations';
import { getResultRowAdjustmentHistory, type ResultRowAdjustmentEvent } from '../result-api';
import { AIAssistanceAction, AIResultCard } from '@/components/shared/AIAssistanceAction';
import { formatAIInterpretation, type AIAssistanceResult } from '@/lib/ai-assistance';
import { aiVariantContext } from '../utils/ai-context';
import { aiACMGReviewCandidates } from '../utils/ai-acmg';
import { SVCv4AssessmentPanel } from './SVCv4AssessmentPanel';
import type { SVCv4Assessment } from '@/lib/svcv4';

interface VariantDetailPanelProps {
  taskId: string;
  referenceGenome?: string;
  variant: SNVIndel | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateClassification?: (variant: SNVIndel, evidence: ACMGEvidenceEntry[], override: ACMGClassification | '', overrideReason: string, reason: string, reset?: boolean) => Promise<void>;
  onSaveInterpretation?: (variant: SNVIndel, interpretation: string, reason: string) => Promise<void>;
  onSaveVersionedAssessment?: (variant:SNVIndel,adjustments:Record<string,unknown>,reason:string)=>Promise<void>;
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
  renderAIAction,
  aiDraft,
}: {
  aiDraft?: { evidence: ACMGEvidenceEntry[]; reason: string };
  renderAIAction?: (calculator: unknown) => React.ReactNode;
  variant: SNVIndel;
  onSave: (evidence: ACMGEvidenceEntry[], override: ACMGClassification | '', overrideReason: string, reason: string, reset?: boolean) => Promise<void>;
  onCancel: () => void;
}) {
  const t = useText();
  const initialEvidence = aiDraft?.evidence ?? variant.acmgEvidence ?? variant.automaticAcmg?.criteria ?? [];
  const [evidence, setEvidence] = React.useState<Record<string, ACMGEvidenceEntry>>(() => Object.fromEntries(initialEvidence.map(item => [item.code, item])));
  const [override, setOverride] = React.useState<ACMGClassification | ''>(aiDraft ? '' : variant.acmgOverride ?? '');
  const [overrideReason, setOverrideReason] = React.useState(aiDraft ? '' : variant.acmgOverrideReason ?? '');
  const [reason, setReason] = React.useState(aiDraft?.reason ?? '');
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

  const toggle = (code: string, checked: boolean) => { setRestoreAutomatic(false); setEvidence(previous => {
    const next = { ...previous };
    if (!checked) delete next[code];
    else {
      if (code === 'PP3') delete next.BP4;
      if (code === 'BP4') delete next.PP3;
      const strength = code === 'BA1' ? 'standalone' : (code === 'PVS1' ? 'very_strong' : code.startsWith('P') && code.slice(0, 2) === 'PS' || code.startsWith('B') && code.slice(0, 2) === 'BS' ? 'strong' : code.startsWith('PM') ? 'moderate' : 'supporting');
      next[code] = { code, strength, source: code === 'PP3' || code === 'BP4' ? 'AlphaMissense' : t("tasks.manualEvidencea288d3") };
    }
    return next;
  }); };

  const save = async () => {
    setSaving(true); setError('');
    try {
      await onSave(Object.values(evidence), override, overrideReason.trim(), reason.trim(), restoreAutomatic);
    } catch (cause) {
      setError(cause instanceof Error ? errorText(cause, t) : t("tasks.unableToSaveAcmgEvidencedb2f9e"));
    } finally {
      setSaving(false);
    }
  };

  return <div className="space-y-4">
    {aiDraft && <p role="note" className="rounded-md border border-accent-subtle bg-accent-subtle/20 p-3 text-sm">{t('assistance.acmgReviewDraftNotice')}</p>}
    {renderAIAction && <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold">{t("tasks.generatedFromCurrentEditedEvidence1c1c7c")}</span>{renderAIAction({ evidence: Object.values(evidence), override, overrideReason, score })}</div>}
    <div className="rounded-lg border border-accent-subtle bg-accent-subtle/30 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">{t("tasks.automaticAssessmentc4ff36")}{auto?.profile ?? 'acmg-snv-points-v2'}</span><span>{t("tasks.automaticClassification8daa4b")}{auto?.classification ? ACMG_CONFIG[auto.classification]?.label : t("tasks.insufficientEvidence70568c")} · {auto?.score ?? 0} {t("tasks.pointsdecb3b")}</span></div>
      {auto?.pending?.length ? <p className="mt-1 text-xs text-fg-muted">{t("tasks.unconfirmed7c7684")}{auto.pending.join('；')}</p> : <p className="mt-1 text-xs text-fg-muted">{t("tasks.populationDiseaseMechanismFamilyAndLaboratoryEvidencebc757f")}</p>}
    </div>
    {POINT_CRITERIA.map(group => <section key={group.title} className="space-y-2">
      <h5 className="text-sm font-semibold text-fg-default">{translateUI(group.title, t)}</h5>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {group.items.map(code => {
          const item = evidence[code];
          return <div key={code} className={`flex min-w-0 items-center gap-2 rounded-md border p-2 ${item ? (code.startsWith('B') ? 'border-success-emphasis/40 bg-success-subtle/30' : 'border-danger-emphasis/40 bg-danger-subtle/30') : 'border-border-subtle bg-canvas-default'}`}>
            <input type="checkbox" checked={Boolean(item)} onChange={event => toggle(code, event.target.checked)} aria-label={t("tasks.selectAcmgEvidencef17a92", {p0: String(code)})} />
            <span className="w-12 shrink-0 text-xs font-semibold">{code}</span>
            {item && code !== 'BA1' && <select value={item.strength} onChange={event => { setRestoreAutomatic(false); setEvidence(previous => ({ ...previous, [code]: { ...previous[code], strength: event.target.value as ACMGEvidenceEntry['strength'] } })); }} aria-label={t("tasks.strengthc0b275", {p0: String(code)})} className="min-w-0 flex-1 rounded border border-border-default bg-canvas-default px-1.5 py-1 text-xs">
              {([['supporting',t("tasks.supportinga9aab1")],['moderate',t("tasks.moderate839de2")],['strong',t("tasks.strong275680")],...(code.startsWith('P') ? [['very_strong',t("tasks.veryStrong103c20")]] : [])]).map(([value, label]) => <option key={value} value={value}>{label}（{POINTS[value]} {t("tasks.points505d62")}</option>)}
            </select>}
            {item && code === 'BA1' && <span className="text-xs text-success-fg">{t("tasks.independentBenignEvidence8ecbad")}</span>}
          </div>;
        })}
      </div>
    </section>)}
    <div className="rounded-lg border border-border-subtle bg-canvas-default p-3 text-sm"><div className="flex justify-between"><span>{t("tasks.evidencePoints76bde1")}</span><strong>{score}</strong></div><div className="mt-1 flex justify-between"><span>{t("tasks.pointBasedClassification845a04")}</span><strong>{calculated ? ACMG_CONFIG[calculated].label : t("tasks.insufficientEvidence70568c")}</strong></div></div>
    <div><label className="mb-1 block text-sm font-medium">{t("tasks.manualFinalClassificationOverridedb887b")}</label><select value={override} onChange={event => { setRestoreAutomatic(false); setOverride(event.target.value as ACMGClassification | ''); }} className="w-full rounded-md border border-border-default bg-canvas-default px-3 py-2 text-sm"><option value="">{t("tasks.showByEvidencePoints055e03")}</option>{Object.entries(ACMG_CONFIG).map(([key, config]) => <option key={key} value={key}>{translateUI(config.label, t)}</option>)}</select></div>
    {override && <textarea value={overrideReason} onChange={event => setOverrideReason(event.target.value)} placeholder={t("tasks.overrideReasonOptional")} className="min-h-16 w-full rounded-md border border-border-default bg-canvas-default p-2 text-sm" />}
    <textarea value={reason} onChange={event => setReason(event.target.value)} placeholder={t("tasks.evidenceChangeReasonOptional")} className="min-h-16 w-full rounded-md border border-border-default bg-canvas-default p-2 text-sm" />
    {error && <p role="alert" className="text-sm text-danger-fg">{error}</p>}
    <ActionButton action="save" variant="ghost" type="button" disabled={saving} onClick={() => { setEvidence(Object.fromEntries((auto?.criteria ?? []).map(item => [item.code, item]))); setOverride(''); setOverrideReason(''); setReason(t("tasks.restoreCurrentAutomaticAssessmentBaselineffd9de")); setRestoreAutomatic(true); }} className="rounded-md border border-border-default px-3 py-2 text-sm">{t("tasks.restoreAutomaticBaselineAndSave7ecc58")}</ActionButton>
    <div className="flex gap-2"><ActionButton loading={saving} loadingLabel={t("tasks.saving6644f0")} action="save" variant="primary" type="button" disabled={saving} onClick={() => void save()} className="flex-1">{t("tasks.saveEvidenceAndClassificationd8ed29")}</ActionButton><ActionButton variant="ghost" type="button" onClick={onCancel} className="rounded-md border border-border px-3 py-2 text-sm">{t("admin.cancel4d0b46")}</ActionButton></div>
  </div>;
}

export function VariantDetailPanel({ taskId, referenceGenome, variant, isOpen, onClose, onUpdateClassification, onSaveInterpretation,onSaveVersionedAssessment }: VariantDetailPanelProps) {
  const t = useText();
  const [section, setSection] = React.useState<InspectorSection>('annotation');
  const [aiResult, setAIResult] = React.useState<AIAssistanceResult>();
  const [acmgTab, setAcmgTab] = React.useState<'acmg' | 'svcv4'>('acmg');
  const selectedRef = React.useRef(variant?.id); selectedRef.current = variant?.id;
  const [isEditingACMG, setIsEditingACMG] = React.useState(false);
  const [localClassification, setLocalClassification] = React.useState<ACMGClassification | null>(null);
  const [localCriteria, setLocalCriteria] = React.useState<string[] | null>(null);
  const [localEvidence, setLocalEvidence] = React.useState<ACMGEvidenceEntry[] | null>(null);
  const [localSource, setLocalSource] = React.useState<SNVIndel['acmgAssessmentSource']>();
  const [aiDraft, setAIDraft] = React.useState<{ key: string; evidence: ACMGEvidenceEntry[]; reason: string }>();
  const [interpretation, setInterpretation] = React.useState('');
  const [versionBusy,setVersionBusy]=React.useState(false);
  const [versionError,setVersionError]=React.useState('');
  const [interpretationSaving, setInterpretationSaving] = React.useState(false);
  const [interpretationError, setInterpretationError] = React.useState('');
  const [adjustmentHistory, setAdjustmentHistory] = React.useState<ResultRowAdjustmentEvent[]>([]);
  const readOnly = useInterpretationReadOnly();
  const canEditACMG = !readOnly && Boolean(onUpdateClassification);
  React.useEffect(() => { if (readOnly) setIsEditingACMG(false); }, [readOnly]);

  // 当 variant 变化时重置编辑状态
  React.useEffect(() => {
    setSection('annotation');
    setAcmgTab('acmg');
    setAIResult(undefined);
    setIsEditingACMG(false);
    setLocalClassification(null);
    setLocalCriteria(null);
    setLocalEvidence(null); setLocalSource(undefined); setAIDraft(undefined);
    setInterpretation(variant?.interpretation ?? '');
    setVersionError('');setVersionBusy(false);
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

  const currentClassification = localClassification ?? (variant.activeAcmgVersion==='svcv4'?variant.legacyAcmgClassification:variant.acmgClassification);
  const currentCriteria = localCriteria ?? variant.acmgCriteria ?? [];
  const currentEvidence = localEvidence ?? variant.acmgEvidence ?? variant.automaticAcmg?.criteria ?? [];
  const assessmentSource = localSource ?? variant.acmgAssessmentSource ?? 'automatic';
  const currentScore = assessmentSource === 'automatic' ? variant.automaticAcmg?.score : currentEvidence.reduce((sum, item) => sum + (item.code === 'BA1' ? 0 : (item.code.startsWith('B') ? -1 : 1) * (POINTS[item.strength] ?? 0)), 0);
  const aiCandidates = aiResult ? aiACMGReviewCandidates(aiResult) : [];
  const acmgConfig = currentClassification ? ACMG_CONFIG[currentClassification] : undefined;
  const activeClassification=variant.activeAcmgVersion==='svcv4'?variant.svcv4Assessment?.result?.classification:currentClassification;
  const activeConfig=activeClassification?ACMG_CONFIG[activeClassification]:undefined;
  const saveVersioned=async(adjustments:Record<string,unknown>,reason:string)=>{
    if(!onSaveVersionedAssessment)return;
    await onSaveVersionedAssessment(variant,adjustments,reason);
    if(selectedRef.current===variant.id) {
      try{const history=await getResultRowAdjustmentHistory(taskId,'snv-indel',variant.id);if(selectedRef.current===variant.id)setAdjustmentHistory(history);}catch{/* Saved data remains successful if history refresh fails. */}
    }
  };
  const selectVersion=async(version:'legacy'|'svcv4')=>{
    if(readOnly || versionBusy || !onSaveVersionedAssessment)return;
    setVersionBusy(true);setVersionError('');
    try{await saveVersioned({activeAcmgVersion:version},'');}catch(e){if(selectedRef.current===variant.id)setVersionError(e instanceof Error ? errorText(e, t):t("tasks.switchFailed9e2fdc"));}finally{if(selectedRef.current===variant.id)setVersionBusy(false);}
  };

  const annotation = (column: string, fallback?: string | number) => sourceAnnotation(variant, column, fallback);
  const dbSnpIds = dbSnpIdentifiers(variant);
  const proband = variant.proband ?? readSNVSample({...variant, ...variant.annotationValues});
  const transcriptInfo = transcriptLocation(variant);

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
    setLocalEvidence(evidence);
    setLocalSource(reset ? 'automatic' : override ? 'manual_override' : 'manual_evidence');
    setAIDraft(undefined);
    setIsEditingACMG(false);
  };

  const handleSaveInterpretation = async () => {
    if (!variant || !onSaveInterpretation || interpretationSaving) return;
    if (interpretation === (variant.interpretation ?? '')) return;
    setInterpretationSaving(true);
    setInterpretationError('');
    try {
      await onSaveInterpretation(variant, interpretation, '');
      if (selectedRef.current !== variant.id) return;
      try {const history = await getResultRowAdjustmentHistory(taskId, 'snv-indel', variant.id);
      if (selectedRef.current === variant.id) setAdjustmentHistory(history);}catch{/* Saving succeeded even if history refresh is unavailable. */}
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
            {activeConfig ? <ClinicalSignificanceBadge value={activeClassification ?? undefined}>{variant.activeAcmgVersion==='svcv4'&&variant.svcv4Assessment?.result?.vusSubclass?variant.svcv4Assessment.result.vusSubclass:activeConfig.label}</ClinicalSignificanceBadge> : <Tag variant="neutral">{t("tasks.acmgNotAssessed1ea79b")}</Tag>}
          </div>
          <IconActionButton label={t("tasks.close6c14bd")} action="close" variant="ghost"
            onClick={onClose}
            className="p-1.5 text-fg-muted hover:text-fg-default hover:bg-canvas-inset rounded transition-colors"

           />
        </div>

        <div className="yj-inspector-summary">
          <strong className="text-fg-default">{variant.gene || t("tasks.geneNotProvidedac7186")}</strong> · {variant.chromosome}:{variant.position}<br />
          {variant.ref} → {variant.alt} · {variant.automaticAcmg?.classificationBasis && variant.automaticAcmg.classificationBasis !== 'acmg_evidence' ? t("tasks.quickAssessmentAwaitingManualReview573655") : t("tasks.automaticAssessmentPointsce3c65", {p0: String(variant.automaticAcmg?.score ?? '—')})}
          <p className="mt-1 text-xs">{t("tasks.currentlyUsing372ce3")}{variant.activeAcmgVersion==='svcv4'?t("tasks.svcVExperimentalNonauthoritativeReference0e7cc1"):t("tasks.currentAcmgEdition8379ee")}</p>
          {!activeConfig && <p className="mt-1 text-warning-fg">{t("tasks.insufficientEvidenceForAcmgClassification822f20")}</p>}
        </div>
        {/* 内容区域 */}
        <InspectorTabs id="variant-inspector" value={section} onChange={setSection} sections={['annotation', 'evidence', 'acmg', 'interpretation', 'history']} />
        <div id="variant-inspector-content" role="tabpanel" aria-labelledby={`variant-inspector-${section}`} className="yj-inspector-content">
          <section hidden={section !== 'interpretation'} >
          {/* 人工解读 */}
          <SectionTitle icon={MessageSquare} title={t("tasks.manualInterpretation1fcaef")} />
          <div className="space-y-0">
            <textarea
              readOnly={readOnly}
              value={interpretation}
              onChange={(e) => setInterpretation(e.target.value)}
              placeholder={t("tasks.enterYourInterpretationOfThisVariantee0d51")}
              className="w-full min-h-[90px] px-3 py-2 text-sm border border-border-default rounded-md bg-canvas-default text-fg-default resize-y focus:outline-none focus:ring-2 focus:ring-accent-emphasis focus:border-transparent"
            />
            <div className="mt-2 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-fg-muted">{interpretation.length} {t("tasks.characters9f8ba6")}</span>
                <ActionButton loading={interpretationSaving} loadingLabel={t("tasks.saving6644f0")} action="save" variant="ghost" type="button" disabled={readOnly || interpretationSaving || interpretation === (variant.interpretation ?? '')} onClick={() => void handleSaveInterpretation()} className="rounded-md bg-accent-emphasis px-3 py-1.5 text-sm text-fg-on-emphasis disabled:opacity-50">{t("tasks.saveInterpretationac1ec3")}</ActionButton>
              </div>
              {interpretationError && <p role="alert" className="text-sm text-danger-fg">{interpretationError}</p>}
            </div>
          </div>

          </section>
          <section hidden={section !== 'acmg'}>
            <InspectorTabs id="variant-acmg-calculator" value={acmgTab}
              onChange={value => { if (value === 'acmg' || value === 'svcv4') setAcmgTab(value); }}
              sections={['acmg', 'svcv4']} labels={{ acmg: t("tasks.currentEdition7b034e"), svcv4: t("tasks.svcV6cd501") }} ariaLabel={t("display.acmgCalculatorVersion6cc1e9")} />
            <div id="variant-acmg-calculator-content" role="tabpanel" aria-labelledby={`variant-acmg-calculator-${acmgTab}`} className="pt-3">
            {!readOnly&&onSaveVersionedAssessment&&<div className="space-y-2 border-b border-border-subtle p-3">
              <ActionButton permission="interpretation_reports.manage" action="completed" type="button" loading={versionBusy} loadingLabel={t("tasks.switching717bbf")} disabled={(variant.activeAcmgVersion??'legacy')===(acmgTab==='acmg'?'legacy':'svcv4')||(acmgTab==='svcv4'&&(!variant.svcv4Assessment?.confirmed||!variant.svcv4Assessment.result?.classification))} onClick={()=>void selectVersion(acmgTab==='acmg'?'legacy':'svcv4')}>{t("tasks.use365456")}{acmgTab==='acmg'?t("tasks.currentEdition7b034e"):t("tasks.svcVExperimentaldc2093")}{t("tasks.result0a2c91")}</ActionButton>
              {versionError&&<p role="alert" className="text-sm text-danger-fg">{versionError}</p>}
            </div>}
              <section hidden={acmgTab !== 'svcv4'}>
                <SVCv4AssessmentPanel key={`${taskId}/${variant.id}`} taskId={taskId} reference={referenceGenome} variant={variant} readOnly={readOnly} onSaveAI={onSaveVersionedAssessment?requestId=>saveVersioned({svcv4AIResult:requestId},''):undefined} onUseAIInterpretation={onSaveInterpretation ? result => { setInterpretation(previous => [previous, formatAIInterpretation(result)].filter(Boolean).join('\n\n')); setSection('interpretation'); } : undefined} onSave={onSaveVersionedAssessment?(assessment:SVCv4Assessment,reason:string)=>saveVersioned({svcv4Assessment:assessment},reason):undefined} />
              </section>
              <section hidden={acmgTab !== 'acmg'}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold">{t("tasks.currentAcmgEdition8379ee")}</span>
                {!isEditingACMG && <AIAssistanceAction key={`${taskId}/${variant.id}/acmg`} disabled={readOnly} input={{ feature: 'acmg', taskId, reference: referenceGenome, variant: aiVariantContext(variant), calculator: { evidence: variant.acmgEvidence ?? variant.automaticAcmg?.criteria, override: variant.acmgOverride } }} onResult={setAIResult} />}
              </div>
              {aiResult && <AIResultCard result={aiResult} humanReviewSaved={Boolean(aiResult.requestId && currentEvidence.some(item => item.source === 'sepilens_ai_reviewed' && item.note?.includes(`AI request: ${aiResult.requestId}`)))} onReviewEvidence={canEditACMG && aiCandidates.length > 0 ? () => { setAIDraft({ key: crypto.randomUUID(), evidence: aiCandidates, reason: `${t('assistance.acmgAIReviewReason')}${aiResult.requestId ? ` (${aiResult.requestId})` : ''}` }); setIsEditingACMG(true); } : undefined} onUseInterpretation={!readOnly && onSaveInterpretation ? () => { setInterpretation(previous => [previous, formatAIInterpretation(aiResult)].filter(Boolean).join('\n\n')); setSection('interpretation'); } : undefined} />}
              {/* ACMG 分类 */}
              <SectionTitle
                icon={FileText}
                title={t("tasks.acmgClassification52bcef")}
                action={
                  canEditACMG && !isEditingACMG && (
                    <ActionButton action="edit" variant="ghost"
                      onClick={() => { setAIDraft(undefined); setIsEditingACMG(true); }}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-fg-muted hover:text-fg-default hover:bg-canvas-inset rounded transition-colors"
                    >

                      {t("admin.edita7f814")}</ActionButton>
                  )
                }
              />
              <div className="space-y-0">
                {isEditingACMG ? (
                  <ACMGPointsEditor
                    key={aiDraft?.key ?? 'manual'}
                    variant={{ ...variant, acmgEvidence: localEvidence ?? variant.acmgEvidence }}
                    aiDraft={aiDraft}
                    onSave={handleSaveACMG}
                    renderAIAction={calculator => <AIAssistanceAction disabled={readOnly} input={{feature:'acmg',taskId,reference:referenceGenome,variant:aiVariantContext(variant),calculator}} onResult={setAIResult} />}
                  onCancel={() => setIsEditingACMG(false)}
                  />
                ) : (
                  <>
                    <InfoItem label={t("tasks.classification435c52")} value={acmgConfig ? <ClinicalSignificanceBadge value={currentClassification}>{acmgConfig.label}</ClinicalSignificanceBadge> : t("tasks.notAssessedd94e42")} />
                    <InfoItem label={t("tasks.assessmentSource3f01c0")} value={assessmentSource === 'manual_override' ? t("tasks.manualOverrideef74b5") : assessmentSource === 'manual_evidence' ? t("tasks.savedEvidencePoints874a14") : variant.automaticAcmg?.classificationBasis === 'clinvar_reference' ? t("tasks.quickAssessmentClinvarReferenceb1b550") : variant.automaticAcmg?.classificationBasis === 'population_screening' ? t("tasks.quickAssessmentGnomadFrequencyScreenf23e0f") : variant.automaticAcmg?.classificationBasis === 'screening_conflict' ? t("tasks.quickAssessmentConflictNeedsReviewf3c456") : variant.automaticAcmg?.classificationBasis === 'screening_vus' ? t("tasks.quickAssessmentVusNeedsReview79d7da") : t("tasks.automaticEvidencePointsb87a06")} />
                    {assessmentSource === 'automatic' && variant.automaticAcmg?.screeningNotes?.length ? <div className="space-y-1 rounded bg-canvas-subtle p-3 text-xs text-fg-muted">{variant.automaticAcmg.screeningNotes.map(note => <p key={note}>{note}</p>)}</div> : null}
                    <PhenotypeSummary assessment={variant.automaticAcmg} />
                    <AnnotationScreeningNotes details={variant.automaticAcmg?.annotationDetails} />
                    <InfoItem label={t(assessmentSource === 'automatic' ? "tasks.automaticEvidencePointsb87a06" : "tasks.evidencePoints76bde1")} value={currentScore !== undefined ? t("tasks.pointsc91542", {p0: String(currentScore)}) : undefined} />
                    {!acmgConfig && <p className="mt-2 text-xs text-fg-muted">{t("tasks.currentAnnotationsCannotEstablishAnAcmgClassification3d8581")}</p>}
                    <InfoItem
                      label={t("tasks.evidenceItem13948e")}
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
            </div>
          </section>
          <section hidden={section !== 'evidence'} >
          {/* 测序质量 */}
          <SectionTitle icon={FileText} title={t("tasks.sequencingQuality74e3b6")} />
          <div className="space-y-0">
            <InfoItem label="VAF" value={formatSampleVaf(proband.alleleFrequency, t)} />
            {proband.vafSource==='ad' && <p className="text-xs text-fg-muted">{t('tasks.sampleVafFromAd',{p0:proband.alleleDepth ?? '-'})}</p>}
            {(['father','mother'] as const).map(role => variant[role] && <React.Fragment key={role}>
              <InfoItem label={t('tasks.'+role+'Zygosity')} value={sampleZygosityLabel(variant[role]!.zygosity,t)} />
              <InfoItem label={t('tasks.'+role+'Vaf')} value={formatSampleVaf(variant[role]!.alleleFrequency,t)} />
            </React.Fragment>)}
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

          {/* 人群频率 */}
          <SectionTitle icon={Database} title={t("tasks.populationFrequency1705e3")} />
          <div className="space-y-0">
            <InfoItem label={t("tasks.gnomadOverallAf6abfe1")} value={formatPopulationFrequency(annotation('GnomAD_AF', variant.gnomadAF), t)} />
            <InfoItem label={t("tasks.gnomadEastAsianAfe9255d")} value={formatPopulationFrequency(annotation('GnomAD_AF_EAS', variant.gnomadEasAF), t)} />
            <InfoItem label="VEP MAX_AF" value={formatPopulationFrequency(annotation('MAX_AF', variant.maxAF), t)} />
            <InfoItem label="gnomAD nhomalt XX" value={annotation('GnomAD_nhomalt_XX', variant.gnomadNhomaltXX)} />
            <InfoItem label="gnomAD nhomalt XY" value={annotation('GnomAD_nhomalt_XY', variant.gnomadNhomaltXY)} />
            <p className="mt-2 text-xs text-fg-muted">{t("tasks.afIsTheOriginalRatioFromTo137eda")}</p>
          </div>

          {/* 功能预测 */}
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
          <section hidden={section !== 'history'} >
          <SectionTitle icon={FileText} title={t("tasks.interpretationChangeHistory8ee03f")} />
          <div className="space-y-2">
            {adjustmentHistory.length === 0 ? <p className="text-sm text-fg-muted">{t("tasks.noChangesd43ef6")}</p> : adjustmentHistory.map(event => <article key={event.id} className="rounded-md border border-border-subtle bg-canvas-default p-2.5">
              <div className="flex flex-wrap justify-between gap-1 text-xs text-fg-muted"><span>{event.actor || t("tasks.user9ba763")}</span><time>{event.createdAt ? new Date(event.createdAt).toLocaleString(t.locale) : ''}</time></div>
              <p className="mt-1 text-sm text-fg-default">{resultHistoryReason(event.reason, t)}</p>
              {adjustmentDiff(event.before, event.after, t).map(change => <p key={change.key} className="mt-1 break-words text-xs text-fg-muted"><span className="font-medium">{change.key}：</span>{change.before} → {change.after}</p>)}
            </article>)}
          </div>

          </section>
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
            {(dbSnpIds.length > 0 || variant.rsId || annotation('HGNC_ID') || annotation('Cytoband')) && <section aria-labelledby="variant-ids-heading">
              <h4 id="variant-ids-heading" className="yj-annotation-heading">{t("tasks.variantIdentifiera3a10c")}</h4>
              {(dbSnpIds.length > 0 || variant.rsId) && <InfoItem label="dbSNP" value={dbSnpIds.length ? <span className="inline-flex flex-wrap gap-x-2 gap-y-1">{dbSnpIds.map(id => <a key={id} href={`https://www.ncbi.nlm.nih.gov/snp/${id}`} target="_blank" rel="noopener noreferrer" className="text-accent-fg hover:underline">{id}</a>)}</span> : variant.rsId} />}
              {annotation('HGNC_ID') && <InfoItem label="HGNC ID" value={annotation('HGNC_ID')} />}
              {annotation('Cytoband') && <InfoItem label={t("tasks.cytobandc12b02")} value={annotation('Cytoband')} />}
            </section>}
            <section aria-labelledby="variant-links-heading">
              <h4 id="variant-links-heading" className="yj-annotation-heading">{t("tasks.databasesAndInterpretationResources02d5cc")}</h4>
              <VariantResourceLinks variant={variant} referenceGenome={referenceGenome} />
            </section>
          </section>
        </div>

      </WorkspaceInspector>
    </>
  );
}
