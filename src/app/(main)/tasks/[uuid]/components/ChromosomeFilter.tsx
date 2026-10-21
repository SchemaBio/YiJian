'use client';

import { useText } from '@/i18n/useText';
import type { TableFilterState } from '../types';

const chromosomes = [...Array.from({ length: 22 }, (_, i) => String(i + 1)), 'X', 'Y', 'MT'];
const normalize = (value: string) => value.trim().replace(/^chr/i, '').toUpperCase().replace(/^M$/, 'MT');
const label = (value: string) => `chr${value === 'MT' ? 'M' : value}`;

export function ChromosomeFilter({ column, state, onChange }: {
  column?: string;
  state: TableFilterState;
  onChange: (state: TableFilterState) => void;
}) {
  const t = useText();
  const current = state.columnFilters?.find(filter => filter.column === column);
  const values = current ? (Array.isArray(current.value) ? current.value : [current.value]).map(value => normalize(String(value ?? ''))) : [];
  const selected = current ? ['equals', 'in'].includes(current.operator) && values.length && values.every(value => value === values[0]) && chromosomes.includes(values[0]) ? values[0] : 'custom' : '';
  return <select aria-label={t('history.chromosome326659')} disabled={!column} value={selected} onChange={event => {
    if (!column || event.target.value === 'custom') return;
    const chromosome = event.target.value;
    const aliases = chromosome === 'MT' ? ['M', 'MT', 'chrM', 'chrMT', 'CHRM', 'CHRMT', 'ChrM', 'ChrMT'] : [chromosome, `chr${chromosome}`, `CHR${chromosome}`, `Chr${chromosome}`];
    const filters = (state.columnFilters ?? []).filter(filter => filter.column !== column);
    onChange({ ...state, columnFilters: chromosome ? [...filters, { column, operator: 'in', value: aliases }] : filters, page: 1 });
  }} className="h-8 rounded-md border border-border-default bg-canvas-default px-3 text-sm text-fg-default disabled:opacity-50">
    <option value="">{t('tasks.allChromosomes')}</option>
    {selected === 'custom' && <option value="custom">{t('tasks.customChromosomeFilter')}</option>}
    {chromosomes.map(chromosome => <option key={chromosome} value={chromosome}>{label(chromosome)}</option>)}
  </select>;
}
