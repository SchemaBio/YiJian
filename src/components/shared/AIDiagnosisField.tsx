'use client';
import { useText } from '@/i18n/useText';


import * as React from 'react';
import { TextArea } from '@schema/ui-kit';
import { AIAssistanceAction } from './AIAssistanceAction';
import { useHpoTerms } from '@/lib/hpo-terms';
import { extractLocalHpo, type LocalHpoMatch } from '@/lib/hpo-extraction';

export function AIDiagnosisField({ value, onChange, onTerms, disabled = false }: {
  value: string; onChange: (value: string) => void; onTerms: (terms: Array<{ id: string; name: string }>) => void; disabled?: boolean;
}) {
  const t = useText();
  const id = React.useId();
  const terms = useHpoTerms();
  const [busy, setBusy] = React.useState(false), [message, setMessage] = React.useState('');
  const [local, setLocal] = React.useState<{ text: string; matches: LocalHpoMatch[] }>({ text: '', matches: [] });
  React.useEffect(() => {
    const timer = setTimeout(() => setLocal({ text: value, matches: extractLocalHpo(value, terms) }), 250);
    return () => clearTimeout(timer);
  }, [value, terms]);
  const matches = local.text === value ? local.matches : [];
  const positive = matches.filter(match => match.polarity === 'present');
  const unambiguous = positive.filter(match => !match.ambiguous);
  const addLocal = () => {
    onTerms(unambiguous.map(({ term }) => ({ id: term.id, name: term.name })));
    setMessage(t('hpoExtraction.added', { p0: String(unambiguous.length) }));
  };
  return <div>
    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1">
      <label htmlFor={id} className="text-xs font-medium text-fg-muted">{t("samples.clinicalDiagnosis654a81")}</label>
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2"><AIAssistanceAction disabled={disabled || !value.trim()} input={{ feature: 'hpo', diagnosis: value }} onBusyChange={setBusy}
        onResult={result => {
          const canonical = new Map(terms.map(term => [term.id, term]));
          const generated = (result.hpoTerms ?? []).filter(term => !term.polarity || term.polarity === 'present');
          const unique = [...new Map(generated.map(term => [term.id, term])).values()];
          const verified = unique.filter(term => canonical.has(term.id)).map(term => ({ id: term.id, name: canonical.get(term.id)!.name }));
          onTerms(verified);
          setMessage(`${verified.length ? t("assistance.addedHpoTermsReviewBeforeSavingb9e09b", {p0: String(verified.length)}) : t("assistance.noUsableHpoTermsGeneratedae1ce3")}${verified.length < unique.length ? t("assistance.unknownIdentifiersWereIgnored2eadd5") : ''}${result.warnings?.length ? ` ${result.warnings.join('；')}` : ''}`);
        }} /></div>
    </div>
    <TextArea id={id} value={value} disabled={disabled || busy} onChange={event => { setMessage(''); onChange(event.target.value); }} placeholder={t("assistance.enterClinicalDiagnosisc3296e")} rows={2} />
    {value.trim() && <div className="mt-2 space-y-2 rounded-md border border-border-default bg-canvas-subtle p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-fg-muted">{t('hpoExtraction.localTitle')}</span>
        <button type="button" className="yj-tool-button text-xs" disabled={disabled || busy || !unambiguous.length} onClick={addLocal}>{t('hpoExtraction.addCandidates', { p0: String(unambiguous.length) })}</button>
      </div>
      <p className="text-xs text-fg-muted">{t('hpoExtraction.localDescription')}</p>
      <div className="flex flex-wrap gap-1.5" aria-label={t('hpoExtraction.candidates')}>
        {positive.map(({ term, text, ambiguous }) => <button type="button" key={term.id} disabled={disabled || busy} onClick={() => { onTerms([{ id: term.id, name: term.name }]); setMessage(t('hpoExtraction.added', { p0: '1' })); }} className="rounded border border-border-default bg-canvas-default px-2 py-1 text-xs hover:bg-accent-subtle" title={text}>{term.name}{ambiguous && term.nameEn ? ` (${term.nameEn})` : ''} · {term.id}</button>)}
        {local.text === value && !positive.length && <span className="text-xs text-fg-muted">{t('hpoExtraction.noMatch')}</span>}
      </div>
      {matches.length > positive.length && <p className="text-xs text-fg-muted">{t('hpoExtraction.excluded', { p0: String(matches.length - positive.length) })}</p>}
      {positive.some(match => match.ambiguous) && <p className="text-xs text-fg-muted">{t('hpoExtraction.ambiguous')}</p>}
    </div>}
    {message && <p role="status" className="mt-1.5 text-xs leading-relaxed text-fg-muted">{message}</p>}
  </div>;
}
