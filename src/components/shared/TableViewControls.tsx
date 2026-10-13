'use client';
import { useText } from '@/i18n/useText';



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
  const t = useText();
  return <ToolbarPopover label={t("common.tableDisplayf33154")} icon={<Columns3 size={14} />}>
    <div className="mb-4 flex items-center justify-between gap-3 text-xs">
      <label htmlFor="workspace-table-density">{t("common.rowDensity5fe981")}</label>
      <select id="workspace-table-density" value={view.density} onChange={event => view.setDensity(event.target.value as 'compact' | 'default')} className="h-8 rounded border border-border-default bg-canvas-default px-2">
        <option value="compact">{t("common.compactc837ed")}</option><option value="default">{t("common.standard8beedd")}</option>
      </select>
    </div>
    <div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold">{t("common.visibleColumnsa02677")}</span>
      <button type="button" onClick={() => view.setHidden(new Set())} className="text-xs text-accent-fg">{t("common.restoreAll3d9615")}</button></div>
    <div className="grid gap-2">
      {columns.map((column, index) => <label key={column.id} className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={locked(column, index) || !view.hidden.has(column.id)} disabled={locked(column, index)}
          onChange={event => view.setHidden(previous => { const next = new Set(previous); if (event.target.checked) next.delete(column.id); else next.add(column.id); return next; })} />
        {typeof column.header === 'string' ? column.header : ({ pinned: t("tasks.pin7bcf18"), reported: t("tasks.report6c4cc0") }[column.id] ?? column.id)}
      </label>)}
    </div>
  </ToolbarPopover>;
}
