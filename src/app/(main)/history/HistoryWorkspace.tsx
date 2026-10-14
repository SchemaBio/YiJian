'use client';
import { errorText } from '@/i18n/errors';

import { useText } from '@/i18n/useText';
import { resultHistoryReason } from '@/i18n/result-history';
import { chineseText, translateUI, type TextTranslator } from '@/i18n/text';

import { ActionButton, IconActionButton } from '@/components/shared/ActionButton';


import * as React from 'react';
import { HoverHint } from '@/components/shared/HoverHint';
import { useRouter } from 'next/navigation';
import { Search, ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { HistoryClassificationFilter } from './HistoryClassificationFilter';
import { HistoryColumnFilter } from './HistoryColumnFilter';
import { useAuth } from '@/components/providers/AuthProvider';
import { ApiError } from '@/lib/api';
import { HistoryWorkerClient, focusDetail, syncFocuses, type HistoryAudit } from './history-client';
import { CLASS_LABELS, HISTORY_TYPES, locus, historyPosition, type HistoryQuery, type HistoryQueryResult, type HistoryTask, type HistoryType, type FocusRow } from './history-engine';

const initialQuery: Omit<HistoryQuery, 'table'> = { search: '', includeWithdrawn: false, filters: {}, sort: 'detectionCount', direction: 'desc', page: 1, pageSize: 25 };
const columns = [['chrom', 'CHROM', 104], ['pos', 'POS', 180], ['ref', 'REF', 112], ['alt', 'ALT', 112], ['reference', '参考版本', 112], ['gene', '基因', 150], ['classification', '当前分类', 160], ['detectionCount', '涉及任务数', 120], ['firstFocusedAt', '首次关注', 180], ['lastFocusedAt', '最近关注', 180], ['af', '人群 AF', 128]] as const;
const formatTime = (value?: string | null, t: TextTranslator = chineseText) => value ? new Date(value).toLocaleString(t.locale, { hour12: false }) : t('history.notProvided071fb2');
const classificationLabel = (value: string) => CLASS_LABELS[value] || value || '未提供';
function ClassBadge({ value }: { value: string }) {
  const t = useText();
  return <HoverHint content={translateUI(value || undefined, t)}><span data-classification={value} className="yj-history-classification">{t(classificationLabel(value))}</span></HoverHint>;
}
type Source = { row: FocusRow; task?: HistoryTask };

export default function HistoryWorkspace() {
  const t = useText();
  const router = useRouter();
  const { user, currentOrg, isAuthenticated } = useAuth();
  const scope = isAuthenticated && user ? `${user.id}:${currentOrg?.id || 'personal'}` : '';
  const [table, setTable] = React.useState<HistoryType>('snv-indel');
  const [query, setQuery] = React.useState(initialQuery);
  const [search, setSearch] = React.useState('');
  const [client, setClient] = React.useState<HistoryWorkerClient | null>(null);
  const cursors = React.useRef(new Map<HistoryType, string>());
  const [ready, setReady] = React.useState(false), [syncing, setSyncing] = React.useState(false);
  const [received, setReceived] = React.useState(0), [error, setError] = React.useState('');
  const [version, setVersion] = React.useState(0), [refresh, setRefresh] = React.useState(0);
  const [result, setResult] = React.useState<HistoryQueryResult | null>(null);
  const [readyIdentity, setReadyIdentity] = React.useState('');
  const visibleReady = ready && readyIdentity === `${scope}:${table}`;
  const [selected, setSelected] = React.useState<string | null>(null), [sources, setSources] = React.useState<Source[]>([]);
  const [sourceError, setSourceError] = React.useState(''), [auditID, setAuditID] = React.useState('');
  const sourcePanel = React.useRef<HTMLElement>(null);
  const [audit, setAudit] = React.useState<HistoryAudit[] | null>(null), [auditError, setAuditError] = React.useState('');

  React.useEffect(() => {
    cursors.current.clear(); setResult(null); setSelected(null); setReady(false);
    setAuditID(''); setAudit(null); setSources([]); setQuery(initialQuery); setSearch('');
    if (!scope) { setClient(null); return; }
    let worker: HistoryWorkerClient;
    try { worker = new HistoryWorkerClient(); setClient(worker); }
    catch { setError(t("history.browserStatisticsCannotStartCheckBrowserSettings160003")); return; }
    return () => worker.dispose();
  }, [scope]);
  React.useEffect(() => { const timer = setTimeout(() => setQuery(previous => ({ ...previous, search, page: 1 })), 300); return () => clearTimeout(timer); }, [search]);

  React.useEffect(() => {
    if (!client || !scope) return;
    const controller = new AbortController(); let busy = false;
    setReady(false); setResult(null); setSelected(null); setError(''); setReceived(0);
    const synchronize = async () => {
      if (busy || controller.signal.aborted) return;
      busy = true; setSyncing(true);
      let cursor = cursors.current.get(table) || '', watermark: number | undefined;
      const hadSnapshot = cursors.current.has(table);
      let count = 0, catchups = 0;
      try {
        await client.call({ action: 'begin', table });
        while (!controller.signal.aborted) {
          let response;
          try { response = await syncFocuses(table, cursor, watermark, controller.signal); }
          catch (failure) {
            if (failure instanceof ApiError && failure.status === 410 && cursor) { setReady(false); await client.call({ action: 'clear', table }); await client.call({ action: 'begin', table }); cursor = ''; watermark = undefined; cursors.current.delete(table); continue; }
            throw failure;
          }
          if (controller.signal.aborted) return;
          await client.call({ action: 'stage', table, rows: response.rows, tasks: response.tasks });
          if (controller.signal.aborted) return;
          count += response.rows.length; setReceived(count); cursor = response.cursor;
          if (!response.complete) { watermark = response.watermark; continue; }
          // A second watermark catches rows updated while the first scan ran.
          watermark = undefined;
          if (response.rows.length === 0) break;
          if (++catchups > 10) throw new Error(t("history.focusSelectionsAreStillUpdatingRefreshLater4a0678"));
        }
        if (!controller.signal.aborted) { await client.call({ action: 'commit', table }); if (!controller.signal.aborted) { cursors.current.set(table, cursor); setReadyIdentity(`${scope}:${table}`); setReady(true); setError(''); if (count || !hadSnapshot) setVersion(value => value + 1); } }
      } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? errorText(failure, t) : t("history.historySynchronizationFailedRetryc3eb83")); }
      finally { if (!controller.signal.aborted) { await client.call({ action: 'discard', table }).catch(() => undefined); setSyncing(false); } busy = false; }
    };
    void synchronize();
    const visibleSync = () => { if (document.visibilityState === 'visible') void synchronize(); };
    const timer = setInterval(visibleSync, 30000);
    window.addEventListener('focus', visibleSync); document.addEventListener('visibilitychange', visibleSync); window.addEventListener('yijian:result-adjustment-saved', visibleSync);
    return () => { controller.abort(); void client.call({ action: 'discard', table }).catch(() => undefined); clearInterval(timer); window.removeEventListener('focus', visibleSync); document.removeEventListener('visibilitychange', visibleSync); window.removeEventListener('yijian:result-adjustment-saved', visibleSync); };
  }, [client, scope, table, refresh]);

  React.useEffect(() => {
    if (!client || !visibleReady) return;
    let stale = false;
    void client.call<HistoryQueryResult>({ action: 'query', query: { ...query, table } }).then(value => { if (!stale) { setResult(value); if (value.page !== query.page) setQuery(previous => ({ ...previous, page: value.page })); } }).catch(failure => { if (!stale) setError(failure instanceof Error ? errorText(failure, t) : t("history.localStatisticsFailed747961")); });
    return () => { stale = true; };
  }, [client, visibleReady, version, query, table]);
  React.useEffect(() => {
    if (!selected || !client || !visibleReady) { setSources([]); return; }
    let stale = false; setSources([]); setSourceError(''); setAuditID('');
    void client.call<Source[]>({ action: 'sources', table, group: selected, includeWithdrawn: query.includeWithdrawn }).then(value => { if (!stale) { setSources(value); if (!value.length) setSelected(null); } }).catch(() => { if (!stale) setSourceError(t("history.unableToReadSourceSelectTheLocus6e61ab")); });
    return () => { stale = true; };
  }, [client, selected, visibleReady, table, version, query.includeWithdrawn]);
  React.useEffect(() => {
    setAudit(null); setAuditError(''); if (!auditID) return;
    const controller = new AbortController();
    void focusDetail(auditID, controller.signal).then(value => { if (!controller.signal.aborted) setAudit(value.events); }).catch(failure => { if (!controller.signal.aborted) setAuditError(failure instanceof Error ? errorText(failure, t) : t("history.unableToReadAuditHistoryd97bb2")); });
    return () => controller.abort();
  }, [auditID]);
  React.useEffect(() => {
    if (!selected || !visibleReady) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    sourcePanel.current?.querySelector<HTMLButtonElement>('[data-action="close-source"]')?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setSelected(null); }
      if (event.key !== 'Tab') return;
      const controls = Array.from(sourcePanel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') || []).filter(element => element.getClientRects().length > 0);
      const first = controls[0], last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', close);
    return () => { window.removeEventListener('keydown', close); if (previousFocus?.isConnected) previousFocus.focus(); };
  }, [selected, visibleReady]);
  const filter = (key: string, value: string) => setQuery(previous => ({ ...previous, page: 1, filters: { ...previous.filters, [key]: value } }));
  const sort = (key: string) => setQuery(previous => ({ ...previous, page: 1, sort: key, direction: previous.sort === key && previous.direction === 'desc' ? 'asc' : 'desc' }));
  const chooseType = (next: HistoryType) => { setReady(false); setResult(null); setTable(next); setQuery(initialQuery); setSearch(''); setSelected(null); };
  const openSource = async (row: FocusRow) => {
    const checkedScope = scope;
    try {
      const detail = await focusDetail(row.id, new AbortController().signal);
      if (checkedScope !== activeScope.current) return;
      if (!detail.row.currentSource) { setSourceError(t("history.theExecutionOrDataVersionHasChanged87e38a")); return; }
      router.push(`/tasks/${encodeURIComponent(row.taskUuid)}`);
    } catch { if (checkedScope === activeScope.current) setSourceError(t("history.unableToOpenSourceRefreshAndRetry7a5287")); }
  };
  const activeScope = React.useRef(scope); activeScope.current = scope;
  const sortControl = (key: string, label: string) => {
    const Icon = query.sort === key ? query.direction === 'desc' ? ArrowDown : ArrowUp : ArrowUpDown;
    return <button type="button" aria-label={t("history.sortBy76febe", {p0: String(t(label))})} onClick={() => sort(key)} className="yj-history-sort" data-active={query.sort === key}>{t(label)}<Icon aria-hidden="true" /></button>;
  };
  const filterControl = (key: string, label: string) => <HistoryColumnFilter label={translateUI(label, t)} value={query.filters[key] || ''} numeric={key === 'detectionCount' || key === 'af'} onChange={value => filter(key, value)} />;


  return <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden p-4 md:p-6 yj-history-page" data-testid="history-workspace">
    <header className="yj-history-header">
      <div className="yj-history-heading"><h1>{t("history.detectionHistory2312ad")}</h1><p>{t("history.viewLociSelectedForFocusesAcrossTasks8f76f3")}</p></div>
      <dl className="yj-history-summary">
        <div><dt>{t("history.activeFocusLocie681ab")}</dt><dd>{visibleReady && result ? result.totalVariants.toLocaleString(t.locale) : '—'}</dd></div>
        <div><dt>{t("history.associatedTasks346a3e")}</dt><dd>{visibleReady && result ? result.totalTasks.toLocaleString(t.locale) : '—'}</dd></div>
      </dl>
      <ActionButton action="refresh" variant="secondary" type="button" onClick={() => setRefresh(value => value + 1)} disabled={syncing}>{t("admin.refresh38108e")}</ActionButton>
    </header>
    {(syncing || !visibleReady) && <p className="yj-history-sync" role="status">{syncing ? t("history.synchronizingRecordsReceivede70010", {p0: String(received.toLocaleString(t.locale))}) : t("history.awaitingSynchronization250249")}</p>}
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border-default bg-[var(--yj-panel-bg)]">
      <nav aria-label={t("history.variantType6c1aef")} className="yj-history-type-tabs">{HISTORY_TYPES.map(([key, label]) => <button type="button" key={key} aria-current={table === key ? 'page' : undefined} onClick={() => chooseType(key)}>{t(label)}</button>)}</nav>
      <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="yj-history-toolbar"><div className="relative min-w-48 max-w-sm flex-1"><Search size={15} className="absolute left-2.5 top-2.5 text-fg-muted" /><input aria-label={t("history.searchDetectionHistory2f774f")} value={search} onChange={event => setSearch(event.target.value)} placeholder={t("history.searchLociGenesTasksOrSamplesc09a24")} className="yj-history-search h-9 w-full rounded border border-border-default bg-canvas-default pr-3 text-sm" /></div><label className="flex shrink-0 items-center gap-2 whitespace-nowrap text-sm"><input type="checkbox" checked={query.includeWithdrawn} onChange={event => setQuery(previous => ({ ...previous, includeWithdrawn: event.target.checked, page: 1 }))} />{t("history.includeWithdrawn5de2c7")}</label><ActionButton variant="ghost" type="button" className="yj-tool-button" onClick={() => { setQuery(initialQuery); setSearch(''); }}>{t("history.clearFilters4f761b")}</ActionButton><span className="yj-history-match-count">{visibleReady && result ? t("history.matchingLocid773d6", {p0: String(result.total.toLocaleString(t.locale))}) : ''}</span></div>
        {error && <div role="alert" className="shrink-0 border-b border-danger-muted bg-danger-subtle px-3 py-2 text-sm text-danger-fg">{error}<ActionButton action="retry" variant="ghost" className="ml-3 underline" onClick={() => setRefresh(value => value + 1)}>{t("history.resynchronize55fee3")}</ActionButton></div>}
        <div className="relative min-h-0 flex-1 overflow-auto">
          <table className="yj-history-table w-full table-fixed text-center text-sm">
            <colgroup>{columns.map(([key, , width]) => <col key={key} style={{ width }} />)}<col style={{ width: 112 }} /></colgroup>
            <thead className="yj-history-table-head sticky top-0 z-10">
              <tr>{columns.map(([key, label]) => <th key={key} className="px-4 pt-3 pb-2 font-medium whitespace-nowrap" aria-sort={query.sort === key ? query.direction === 'asc' ? 'ascending' : 'descending' : 'none'}>{sortControl(key, label)}</th>)}<th className="px-4">{t("history.sourcec63f79")}</th></tr>
              <tr>{columns.map(([key, label]) => <th key={key} className="px-4 pb-3 font-normal">
                {key === 'classification' ? <HistoryClassificationFilter value={query.filters[key] || ''} onChange={value => filter(key, value)} />
                  : filterControl(key, label)}
              </th>)}<th /></tr>
            </thead>
            <tbody>{!visibleReady || !result ? <tr><td colSpan={12} className="p-12 text-fg-muted">{error ? t("history.synchronizationIncompleteClickToRetrye0391e") : t("history.synchronizingFocusIndexCompleteStatisticsWillAppearc6d9db")}</td></tr> : result.groups.length === 0 ? <tr><td colSpan={12} className="p-12 text-fg-muted">{result.totalVariants ? t("history.noMatchingHistory62cbfb") : t("history.noLociSelectedForFocusese43c3c")}</td></tr> : result.groups.map(group => <tr key={group.id} className={selected === group.id ? 'bg-accent-subtle' : 'hover:bg-canvas-subtle'}>
              <td className="font-mono text-xs">{group.fields.chromosome || t("history.notProvided071fb2")}</td>
              <td className="font-mono text-xs whitespace-nowrap">{historyPosition(group.fields) || t("history.notProvided071fb2")}{!group.identityKnown && <span className="mt-1 block text-xs text-warning-fg">{t("history.incompleteIdentityIndependentRecordb2810b")}</span>}</td>
              <td className="font-mono text-xs break-all">{group.fields.ref || t("history.notProvided071fb2")}</td>
              <td className="font-mono text-xs break-all">{group.fields.alt || t("history.notProvided071fb2")}</td>
              <td className="whitespace-nowrap">{group.reference || t("history.notProvided071fb2")}</td>
              <td className="break-words font-medium">{group.gene || t("history.notProvided071fb2")}</td>
              <td><ClassBadge value={group.classification} />{group.classification === 'mixed' && <div className="mt-2 break-words text-xs leading-5 text-fg-muted">{Object.entries(group.classificationCounts).map(([value, count]) => `${t(classificationLabel(value))} ${count}`).join(' · ')}</div>}</td>
              <td className="font-semibold tabular-nums">{group.detectionCount}</td>
              <td className="whitespace-nowrap text-xs tabular-nums">{formatTime(group.firstFocusedAt, t)}</td>
              <td className="whitespace-nowrap text-xs tabular-nums">{formatTime(group.lastFocusedAt, t)}</td>
              <td className="break-all font-mono text-xs">{group.fields.gnomadAF || t("history.notProvided071fb2")}</td>
              <td><ActionButton action="view" size="small" variant="ghost" onClick={() => setSelected(group.id)} aria-label={t("history.viewSources19d4ba", {p0: String(group.sourceCount)})} className="!px-2 text-xs">{group.sourceCount} {t("history.recordseb8c2d")}</ActionButton></td>
            </tr>)}</tbody>
          </table>
        </div>
        <footer className="flex h-11 shrink-0 items-center justify-between gap-2 border-t border-border-default px-3 text-xs"><span>{t("history.withdrawnSourcesDoNotCountTowardTasks9b069b")}</span>{result && result.total > query.pageSize && <div className="flex items-center gap-3"><IconActionButton label={t("history.previousb41561")} action="previous" variant="ghost"  disabled={!result || result.page <= 1} onClick={() => setQuery(previous => ({ ...previous, page: previous.page - 1 }))} className="disabled:opacity-30" /><span>{result?.page || 1} / {Math.max(1, Math.ceil((result?.total || 0) / query.pageSize))}</span><IconActionButton label={t("history.next67a246")} action="next" variant="ghost"  disabled={!result || result.page * query.pageSize >= result.total} onClick={() => setQuery(previous => ({ ...previous, page: previous.page + 1 }))} className="disabled:opacity-30" /></div>}</footer>
      </section>
    </div>
    {visibleReady && selected && <div className="fixed inset-0 z-50">
      <div aria-hidden="true" className="absolute inset-0 bg-black/25" onClick={() => setSelected(null)} />
      <aside ref={sourcePanel} role="dialog" aria-modal="true" aria-labelledby="history-source-title" aria-label={t("history.historicalLocusSources702e3e")} className="absolute inset-y-0 right-0 flex w-full max-w-[560px] flex-col border-l border-border-default text-fg-default shadow-[var(--yj-shadow-raised)]" style={{ backgroundColor: 'var(--yj-panel-bg, #ffffff)' }}>
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border-default px-5 py-4">
          <div><h2 id="history-source-title" className="text-base font-semibold">{t("history.focusSourcesAndInterpretationProvenancee9627a")}</h2><p className="mt-1 text-xs text-fg-muted">{sources.length ? t("history.sourceRecordsOriginalExecutionBatchRetainedd4f177", {p0: String(sources.length)}) : t("history.loadingSourceRecordsfbf307")}</p></div>
          <IconActionButton data-action="close-source" label={t("history.closeSource5fd5ba")} action="close" variant="ghost" type="button"  onClick={() => setSelected(null)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border-default hover:bg-canvas-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-emphasis" />
        </header>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-5">
          {sourceError && <p role="alert" className="rounded-lg border border-danger-muted bg-danger-subtle p-3 text-sm text-danger-fg">{sourceError}</p>}
          {!sources.length && !sourceError && <p className="py-8 text-center text-sm text-fg-muted">{t("history.loadingSource388543")}</p>}
          {sources.map(({ row, task }, index) => <article key={row.id} className="overflow-hidden rounded-lg border border-border-default text-sm">
            <div className="border-b border-border-default bg-canvas-subtle p-4">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[11px] text-fg-muted">{t("history.source7bcf14")}{index + 1} · {row.reference || t("history.referenceVersionNotProvidedfbecd7")}</p><h3 className="mt-1 break-words font-semibold">{task?.name || t("history.taskNameNotProvided42e981")}</h3></div><span className={`shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs ${row.focused ? 'border-accent-muted bg-accent-subtle text-accent-fg' : 'border-border-default bg-canvas-subtle text-fg-muted'}`}>{row.focused ? t("history.activeFocusSelectiond9a72c") : t("history.withdrawnc05f5f")}</span></div>
              <p className="mt-3 select-text break-all font-mono text-xs leading-5">{locus(row.fields)}</p>
              <p className="mt-1 break-words text-xs text-fg-muted">{row.fields.gene || t("history.geneNotProvided50c9a2")} · {row.fields.transcript || t("history.transcriptNotProvided52120f")}</p>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 gap-3"><div className="rounded-lg border border-border-default p-3"><p className="mb-2 text-xs text-fg-muted">{t("history.currentEffectiveClassificationfbb295")}</p><ClassBadge value={row.classification} />{row.table==='snv-indel'&&<p className="mt-1 text-xs text-fg-muted">{row.acmgVersion==='svcv4'?t("history.svcVExperimentalNonauthoritativeReference9ccc60"):t("history.currentAcmgEditionb8a846")}{row.vusSubclass?` · ${row.vusSubclass}`:''}</p>}</div><div className="rounded-lg border border-border-default p-3"><p className="mb-2 text-xs text-fg-muted">{t("history.classificationAtFocusing62c832")}</p><ClassBadge value={row.focusedClassification} />{row.table==='snv-indel'&&<p className="mt-1 text-xs text-fg-muted">{row.focusedAcmgVersion==='svcv4'?t("history.svcVExperimentalNonauthoritativeReference9ccc60"):t("history.currentAcmgEditionb8a846")}{row.focusedVusSubclass?` · ${row.focusedVusSubclass}`:''}</p>}</div></div>
              <h4 className="mt-5 text-xs font-semibold">{t("history.sourceIdentity45ad45")}</h4><dl className="mt-2 grid grid-cols-[84px_minmax(0,1fr)] gap-x-3 gap-y-2.5 text-xs leading-5">
                <dt className="text-fg-muted">{t("history.sample610da8")}</dt><dd className="min-w-0 select-text break-words">{task?.internalId || task?.sampleId || t("history.notProvided071fb2")}</dd>
                <dt className="text-fg-muted">{t("history.memberRole2c55d6")}</dt><dd className="min-w-0 break-words">{row.fields.member || row.fields.memberId || row.fields.role || row.fields.memberRole || t("history.notProvided071fb2")}</dd>
                <dt className="text-fg-muted">{t("history.taskIdentifier017af5")}</dt><dd className="min-w-0 select-text break-all font-mono">{row.taskUuid}</dd>
                <dt className="text-fg-muted">{t("history.executionBatchd6015e")}</dt><dd className="min-w-0 select-text break-all font-mono">{row.attemptId}</dd>
              </dl>
              <h4 className="mt-5 border-t border-border-default pt-4 text-xs font-semibold">{t("history.focusSelectionInformation641fd5")}</h4><dl className="mt-2 grid grid-cols-[84px_minmax(0,1fr)] gap-x-3 gap-y-2.5 text-xs leading-5">
                <dt className="text-fg-muted">{t("history.latestFocusSelectiond35135")}</dt><dd className="min-w-0 select-text break-words tabular-nums">{formatTime(row.lastFocusedAt, t)}</dd>
                <dt className="text-fg-muted">{t("history.operatorffb50d")}</dt><dd className="min-w-0 select-text break-all">{row.focusedBy || t("history.notProvided071fb2")}</dd>
              </dl>
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border-default pt-4">
                {task?.currentAttempt === row.attemptId ? <button type="button" onClick={() => void openSource(row)} className="inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-md bg-accent-emphasis px-3 text-xs font-medium text-fg-on-emphasis hover:opacity-90">{t("history.openSourceWorkspace5f1e44")}</button> : <p className="w-full text-xs leading-5 text-fg-muted">{t("history.historicalExecutionSnapshotTaskExecutionBatchHas334159")}</p>}
                <button type="button" className="inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-md border border-border-default px-3 text-xs hover:bg-canvas-subtle" onClick={() => setAuditID(auditID === row.id ? '' : row.id)} aria-expanded={auditID === row.id}>{auditID === row.id ? t("history.collapseChanges4db4f2") : t("history.viewChanges432d99")}</button>
              </div>
              {auditID === row.id && <section className="mt-4 border-t border-border-default pt-4" aria-label={t("history.changeHistorybe740c")}><h4 className="mb-3 text-xs font-semibold">{t("history.changeHistory69ed91")}<span className="font-normal text-fg-muted">{t("history.latestRecords161804")}</span></h4>{auditError ? <p role="alert" className="text-sm text-danger-fg">{auditError}</p> : !audit ? <p className="text-xs text-fg-muted">{t("history.loadingRecords198967")}</p> : !audit.length ? <p className="text-xs text-fg-muted">{t("history.noTraceableChanges530a5f")}</p> : <ol className="space-y-3">{audit.map(event => <li key={event.id} className="rounded-lg bg-canvas-subtle p-3 text-xs leading-5"><div className="flex flex-wrap justify-between gap-x-3 text-fg-muted"><time>{formatTime(event.createdAt, t)}</time><span className="break-all">{event.actor || t("history.unknownOperator62269c")}</span></div><p className="mt-1 whitespace-pre-wrap break-words">{event.reason ? resultHistoryReason(event.reason, t) : t("history.changeHistorybe740c")}</p>{event.before.focused !== event.after.focused && <p className="mt-1 font-medium">{event.after.focused === true ? t("history.includeInFocus233738") : t("history.withdrawFromFocus41c14c")}</p>}{event.after.acmgClassification !== event.before.acmgClassification && <p className="mt-1">{t("history.classification292397")}{t(classificationLabel(String(event.before.acmgClassification || '')))} → {t(classificationLabel(String(event.after.acmgClassification || '')))}</p>}</li>)}</ol>}</section>}
            </div>
          </article>)}
        </div>
        <footer className="shrink-0 border-t border-border-default px-5 py-3 text-xs leading-5 text-fg-muted">{t("history.historyIsReadOnlyOpenTheSourcecd2f54")}</footer>
      </aside>
    </div>}
  </div>;
}
