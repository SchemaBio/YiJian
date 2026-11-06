'use client';

import * as React from 'react';
import { ActionButton } from '@/components/shared/ActionButton';
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

export function MTACMGEditor({ variant, onSave }: {
  variant: MitochondrialVariant;
  onSave: (evidence: MTEvidence) => Promise<void>;
}) {
  const t = useText();
  const readOnly = useInterpretationReadOnly();
  const [entries, setEntries] = React.useState<MTEvidence>(variant.mtAssessment?.evidence ?? []);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const labels: Record<string, string> = {
    stand_alone: t('mtDetail.standAlone'), very_strong: t('tasks.veryStrong103c20'),
    strong: t('tasks.strong275680'), moderate: t('tasks.moderate839de2'), supporting: t('tasks.supportinga9aab1'),
  };

  async function save() {
    if (!entries.length || busy || readOnly) return;
    setBusy(true);
    setError('');
    try {
      await onSave(entries);
    } catch (cause) {
      setError(errorText(cause, t));
    } finally {
      setBusy(false);
    }
  }

  return <div className="space-y-3">
    <h4 className="font-medium">{t('mtDetail.calculator')}</h4>
    <p className="text-sm text-fg-muted">{t('mtDetail.criteriaHelp')}</p>
    <a href="https://erepo.clinicalgenome.org/cspec/ui/svi/doc/135637588?version=1.0.0" target="_blank" rel="noopener noreferrer" className="text-sm text-accent-fg underline">ClinGen mtDNA v1.0</a>
    <fieldset disabled={busy || readOnly} className="grid gap-2 rounded-lg border border-border-subtle p-3">
      {Object.entries(criteria).map(([code, strengths]) => {
        const entry = entries.find(item => item.code === code);
        return <div key={code} className="space-y-1">
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="font-mono">{code}</span>
            <select value={entry?.strength ?? ''} className="rounded border border-border-default bg-canvas-default px-2 py-1"
              onChange={event => {
                const strength = event.target.value;
                setEntries(current => [...current.filter(item => item.code !== code), ...(strength ? [{ code, strength, note: entry?.note }] : [])]);
              }}>
              <option value="">—</option>
              {strengths.map(strength => <option key={strength} value={strength}>{labels[strength]}</option>)}
            </select>
          </label>
          {entry && <input aria-label={`${code} ${t('mtDetail.evidenceNote')}`} placeholder={t('mtDetail.evidenceNote')}
            maxLength={1000} value={entry.note ?? ''} className="w-full rounded border border-border-default bg-canvas-default px-2 py-1 text-sm"
            onChange={event => {
              const note = event.target.value;
              setEntries(current => current.map(item => item.code === code ? { ...item, note } : item));
            }} />}
        </div>;
      })}
    </fieldset>
    {error && <p role="alert" className="text-sm text-danger-fg">{error}</p>}
    <ActionButton action="save" loading={busy} disabled={readOnly || !entries.length} onClick={() => void save()}>{t('mtDetail.calculateAndSave')}</ActionButton>
  </div>;
}
