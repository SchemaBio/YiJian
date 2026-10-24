'use client';
import { useText } from '@/i18n/useText';

import * as React from 'react';
import { TextArea } from '@schema/ui-kit';
import { AIAssistanceAction } from './AIAssistanceAction';
import { getHpoTermName, isHpoEnglishLocale, useHpoTerms } from '@/lib/hpo-terms';
import { extractLocalHpo, type LocalHpoMatch } from '@/lib/hpo-extraction';
import { useAIAssistance } from '@/components/providers/AIAssistanceProvider';
import type { AIAssistanceResult } from '@/lib/ai-assistance';

export function AIDiagnosisField({ value, onChange, onTerms, disabled = false }: {
  value: string; onChange: (value: string) => void; onTerms: (terms: Array<{ id: string; name: string }>) => void; disabled?: boolean;
}) {
  const t = useText();
  const id = React.useId();
  const terms = useHpoTerms();
  const { adapter } = useAIAssistance();
  const isEnglish = isHpoEnglishLocale(t.locale);
  const [busy, setBusy] = React.useState(false), [message, setMessage] = React.useState('');
  const [ai, setAI] = React.useState<{ text: string; ids: string[]; unknown: number; warnings: string[] } | null>(null);
  const currentText = React.useRef(value);
  currentText.current = value;
  const generationText = React.useRef(value);
  const generationRevision = React.useRef(0);
  const restoreAI = React.useCallback((result: AIAssistanceResult, text: string) => {
    const ids = [...new Set((result.hpoTerms ?? []).filter(term => !term.polarity || term.polarity === 'present').map(term => term.id))];
    setAI({ text, ids, unknown: 0, warnings: result.warnings ?? [] });
  }, []);
  React.useEffect(() => {
    setAI(null);
    if (!value.trim() || !adapter.getSavedHPO) return;
    const controller = new AbortController();
    const revision = generationRevision.current;
    const timer = setTimeout(() => {
      void adapter.getSavedHPO!(value, controller.signal).then(result => {
        if (result && !controller.signal.aborted && generationRevision.current === revision && currentText.current === value) restoreAI(result, value);
      }).catch(() => { /* A cache read never starts a model request. */ });
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [value, adapter, restoreAI]);
  const [local, setLocal] = React.useState<{ text: string; matches: LocalHpoMatch[] }>({ text: '', matches: [] });
  React.useEffect(() => {
    const timer = setTimeout(() => setLocal({ text: value, matches: extractLocalHpo(value, terms) }), 250);
    return () => clearTimeout(timer);
  }, [value, terms]);
  const matches = local.text === value ? local.matches : [];
  const positive = matches.filter(match => match.polarity === 'present');
  const unambiguous = positive.filter(match => !match.ambiguous);
  const addLocal = () => {
    onTerms(unambiguous.map(({ term }) => ({ id: term.id, name: getHpoTermName(term, t.locale, terms) })));
    setMessage(t('hpoExtraction.added', { p0: String(unambiguous.length) }));
  };
  const aiCandidates = ai?.text === value ? ai.ids.flatMap(id => {
    const term = terms.find(term => term.id === id);
    return term ? [term] : [];
  }) : [];
  const addAI = (id: string) => {
    const term = aiCandidates.find(term => term.id === id);
    if (!term) return;
    onTerms([{ id: term.id, name: getHpoTermName(term, t.locale, terms) }]);
    setMessage(t('hpoExtraction.aiAdded', { p0: '1' }));
  };
  return <div>
    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1">
      <label htmlFor={id} className="text-xs font-medium text-fg-muted">{t("samples.clinicalDiagnosis654a81")}</label>
    </div>
    <TextArea id={id} value={value} disabled={disabled || busy} onChange={event => { setMessage(''); onChange(event.target.value); }} placeholder={t("assistance.enterClinicalDiagnosisc3296e")} rows={2} />
    {value.trim() && <div className="mt-2 space-y-2 rounded-md border border-border-default bg-canvas-subtle p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-fg-muted">{t('hpoExtraction.localTitle')}</span>
        <button type="button" className="yj-tool-button text-xs" disabled={disabled || busy || !unambiguous.length} onClick={addLocal}>{t('hpoExtraction.addCandidates', { p0: String(unambiguous.length) })}</button>
      </div>
      <div className="flex flex-wrap gap-1.5" aria-label={t('hpoExtraction.candidates')}>
        {positive.map(({ term, text, ambiguous }) => {
          const displayName = getHpoTermName(term, t.locale, terms);
          return (
            <button
              type="button"
              key={term.id}
              disabled={disabled || busy}
              onClick={() => {
                onTerms([{ id: term.id, name: displayName }]);
                setMessage(t('hpoExtraction.added', { p0: '1' }));
              }}
              className="rounded border border-border-default bg-canvas-default px-2 py-1 text-xs hover:bg-accent-subtle"
              title={text}
            >
              {displayName}{!isEnglish && ambiguous && term.nameEn ? ` (${term.nameEn})` : ''} · {term.id}
            </button>
          );
        })}
        {local.text === value && !positive.length && <span className="text-xs text-fg-muted">{t('hpoExtraction.noMatch')}</span>}
      </div>
      {matches.length > positive.length && <p className="text-xs text-fg-muted">{t('hpoExtraction.excluded', { p0: String(matches.length - positive.length) })}</p>}
      {positive.some(match => match.ambiguous) && <p className="text-xs text-fg-muted">{t('hpoExtraction.ambiguous')}</p>}
    </div>}
    <section className="mt-2 space-y-2 rounded-md border border-border-default bg-canvas-subtle p-3" aria-label={t('hpoExtraction.aiTitle')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-fg-muted">{t('hpoExtraction.aiTitle')}</span>
        <AIAssistanceAction disabled={disabled || !value.trim()} input={{ feature: 'hpo', diagnosis: value }} onBusyChange={active => { if (active) { generationText.current = value; generationRevision.current++; } setBusy(active); }}
          onResult={result => {
            if (generationText.current !== currentText.current) return;
            restoreAI(result, value);
            setMessage('');
          }} />
      </div>
      <p className="text-xs text-fg-muted">{t('hpoExtraction.aiDescription')}</p>
      {ai?.text === value && <>
        <div className="flex flex-wrap gap-1.5" aria-label={t('hpoExtraction.aiCandidates')}>
          {aiCandidates.map(term => <button type="button" key={term.id} disabled={disabled || busy} onClick={() => addAI(term.id)} className="rounded border border-border-default bg-canvas-default px-2 py-1 text-xs hover:bg-accent-subtle">
            {getHpoTermName(term, t.locale, terms)} · {term.id}
          </button>)}
          {!aiCandidates.length && <span className="text-xs text-fg-muted">{t('hpoExtraction.aiEmpty')}</span>}
        </div>
        {ai.ids.length > aiCandidates.length && <p role="status" className="text-xs text-fg-muted">{t('assistance.unknownIdentifiersWereIgnored2eadd5')}</p>}
        {ai.warnings.length > 0 && <p className="text-xs text-fg-muted">{ai.warnings.join('；')}</p>}
      </>}
    </section>
    {message && <p role="status" className="mt-1.5 text-xs leading-relaxed text-fg-muted">{message}</p>}
  </div>;
}
