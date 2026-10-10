'use client';
import * as React from 'react';
import { TextArea } from '@schema/ui-kit';
import { AIAssistanceAction } from './AIAssistanceAction';
import { useHpoTerms } from '@/lib/hpo-terms';

export function AIDiagnosisField({ value, onChange, onTerms, disabled = false }: {
  value: string; onChange: (value: string) => void; onTerms: (terms: Array<{ id: string; name: string }>) => void; disabled?: boolean;
}) {
  const id = React.useId();
  const terms = useHpoTerms();
  const [busy, setBusy] = React.useState(false), [message, setMessage] = React.useState('');
  return <div>
    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1">
      <label htmlFor={id} className="text-xs font-medium text-fg-muted">临床诊断</label>
      <AIAssistanceAction disabled={disabled || !value.trim()} input={{ feature: 'hpo', diagnosis: value }} onBusyChange={setBusy}
        onResult={result => {
          const canonical = new Map(terms.map(term => [term.id, term]));
          const generated = result.hpoTerms ?? [];
          const unique = [...new Map(generated.map(term => [term.id, term])).values()];
          const verified = unique.filter(term => canonical.has(term.id)).map(term => ({ id: term.id, name: canonical.get(term.id)!.name }));
          onTerms(verified);
          setMessage(`${verified.length ? `已补充 ${verified.length} 个 HPO 术语，请复核后保存。` : '未生成可用的 HPO 术语。'}${verified.length < unique.length ? '未收录的编号已忽略。' : ''}`);
        }} />
    </div>
    <TextArea id={id} value={value} disabled={disabled || busy} onChange={event => { setMessage(''); onChange(event.target.value); }} placeholder="请输入临床诊断" rows={2} />
    {message && <p role="status" className="mt-1.5 text-xs leading-relaxed text-fg-muted">{message}</p>}
  </div>;
}
