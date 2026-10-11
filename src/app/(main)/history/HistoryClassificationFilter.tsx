'use client';

import * as React from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Check, ChevronDown } from 'lucide-react';
import { CLASS_LABELS } from './history-engine';

const options = [{ value: '', label: '全部分类' }, { value: '__missing', label: '未提供' },
  ...Object.entries(CLASS_LABELS).filter(([value]) => value).map(([value, label]) => ({ value, label }))];

export function HistoryClassificationFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const menu = React.useRef<HTMLDivElement>(null);
  const selected = options.find(option => option.value === value) ?? options[0];
  const moveFocus = (event: React.KeyboardEvent) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const items = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('button') ?? []);
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length;
    items[next]?.focus();
  };
  return <Popover.Root open={open} onOpenChange={setOpen}>
    <Popover.Trigger asChild><button type="button" aria-label="当前分类筛选" className="yj-history-filter-trigger" data-filtered={!!value}>
      <span>{selected.label}</span><ChevronDown aria-hidden="true" />
    </button></Popover.Trigger>
    <Popover.Portal><Popover.Content sideOffset={6} align="center" collisionPadding={12} className="yj-history-filter-menu"
      onOpenAutoFocus={event => { event.preventDefault(); menu.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus(); }}>
      <div ref={menu} role="menu" aria-label="当前分类筛选选项" onKeyDown={moveFocus}>
        {options.map(option => <button key={option.value} type="button" role="menuitemradio" aria-checked={value === option.value}
          className="yj-history-filter-option" onClick={() => { onChange(option.value); setOpen(false); }}>
          <span>{option.label}</span>{value === option.value && <Check aria-hidden="true" />}
        </button>)}
      </div>
    </Popover.Content></Popover.Portal>
  </Popover.Root>;
}
