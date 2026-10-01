'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import type { TableFilterState } from '../types';

const OPS = [
  ['contains', '包含'], ['equals', '精确匹配'], ['in', '任一匹配'],
  ['gt', '>'], ['gte', '≥'], ['lt', '<'], ['lte', '≤'], ['between', '范围'],
  ['is_missing', '缺失'], ['is_not_missing', '非缺失'],
] as const;
const NUMERIC_OPS = new Set(['gt', 'gte', 'lt', 'lte', 'between']);

type FilterOperator = typeof OPS[number][0];

function label(field: string): string {
  const common: Record<string, string> = {
    Chromosome: '染色体', Position: '位置', Gene: '基因', Type: '类型', VAF: '样本 VAF',
    GnomAD_AF: 'gnomAD AF', GnomAD_AF_EAS: 'gnomAD 东亚 AF', ClinVar_Sig: 'ClinVar 意义',
    acmgClassification: 'ACMG 评定', reviewed: '复核状态', reported: '回报状态',
  };
  return common[field] ?? field.replaceAll('_', ' ');
}

export function ParquetColumnFilterBar({
  columns,
  columnTypes,
  state,
  onChange,
}: {
  columns: string[];
  columnTypes?: Record<string, 'text' | 'number' | 'enum' | 'boolean'>;
  state: TableFilterState;
  onChange: (state: TableFilterState) => void;
}) {
  const [column, setColumn] = React.useState('');
  const [operator, setOperator] = React.useState<FilterOperator>('contains');
  const [value, setValue] = React.useState('');
  const filters = state.columnFilters ?? [];

  React.useEffect(() => {
    if (!column && columns.length) setColumn(columns[0]);
  }, [column, columns]);

  const addFilter = () => {
    if (!column || (!['is_missing', 'is_not_missing'].includes(operator) && !value.trim())) return;
    const filter = {
      column,
      operator,
      ...(['is_missing', 'is_not_missing'].includes(operator)
        ? {}
        : { value: operator === 'in' || operator === 'between' ? value.split(',').map(part => part.trim()).filter(Boolean) : value.trim() }),
    };
    onChange({ ...state, columnFilters: [...filters.filter(item => item.column !== column), filter], page: 1 });
    setValue('');
  };

  const removeFilter = (field: string) => onChange({ ...state, columnFilters: filters.filter(item => item.column !== field), page: 1 });
  const isPresence = operator === 'is_missing' || operator === 'is_not_missing';
  const fieldType = columnTypes?.[column] ?? 'text';
  const availableOps = OPS.filter(([key]) => !NUMERIC_OPS.has(key) || fieldType === 'number');

  return (
    <div className="mb-3 rounded-lg border border-border-subtle bg-canvas-subtle/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">列筛选</span>
        <select aria-label="选择筛选列" value={column} onChange={event => { const next = event.target.value; setColumn(next); if (columnTypes?.[next] === 'boolean' || columnTypes?.[next] === 'enum') setOperator('equals'); else if (NUMERIC_OPS.has(operator) && columnTypes?.[next] !== 'number') setOperator('contains'); }} className="h-8 max-w-[220px] rounded-md border border-border-default bg-canvas-default px-2 text-sm">
          {columns.map(item => <option key={item} value={item}>{label(item)}</option>)}
        </select>
        <select aria-label="筛选方式" value={operator} onChange={event => setOperator(event.target.value as FilterOperator)} className="h-8 rounded-md border border-border-default bg-canvas-default px-2 text-sm">
          {availableOps.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
        </select>
        {!isPresence && <input aria-label="筛选值" value={value} onChange={event => setValue(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') addFilter(); }} placeholder={operator === 'in' ? '逗号分隔多个值' : operator === 'between' ? '最小值,最大值' : '输入匹配值'} className="h-8 min-w-[150px] rounded-md border border-border-default bg-canvas-default px-2 text-sm" />}
        <button type="button" onClick={addFilter} disabled={!column || (!isPresence && !value.trim()) || (operator === 'between' && value.split(',').length !== 2)} className="h-8 rounded-md bg-accent-emphasis px-3 text-sm font-medium text-fg-on-emphasis disabled:opacity-50">应用</button>
        {filters.length > 0 && <button type="button" onClick={() => onChange({ ...state, columnFilters: [], page: 1 })} className="h-8 rounded-md border border-border-default px-3 text-sm text-fg-muted">清空列筛选</button>}
      </div>
      {filters.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2" aria-live="polite">
          {filters.map(filter => {
            const op = OPS.find(([key]) => key === filter.operator)?.[1] ?? filter.operator;
            const shown = Array.isArray(filter.value) ? filter.value.join(' / ') : filter.value;
            return <span key={filter.column} className="inline-flex items-center gap-1 rounded-full border border-accent-subtle bg-accent-subtle/40 px-2.5 py-1 text-xs text-fg-default">
              {label(filter.column)} {op}{shown ? ` ${shown}` : ''}
              <button type="button" aria-label={`移除${label(filter.column)}筛选`} onClick={() => removeFilter(filter.column)} className="rounded-full p-0.5 hover:bg-canvas-inset"><X className="h-3 w-3" /></button>
            </span>;
          })}
        </div>
      )}
      <p className="mt-2 text-xs text-fg-muted">不同列条件同时生效；“任一匹配”输入逗号分隔的值，数值范围输入最小值和最大值，多值注释按任一值匹配。</p>
    </div>
  );
}
