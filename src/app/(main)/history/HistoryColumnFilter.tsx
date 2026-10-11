'use client';
import * as React from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Check, ChevronDown } from 'lucide-react';

const choices = [['', '不限'], ['__missing', '未提供'], ['__present', '已提供']] as const;
export function HistoryColumnFilter({ label, value, numeric, onChange }: { label: string; value: string; numeric?: boolean; onChange: (value: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const menu = React.useRef<HTMLDivElement>(null);
  const selected = value === '未提供' ? '__missing' : value === '已提供' ? '__present' : value;
  const display = choices.find(([key]) => key === selected)?.[1];
  return <Popover.Root open={open} onOpenChange={setOpen}>
    <div className="yj-history-column-filter">
      <input aria-label={`${label}筛选`} value={value ? display || value : ''} placeholder={numeric ? '数值条件' : '筛选'} title={numeric ? '输入数值条件，例如 >=0.01' : '输入筛选条件'} className="yj-history-filter-input" data-filtered={!!value} onChange={event => onChange(event.target.value)} />
      <Popover.Trigger asChild><button type="button" aria-label={`${label}完整性筛选`}><ChevronDown aria-hidden="true" /></button></Popover.Trigger>
    </div>
    <Popover.Portal><Popover.Content sideOffset={4} align="end" collisionPadding={8} className="yj-history-filter-menu yj-history-presence-menu" onOpenAutoFocus={event => { event.preventDefault(); menu.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus(); }}>
      <div ref={menu} role="menu" aria-label={`${label}完整性选项`} onKeyDown={event => {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'));
        const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowUp' ? -1 : 1) + buttons.length) % buttons.length;
        buttons[next]?.focus();
      }}>{choices.map(([key, text]) => <button key={key} type="button" role="menuitemradio" aria-checked={key === selected || (!key && !display)} className="yj-history-filter-option" onClick={() => { onChange(key); setOpen(false); }}><span>{text}</span>{key === selected && <Check aria-hidden="true" />}</button>)}</div>
    </Popover.Content></Popover.Portal>
  </Popover.Root>;
}
