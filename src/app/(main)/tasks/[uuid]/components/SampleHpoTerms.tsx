'use client';

import * as React from 'react';
import { Tag } from '@/components/shared/Tag';
import { useText } from '@/i18n/useText';
import { errorText } from '@/i18n/errors';
import { ActionButton, IconActionButton } from '@/components/shared/ActionButton';
import { HoverHint } from '@/components/shared/HoverHint';
import { searchHpoTerms, useHpoTerms } from '@/lib/hpo-terms';

type Term = { id: string; name: string };

export function SampleHpoTerms({ terms, refreshing, onSave }: {
  terms: Term[]; refreshing: boolean; onSave: (terms: Term[]) => Promise<void>;
}) {
  const t = useText();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState<Term[]>([]);
  const [query, setQuery] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const pending = React.useRef(false);
  const catalog = useHpoTerms(editing);
  const matches = searchHpoTerms(catalog, query).filter(term => !draft.some(item => item.id === term.id));
  const directId = query.trim().toUpperCase();
  if (/^HP:\d{7}$/.test(directId) && !catalog.some(term => term.id === directId) && !draft.some(term => term.id === directId)) {
    matches.push({ id: directId, name: directId });
  }
  const save = async () => {
    if (pending.current) return;
    pending.current = true; setSaving(true); setError('');
    try { await onSave(draft); setEditing(false); setQuery(''); }
    catch (cause) { setError(cause instanceof Error ? errorText(cause, t) : t('interface.failedToSaveSample5561da')); }
    finally { pending.current = false; setSaving(false); }
  };

  return <section className="space-y-3 border-t border-border-default pt-3" aria-label={t('samples.hpoPhenotypeTermsc62e48')}>
    <div className="flex items-center justify-between gap-2">
      <h4 className="text-xs font-medium text-fg-muted">{t('samples.hpoPhenotypeTermsc62e48')}</h4>
      {!editing && <ActionButton action="edit" size="small" variant="ghost" disabled={refreshing} onClick={() => { setDraft(terms.map(term => ({...term}))); setQuery(''); setError(''); setEditing(true); }}>{t('admin.edita7f814')}</ActionButton>}
    </div>
    <div className="flex flex-wrap gap-2">
      {(editing ? draft : terms).map(term => <HoverHint key={term.id} content={term.name}><span className="inline-flex items-center gap-1"><Tag variant="info" className="font-mono">{term.id}</Tag>{editing && <IconActionButton action="close" size="small" variant="ghost" disabled={saving} label={t('samples.remove40a0d2', {p0:term.id})} onClick={() => setDraft(items => items.filter(item => item.id !== term.id))} />}</span></HoverHint>)}
      {!(editing ? draft : terms).length && <span className="text-xs text-fg-muted">{t('samples.noHpoTerms0cc1c0')}</span>}
    </div>
    {editing && <>
      <input aria-label={t('samples.searchHpoTermsEGHpOr746be4')} placeholder={t('samples.searchHpoTermsEGHpOr746be4')} value={query} disabled={saving} onChange={event => setQuery(event.target.value)} className="h-8 w-full rounded border border-border-default bg-canvas-default px-2 text-sm" />
      {matches.length > 0 && <ul className="max-h-40 overflow-y-auto rounded border border-border-default">{matches.map(term => <li key={term.id}><button type="button" disabled={saving} className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-canvas-subtle disabled:opacity-50" onClick={() => { setDraft(items => items.some(item => item.id === term.id) ? items : [...items, {id:term.id, name:term.name}]); setQuery(''); }}><span className="font-mono text-accent-fg">{term.id}</span><span>{term.name}</span></button></li>)}</ul>}
      <div className="flex justify-end gap-2">
        <ActionButton size="small" disabled={saving} onClick={() => { setEditing(false); setQuery(''); setError(''); }}>{t('admin.cancel4d0b46')}</ActionButton>
        <ActionButton action="save" size="small" loading={saving} onClick={() => void save()}>{t('data.savefadf24')}</ActionButton>
      </div>
    </>}
    {error && <p role="alert" className="text-xs text-danger-fg">{error}</p>}
  </section>;
}
