'use client';

import * as React from 'react';
import type { Column } from '@schema/ui-kit';
import { Columns3 } from 'lucide-react';
import { ToolbarPopover } from './ToolbarPopover';

const IDENTITY_COLUMNS = new Set(['reported', 'pinned', 'gene', 'position', 'chromosome', 'startPosition', 'endPosition']);
const locked = <T,>(column: Column<T>, index: number) => index === 0 || Boolean(column.pinned) || IDENTITY_COLUMNS.has(column.id);

export function useTableView() {
  const [hidden, setHidden] = React.useState<Set<string>>(() => new Set());
  const [density, setDensity] = React.useState<'compact' | 'default'>('compact');
  const apply = <T,>(columns: Column<T>[]) => columns.map((column, index) => ({
    ...column, visible: locked(column, index) || !hidden.has(column.id),
  }));
  return { hidden, setHidden, density, setDensity, apply };
}

export function TableViewControls<T>({ columns, view }: { columns: Column<T>[]; view: ReturnType<typeof useTableView> }) {
  return <ToolbarPopover label="表格显示" icon={<Columns3 size={14} />}>
    <div className="mb-4 flex items-center justify-between gap-3 text-xs">
      <label htmlFor="workspace-table-density">行密度</label>
      <select id="workspace-table-density" value={view.density} onChange={event => view.setDensity(event.target.value as 'compact' | 'default')} className="h-8 rounded border border-border-default bg-canvas-default px-2">
        <option value="compact">紧凑</option><option value="default">标准</option>
      </select>
    </div>
    <div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold">显示列</span>
      <button type="button" onClick={() => view.setHidden(new Set())} className="text-xs text-accent-fg">恢复全部</button></div>
    <div className="grid gap-2">
      {columns.map((column, index) => <label key={column.id} className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={locked(column, index) || !view.hidden.has(column.id)} disabled={locked(column, index)}
          onChange={event => view.setHidden(previous => { const next = new Set(previous); if (event.target.checked) next.delete(column.id); else next.add(column.id); return next; })} />
        {typeof column.header === 'string' ? column.header : ({ pinned: '置顶', reported: '回报' }[column.id] ?? column.id)}
      </label>)}
    </div>
  </ToolbarPopover>;
}
