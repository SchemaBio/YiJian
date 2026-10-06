'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { TabType, TableFilterState } from '../types';
import { DEFAULT_FILTER_STATE } from '../types';

type ResultTableTab = 'snv-indel' | 'cnv-segment' | 'cnv-exon' | 'str' | 'mei' | 'mt' | 'upd' | 'roh';
type TabStates = Record<ResultTableTab, TableFilterState>;

const TABLE_TABS: ResultTableTab[] = ['snv-indel', 'cnv-segment', 'cnv-exon', 'str', 'mei', 'mt', 'upd', 'roh'];
const ALL_TABS: TabType[] = ['overview', 'snv-indel', 'cnv-segment', 'cnv-exon', 'str', 'mei', 'mt', 'upd', 'roh', 'report'];

interface UseTabStateReturn {
  activeTab: TabType;
  hasExplicitTab: boolean;
  setActiveTab: (tab: TabType) => void;
  getFilterState: (tab: ResultTableTab) => TableFilterState;
  setFilterState: (tab: ResultTableTab, state: TableFilterState) => void;
}

function emptyTabStates(): TabStates {
  return TABLE_TABS.reduce((states, tab) => ({ ...states, [tab]: { ...DEFAULT_FILTER_STATE, filters: {} } }), {} as TabStates);
}

function filtersFromURL(params: URLSearchParams): TableFilterState {
  let filters: Record<string, string | string[]> = {};
  const encoded = params.get('filters');
  if (encoded) {
    try {
      const parsed: unknown = JSON.parse(encoded);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        filters = Object.fromEntries(Object.entries(parsed).filter(([, value]) => typeof value === 'string' || Array.isArray(value)));
      }
    } catch {
      filters = {};
    }
  }
  const page = Number(params.get('page'));
  return {
    ...DEFAULT_FILTER_STATE,
    searchQuery: params.get('q') ?? '',
    filters,
    columnFilters: (() => {
      try {
        const value = params.get('columnFilters');
        const parsed: unknown = value ? JSON.parse(value) : [];
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(item => item && typeof item.column === 'string' && typeof item.operator === 'string' && ['contains', 'equals', 'in', 'gt', 'gte', 'lt', 'lte', 'is_missing', 'is_not_missing'].includes(item.operator));
      } catch {
        return [];
      }
    })(),
    sortColumn: params.get('sort') || undefined,
    sortDirection: params.get('direction') === 'desc' ? 'desc' : params.get('direction') === 'asc' ? 'asc' : undefined,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

function writeFilterParams(params: URLSearchParams, state: TableFilterState) {
  const set = (key: string, value: string | undefined) => {
    if (value) params.set(key, value);
    else params.delete(key);
  };
  set('q', state.searchQuery || undefined);
  set('sort', state.sortColumn);
  set('direction', state.sortDirection);
  set('page', state.page > 1 ? String(state.page) : undefined);
  const filters = Object.fromEntries(Object.entries(state.filters).filter(([, value]) => value !== '' && (!Array.isArray(value) || value.length > 0)));
  set('filters', Object.keys(filters).length > 0 ? JSON.stringify(filters) : undefined);
  set('columnFilters', state.columnFilters?.length ? JSON.stringify(state.columnFilters) : undefined);
}

export function useTabState(uuid: string): UseTabStateReturn {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get('tab');
  const activeTab: TabType = ALL_TABS.includes(rawTab as TabType) ? rawTab as TabType : 'overview';
  const [tabStates, setTabStates] = React.useState<TabStates>(emptyTabStates);

  React.useEffect(() => {
    if (!TABLE_TABS.includes(activeTab as ResultTableTab)) return;
    const tab = activeTab as ResultTableTab;
    const next = filtersFromURL(searchParams);
    setTabStates(previous => ({ ...previous, [tab]: next }));
  }, [activeTab, searchParams]);

  const setActiveTab = React.useCallback((tab: TabType) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    if (TABLE_TABS.includes(tab as ResultTableTab)) writeFilterParams(params, tabStates[tab as ResultTableTab]);
    else ['q', 'sort', 'direction', 'page', 'filters', 'columnFilters'].forEach(key => params.delete(key));
    router.push(`/tasks/${encodeURIComponent(uuid)}?${params.toString()}`);
  }, [router, searchParams, tabStates, uuid]);

  const getFilterState = React.useCallback((tab: ResultTableTab): TableFilterState => tabStates[tab], [tabStates]);

  const setFilterState = React.useCallback((tab: ResultTableTab, state: TableFilterState) => {
    setTabStates(previous => ({ ...previous, [tab]: state }));
    if (tab !== activeTab) return;
    const params = new URLSearchParams(searchParams.toString());
    writeFilterParams(params, state);
    router.replace(`/tasks/${encodeURIComponent(uuid)}?${params.toString()}`, { scroll: false });
  }, [activeTab, router, searchParams, uuid]);

  return { activeTab, hasExplicitTab: rawTab !== null && ALL_TABS.includes(rawTab as TabType), setActiveTab, getFilterState, setFilterState };
}
