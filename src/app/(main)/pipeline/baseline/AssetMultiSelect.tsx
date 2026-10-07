'use client';

import * as React from 'react';
import { Check, ChevronDown } from 'lucide-react';

export function AssetMultiSelect({ label, options, value, onChange, onOpenChange, disabled = false }: {
  label: string; options: { value: string; label: string }[]; value: string[];
  onChange: (value: string[]) => void; onOpenChange?: (open: boolean) => void; disabled?: boolean;
}) {
  const root = React.useRef<HTMLDivElement>(null);
  const trigger = React.useRef<HTMLButtonElement>(null);
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const listID = React.useId();
  React.useEffect(() => { onOpenChange?.(open); }, [open, onOpenChange]);
  React.useEffect(() => () => { onOpenChange?.(false); }, [onOpenChange]);
  React.useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', escape, true);
    return () => { document.removeEventListener('pointerdown', outside, true); document.removeEventListener('keydown', escape, true); };
  }, [open]);
  React.useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  const selected = value.map(id => options.find(option => option.value === id)?.label || id);
  const filtered = options.filter(option => option.label.toLowerCase().includes(search.trim().toLowerCase()));
  return <div ref={root} className="relative" onBlur={event => { if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button ref={trigger} type="button" aria-label={`选择${label}`} aria-expanded={open} aria-controls={listID} disabled={disabled} onClick={() => { setOpen(!open); setSearch(''); }} title={selected.join('\n')} className="flex min-h-9 w-full items-center justify-between gap-3 rounded-md border border-border-default bg-canvas-default px-3 py-2 text-left text-sm disabled:opacity-50">
      <span className="min-w-0 truncate">{selected.length ? `已选择 ${selected.length} 个文件 · ${selected.join('、')}` : `选择一个或多个 ${label} 文件`}</span><ChevronDown size={15} className="shrink-0" />
    </button>
    {open && <div id={listID} className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border-default shadow-lg" style={{ backgroundColor: 'var(--yj-panel-bg, #fff)' }}>
      <div className="border-b border-border-default p-2"><input autoFocus aria-label={`搜索${label}文件`} value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索文件名或编号" className="h-8 w-full rounded border border-border-default bg-canvas-subtle px-2 text-sm" /></div>
      <div className="max-h-56 overflow-y-auto p-1" role="group" aria-label={`${label}可选文件`}>
        {filtered.map(option => <button key={option.value} type="button" role="checkbox" aria-checked={value.includes(option.value)} onClick={() => onChange(value.includes(option.value) ? value.filter(id => id !== option.value) : [...value, option.value])} className={`flex w-full items-start gap-2 rounded px-2 py-2 text-left text-sm hover:bg-canvas-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-emphasis ${value.includes(option.value) ? 'bg-accent-subtle' : ''}`}><span aria-hidden="true" className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${value.includes(option.value) ? 'border-accent-emphasis bg-accent-emphasis text-white' : 'border-border-default'}`}>{value.includes(option.value) && <Check size={12} />}</span><span className="min-w-0 flex-1 break-all">{option.label}</span></button>)}
        {!filtered.length && <p className="p-3 text-xs text-fg-muted">没有匹配文件</p>}
      </div>
    </div>}
  </div>;
}
