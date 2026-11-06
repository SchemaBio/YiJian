'use client';

import * as React from 'react';
import { ActionButton } from '@/components/shared/ActionButton';
import { ApiError, api } from '@/lib/api';
import { errorText } from '@/i18n/errors';
import { useText } from '@/i18n/useText';
import type { MitochondrialVariant } from '../types';
import { useInterpretationReadOnly } from './InterpretationLock';

export type MTEvidence = NonNullable<MitochondrialVariant['mtAssessment']>['evidence'];

const graded = ['very_strong', 'strong', 'moderate', 'supporting'];
const criteria: Record<string, string[]> = {
  PVS1: graded, PS1: ['strong'], PS2: graded, PS3: ['supporting'], PS4: graded.slice(1),
  PM2: ['supporting'], PM4: ['moderate'], PM5: ['moderate', 'supporting'], PM6: graded,
  PP1: ['moderate', 'supporting'], PP3: ['supporting'], PP4: ['supporting'],
  BA1: ['stand_alone'], BS1: ['strong'], BS2: ['strong', 'supporting'], BS3: ['supporting'],
  BS4: ['strong'], BP2: ['supporting'], BP4: ['supporting'], BP5: ['supporting'], BP7: ['supporting'],
};

export function MTACMGEditor({ taskId, variant, onSave }: {
  taskId: string;
  variant: MitochondrialVariant;
  onSave: (evidence: MTEvidence) => Promise<void>;
}) {
  const t = useText();
  const readOnly = useInterpretationReadOnly();
  const [entries, setEntries] = React.useState<MTEvidence>(variant.mtAssessment?.evidence ?? []);
  const [busy, setBusy] = React.useState<'preview' | 'save' | null>(null);
  const [preview, setPreview] = React.useState<MitochondrialVariant['mtAssessment']>();
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState('');
  const labels: Record<string, string> = {
    stand_alone: t('mtDetail.standAlone'), very_strong: t('tasks.veryStrong103c20'),
    strong: t('tasks.strong275680'), moderate: t('tasks.moderate839de2'), supporting: t('tasks.supportinga9aab1'),
  };

  function edit(update: (current: MTEvidence) => MTEvidence) {
    setEntries(update);
    setPreview(undefined);
    setSaved(false);
    setError('');
  }

  async function submit(action: 'preview' | 'save') {
    if (!entries.length || busy || readOnly) return;
    setBusy(action);
    setError('');
    try {
      if (action === 'preview') {
        setPreview(await api.post<NonNullable<MitochondrialVariant['mtAssessment']>>(
          `/v1/tasks/${encodeURIComponent(taskId)}/results/assessment/mt/preview`, { evidence: entries },
        ));
      } else if (preview) {
        await onSave(entries);
        setSaved(true);
      }
    } catch (cause) {
      setError(cause instanceof ApiError && ((action === 'preview' && cause.status === 404) || cause.message === 'unsupported adjustment field')
        ? t('mtDetail.backendUpgrade') : errorText(cause, t));
    } finally {
      setBusy(null);
    }
  }

  const display = preview ?? variant.mtAssessment;
  const observed = variant.annotationValues ?? {};
  const context = [
    ['HGVS', variant.hgvs], [t('history.gene9ef2ed'), variant.gene],
    [t('tasks.heteroplasmyFractionba19ec'), `${(variant.heteroplasmy * 100).toLocaleString(t.locale, { maximumFractionDigits: 2 })}%`],
    [t('tasks.dpReadDepth438651'), variant.depth], ['AD', observed.AD], ['ClinVar', observed.ClinVar_Sig],
    ['gnomAD AF', observed.GnomAD_AF], [t('history.haplogroupd4fd42'), variant.haplogroup],
  ];

  return <div className="space-y-3">
    <h4 className="font-medium">{t('mtDetail.calculator')}</h4>
    <p className="text-sm text-fg-muted">{t('mtDetail.criteriaHelp')}</p>
    <a href="https://erepo.clinicalgenome.org/cspec/ui/svi/doc/135637588?version=1.0.0" target="_blank" rel="noopener noreferrer" className="text-sm text-accent-fg underline">ClinGen mtDNA v1.0</a>
    <dl className="grid grid-cols-2 gap-2 rounded-lg border border-border-subtle p-3 text-sm">
      {context.map(([label, value]) => <div key={String(label)}><dt className="text-fg-muted">{String(label)}</dt><dd className="break-words font-medium">{value == null || value === '' || value === '.' ? '—' : String(value)}</dd></div>)}
    </dl>
    {(['P', 'B'] as const).map(direction => <fieldset key={direction} disabled={Boolean(busy) || readOnly} className="grid gap-3 rounded-lg border border-border-subtle p-3">
      <legend className="px-1 text-sm font-semibold">{t(direction === 'P' ? 'mtDetail.pathogenicCriteria' : 'mtDetail.benignCriteria')}</legend>
      {Object.entries(criteria).filter(([code]) => code.startsWith(direction)).map(([code, strengths]) => {
        const entry = entries.find(item => item.code === code);
        return <div key={code} className="space-y-1">
          <label className="flex items-start justify-between gap-3 text-sm">
            <span><strong className="font-mono">{code}</strong><span className="ml-2 text-fg-muted">{t(`mtDetail.criteria.${code}`)}</span></span>
            <select aria-label={code} value={entry?.strength ?? ''} className="shrink-0 rounded border border-border-default bg-canvas-default px-2 py-1"
              onChange={event => {
                const strength = event.target.value;
                edit(current => [...current.filter(item => item.code !== code), ...(strength ? [{ code, strength, note: entry?.note }] : [])]);
              }}>
              <option value="">—</option>
              {strengths.map(strength => <option key={strength} value={strength}>{labels[strength]}</option>)}
            </select>
          </label>
          {entry && <textarea aria-label={`${code} ${t('mtDetail.evidenceNote')}`} placeholder={t('mtDetail.evidenceNote')}
            rows={2} maxLength={1000} value={entry.note ?? ''} className="w-full rounded border border-border-default bg-canvas-default px-2 py-1 text-sm"
            onChange={event => {
              const note = event.target.value;
              edit(current => current.map(item => item.code === code ? { ...item, note } : item));
            }} />}
        </div>;
      })}
    </fieldset>)}
    <div className="sticky bottom-0 z-10 space-y-2 rounded-lg border border-border-default bg-canvas-default p-3 shadow-sm">
      {display && <div role="status" className="space-y-1 text-sm">
        <p className="font-semibold">{t(preview && !saved ? 'mtDetail.preview' : 'mtDetail.manualClassification')} · {display.classification.replaceAll('_', ' ')}</p>
        {display.basis && <p>{t(`mtDetail.basis.${display.basis}`)}</p>}
        <p>{display.evidence.map(item => `${item.code} (${labels[item.strength] ?? item.strength})`).join(' · ')}</p>
      </div>}
      {error && <p role="alert" className="text-sm text-danger-fg">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <ActionButton variant="secondary" loading={busy === 'preview'} disabled={readOnly || Boolean(busy) || !entries.length} onClick={() => void submit('preview')}>{t('mtDetail.preview')}</ActionButton>
        <ActionButton action="save" loading={busy === 'save'} disabled={readOnly || Boolean(busy) || !preview || saved} onClick={() => void submit('save')}>{t('mtDetail.saveAssessment')}</ActionButton>
      </div>
    </div>
  </div>;
}
