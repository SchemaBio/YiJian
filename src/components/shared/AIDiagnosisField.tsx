'use client';
import { useText } from '@/i18n/useText';


import * as React from 'react';
import { TextArea } from '@schema/ui-kit';
import { AIAssistanceAction } from './AIAssistanceAction';
import { useHpoTerms } from '@/lib/hpo-terms';

export function AIDiagnosisField({ value, onChange, onTerms, disabled = false }: {
  value: string; onChange: (value: string) => void; onTerms: (terms: Array<{ id: string; name: string }>) => void; disabled?: boolean;
}) {
  const t = useText();
  const id = React.useId();
  const terms = useHpoTerms();
  const [busy, setBusy] = React.useState(false), [message, setMessage] = React.useState('');
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
    {message && <p role="status" className="mt-1.5 text-xs leading-relaxed text-fg-muted">{message}</p>}
  </div>;
}
