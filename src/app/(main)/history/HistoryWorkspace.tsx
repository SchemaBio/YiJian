'use client';

import * as React from 'react';
import { HoverHint } from '@/components/shared/HoverHint';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, RefreshCw, Search, X } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { ApiError } from '@/lib/api';
import { HistoryWorkerClient, reportDetail, syncReports, type HistoryAudit } from './history-client';
import { CLASS_LABELS, HISTORY_TYPES, locus, type HistoryQuery, type HistoryQueryResult, type HistoryTask, type HistoryType, type ReportRow } from './history-engine';

const initialQuery: Omit<HistoryQuery, 'table'> = { search: '', includeWithdrawn: false, filters: {}, sort: 'detectionCount', direction: 'desc', page: 1, pageSize: 25 };
const columns = [['locus', '位点', 200], ['gene', '基因', 120], ['reference', '参考版本', 90], ['classification', '当前分类', 140], ['detectionCount', '涉及任务数', 110], ['firstReportedAt', '首次回报', 140], ['lastReportedAt', '最近回报', 140], ['af', '人群 AF', 100]] as const;
const formatTime = (value?: string | null) => value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '未提供';
const classificationLabel = (value: string) => CLASS_LABELS[value] || value || '未提供';
function ClassBadge({ value }: { value: string }) {
  return <HoverHint content={value || undefined}><span data-classification={value} className="yj-history-classification">{classificationLabel(value)}</span></HoverHint>;
}
type Source = { row: ReportRow; task?: HistoryTask };

export default function HistoryWorkspace() {
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
    catch { setError('浏览器统计组件无法启动，请检查浏览器设置'); return; }
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
          try { response = await syncReports(table, cursor, watermark, controller.signal); }
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
          if (++catchups > 10) throw new Error('回报记录正在持续更新，请稍后刷新');
        }
        if (!controller.signal.aborted) { await client.call({ action: 'commit', table }); if (!controller.signal.aborted) { cursors.current.set(table, cursor); setReadyIdentity(`${scope}:${table}`); setReady(true); setError(''); if (count || !hadSnapshot) setVersion(value => value + 1); } }
      } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : '历史同步失败，请重试'); }
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
    void client.call<HistoryQueryResult>({ action: 'query', query: { ...query, table } }).then(value => { if (!stale) { setResult(value); if (value.page !== query.page) setQuery(previous => ({ ...previous, page: value.page })); } }).catch(failure => { if (!stale) setError(failure instanceof Error ? failure.message : '本地统计失败'); });
    return () => { stale = true; };
  }, [client, visibleReady, version, query, table]);
  React.useEffect(() => {
    if (!selected || !client || !visibleReady) { setSources([]); return; }
    let stale = false; setSources([]); setSourceError(''); setAuditID('');
    void client.call<Source[]>({ action: 'sources', table, group: selected, includeWithdrawn: query.includeWithdrawn }).then(value => { if (!stale) { setSources(value); if (!value.length) setSelected(null); } }).catch(() => { if (!stale) setSourceError('来源读取失败，请重新选择位点'); });
    return () => { stale = true; };
  }, [client, selected, visibleReady, table, version, query.includeWithdrawn]);
  React.useEffect(() => {
    setAudit(null); setAuditError(''); if (!auditID) return;
    const controller = new AbortController();
    void reportDetail(auditID, controller.signal).then(value => { if (!controller.signal.aborted) setAudit(value.events); }).catch(failure => { if (!controller.signal.aborted) setAuditError(failure instanceof Error ? failure.message : '审计记录读取失败'); });
    return () => controller.abort();
  }, [auditID]);
  React.useEffect(() => {
    if (!selected || !visibleReady) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    sourcePanel.current?.querySelector<HTMLButtonElement>('[aria-label="关闭来源"]')?.focus();
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
  const openSource = async (row: ReportRow) => {
    const checkedScope = scope;
    try {
      const detail = await reportDetail(row.id, new AbortController().signal);
      if (checkedScope !== activeScope.current) return;
      if (!detail.row.currentSource) { setSourceError('该来源的执行或数据版本已变更，请查看历史快照。'); return; }
      router.push(`/tasks/${encodeURIComponent(row.taskUuid)}`);
    } catch { if (checkedScope === activeScope.current) setSourceError('来源无法打开，请刷新后重试。'); }
  };
  const activeScope = React.useRef(scope); activeScope.current = scope;

  return <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden p-4 md:p-6" data-testid="history-workspace">
    <header className="shrink-0 pb-3"><div className="flex flex-wrap items-center justify-between gap-2">
      <div><h1 className="yj-page-title">历史检出</h1><p className="mt-1 text-xs text-fg-muted">仅统计已选入回报的位点，不代表所有检出位点或人群频率。同一位点按不同任务计数。</p></div>
      <button type="button" onClick={() => setRefresh(value => value + 1)} disabled={syncing} className="yj-tool-button shrink-0"><RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />刷新</button>
    </div><div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm"><span>有效回报位点 <strong>{visibleReady && result ? result.totalVariants.toLocaleString() : '—'}</strong></span><span>涉及任务 <strong>{visibleReady && result ? result.totalTasks.toLocaleString() : '—'}</strong></span><span className="text-xs text-fg-muted">{syncing ? `同步中 · 已接收 ${received.toLocaleString()} 条` : visibleReady ? '' : '等待同步'}</span></div></header>
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border-default bg-[var(--yj-panel-bg)]">
      <nav aria-label="变异类型" className="flex shrink-0 gap-1 overflow-x-auto border-b border-border-default px-3 py-2">{HISTORY_TYPES.map(([key, label]) => <button type="button" key={key} aria-current={table === key ? 'page' : undefined} onClick={() => chooseType(key)} className={`shrink-0 whitespace-nowrap rounded-md px-3 py-2 text-sm ${table === key ? 'bg-[var(--yj-sage-subtle)] font-semibold text-accent-fg' : 'text-fg-muted hover:bg-[var(--yj-panel-bg)]'}`}>{label}</button>)}</nav>
      <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border-default p-3"><div className="relative min-w-48 max-w-sm flex-1"><Search size={15} className="absolute left-2.5 top-2.5 text-fg-muted" /><input aria-label="搜索历史检出" value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索位点、基因、任务或样本" className="h-9 w-full rounded border border-border-default bg-canvas-default pl-8 pr-3 text-sm" /></div><label className="flex shrink-0 items-center gap-2 whitespace-nowrap text-sm"><input type="checkbox" checked={query.includeWithdrawn} onChange={event => setQuery(previous => ({ ...previous, includeWithdrawn: event.target.checked, page: 1 }))} />包含已撤回</label><button type="button" className="yj-tool-button" onClick={() => { setQuery(initialQuery); setSearch(''); }}>清空筛选</button><span className="text-xs text-fg-muted">{visibleReady && result ? `${result.total.toLocaleString()} 个匹配位点` : ''}</span></div>
        {error && <div role="alert" className="shrink-0 border-b border-danger-muted bg-danger-subtle px-3 py-2 text-sm text-danger-fg">{error}<button className="ml-3 underline" onClick={() => setRefresh(value => value + 1)}>重新同步</button></div>}
        <datalist id="history-presence-options"><option value="未提供" /><option value="已提供" /></datalist><div className="relative min-h-0 flex-1 overflow-auto"><table className="w-full min-w-[1120px] border-collapse text-center text-sm"><thead className="sticky top-0 z-10 bg-canvas-subtle shadow-sm">
          <tr>{columns.map(([key, label, width]) => <th key={key} style={{ width, minWidth: width }} className="border-b border-border-default px-2 pt-3 pb-2 font-medium"><button onClick={() => sort(key)}>{label}{query.sort === key ? query.direction === 'desc' ? ' ↓' : ' ↑' : ''}</button></th>)}<th className="w-24 min-w-24 border-b border-border-default">来源</th></tr>
          <tr>{columns.map(([key, label]) => <th key={key} className="border-b border-border-default px-2 pb-2 font-normal">{key === 'classification' ? <select aria-label={`${label}筛选`} value={query.filters[key] || ''} onChange={event => filter(key, event.target.value)} className="h-7 w-full rounded border border-border-default bg-canvas-default px-1 text-xs"><option value="">全部</option><option value="__missing">未提供</option>{Object.entries(CLASS_LABELS).filter(([value]) => value).map(([value, text]) => <option value={value} key={value}>{text}</option>)}</select> : <input aria-label={`${label}筛选`} value={query.filters[key] || ''} onChange={event => filter(key, event.target.value)} list="history-presence-options" placeholder={key === 'detectionCount' || key === 'af' ? '例如 >=0.01' : '筛选…'} className="h-7 w-full rounded border border-border-default bg-canvas-default px-2 text-center text-xs" />}</th>)}<th className="border-b border-border-default" /></tr>
        </thead><tbody>{!visibleReady || !result ? <tr><td colSpan={9} className="p-12 text-fg-muted">{error ? '同步未完成，点击重新同步' : '正在同步回报索引，完整统计将在同步完成后显示…'}</td></tr> : result.groups.length === 0 ? <tr><td colSpan={9} className="p-12 text-fg-muted">{result.totalVariants ? '没有符合条件的历史记录' : '尚无已选入回报的位点'}</td></tr> : result.groups.map(group => <tr key={group.id} className={`border-b border-border-default ${selected === group.id ? 'bg-accent-subtle' : 'hover:bg-canvas-subtle'}`}>
          <td className="px-3 py-3 font-mono text-xs">{group.locus}{!group.identityKnown && <span className="mt-1 block font-sans text-warning-fg">身份不完整，独立记录</span>}</td><td className="px-3 py-3">{group.gene || '未提供'}</td><td className="px-3 py-3">{group.reference || '未提供'}</td><td className="px-2 py-3"><ClassBadge value={group.classification} />{group.classification === 'mixed' && <div className="mt-1 text-[11px] text-fg-muted">{Object.entries(group.classificationCounts).map(([value, count]) => `${classificationLabel(value)} ${count}`).join(' · ')}</div>}</td><td className="px-3 py-3 font-semibold tabular-nums">{group.detectionCount}</td><td className="px-2 py-3 text-xs tabular-nums">{formatTime(group.firstReportedAt)}</td><td className="px-2 py-3 text-xs tabular-nums">{formatTime(group.lastReportedAt)}</td><td className="px-2 py-3 font-mono text-xs">{group.fields.gnomadAF || '未提供'}</td><td className="px-2 py-3"><button onClick={() => setSelected(group.id)} className="yj-tool-button">查看 {group.sourceCount} 条</button></td>
        </tr>)}</tbody></table></div>
        <footer className="flex h-11 shrink-0 items-center justify-between gap-2 border-t border-border-default px-3 text-xs"><span>撤回来源不计入任务数</span><div className="flex items-center gap-3"><button aria-label="上一页" disabled={!result || result.page <= 1} onClick={() => setQuery(previous => ({ ...previous, page: previous.page - 1 }))} className="disabled:opacity-30"><ChevronLeft size={16} /></button><span>{result?.page || 1} / {Math.max(1, Math.ceil((result?.total || 0) / query.pageSize))}</span><button aria-label="下一页" disabled={!result || result.page * query.pageSize >= result.total} onClick={() => setQuery(previous => ({ ...previous, page: previous.page + 1 }))} className="disabled:opacity-30"><ChevronRight size={16} /></button></div></footer>
      </section>
    </div>
    {visibleReady && selected && <div className="fixed inset-0 z-50">
      <div aria-hidden="true" className="absolute inset-0 bg-black/25" onClick={() => setSelected(null)} />
      <aside ref={sourcePanel} role="dialog" aria-modal="true" aria-labelledby="history-source-title" aria-label="历史位点来源" className="absolute inset-y-0 right-0 flex w-full max-w-[560px] flex-col border-l border-border-default text-fg-default shadow-[var(--yj-shadow-raised)]" style={{ backgroundColor: 'var(--yj-panel-bg, #ffffff)' }}>
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border-default px-5 py-4">
          <div><h2 id="history-source-title" className="text-base font-semibold">回报来源与判读追溯</h2><p className="mt-1 text-xs text-fg-muted">{sources.length ? `${sources.length} 条来源记录 · 保留原执行批次` : '正在读取来源记录'}</p></div>
          <button type="button" aria-label="关闭来源" onClick={() => setSelected(null)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border-default hover:bg-canvas-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-emphasis"><X size={18} /></button>
        </header>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-5">
          {sourceError && <p role="alert" className="rounded-lg border border-danger-muted bg-danger-subtle p-3 text-sm text-danger-fg">{sourceError}</p>}
          {!sources.length && !sourceError && <p className="py-8 text-center text-sm text-fg-muted">正在读取来源…</p>}
          {sources.map(({ row, task }, index) => <article key={row.id} className="overflow-hidden rounded-lg border border-border-default text-sm">
            <div className="border-b border-border-default bg-canvas-subtle p-4">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[11px] text-fg-muted">来源 {index + 1} · {row.reference || '参考版本未提供'}</p><h3 className="mt-1 break-words font-semibold">{task?.name || '任务名称未提供'}</h3></div><span className={`shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs ${row.reported ? 'border-accent-muted bg-accent-subtle text-accent-fg' : 'border-border-default bg-canvas-subtle text-fg-muted'}`}>{row.reported ? '有效回报' : '已撤回'}</span></div>
              <p className="mt-3 select-text break-all font-mono text-xs leading-5">{locus(row.fields)}</p>
              <p className="mt-1 break-words text-xs text-fg-muted">{row.fields.gene || '基因未提供'} · {row.fields.transcript || '转录本未提供'}</p>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 gap-3"><div className="rounded-lg border border-border-default p-3"><p className="mb-2 text-xs text-fg-muted">当前有效分类</p><ClassBadge value={row.classification} /></div><div className="rounded-lg border border-border-default p-3"><p className="mb-2 text-xs text-fg-muted">回报时分类</p><ClassBadge value={row.reportedClassification} /></div></div>
              <h4 className="mt-5 text-xs font-semibold">来源身份</h4><dl className="mt-2 grid grid-cols-[84px_minmax(0,1fr)] gap-x-3 gap-y-2.5 text-xs leading-5">
                <dt className="text-fg-muted">样本</dt><dd className="min-w-0 select-text break-words">{task?.internalId || task?.sampleId || '未提供'}</dd>
                <dt className="text-fg-muted">成员 / 角色</dt><dd className="min-w-0 break-words">{row.fields.member || row.fields.memberId || row.fields.role || row.fields.memberRole || '未提供'}</dd>
                <dt className="text-fg-muted">任务编号</dt><dd className="min-w-0 select-text break-all font-mono">{row.taskUuid}</dd>
                <dt className="text-fg-muted">执行批次</dt><dd className="min-w-0 select-text break-all font-mono">{row.attemptId}</dd>
              </dl>
              <h4 className="mt-5 border-t border-border-default pt-4 text-xs font-semibold">回报信息</h4><dl className="mt-2 grid grid-cols-[84px_minmax(0,1fr)] gap-x-3 gap-y-2.5 text-xs leading-5">
                <dt className="text-fg-muted">最近回报</dt><dd className="min-w-0 select-text break-words tabular-nums">{formatTime(row.lastReportedAt)}</dd>
                <dt className="text-fg-muted">操作者</dt><dd className="min-w-0 select-text break-all">{row.reportedBy || '未提供'}</dd>
              </dl>
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border-default pt-4">
                {task?.currentAttempt === row.attemptId ? <button type="button" onClick={() => void openSource(row)} className="inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-md bg-accent-emphasis px-3 text-xs font-medium text-fg-on-emphasis hover:opacity-90">打开来源工作台</button> : <p className="w-full text-xs leading-5 text-fg-muted">历史执行快照 · 当前任务已更换执行批次</p>}
                <button type="button" className="inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-md border border-border-default px-3 text-xs hover:bg-canvas-subtle" onClick={() => setAuditID(auditID === row.id ? '' : row.id)} aria-expanded={auditID === row.id}>{auditID === row.id ? '收起调整记录' : '查看调整记录'}</button>
              </div>
              {auditID === row.id && <section className="mt-4 border-t border-border-default pt-4" aria-label="调整记录"><h4 className="mb-3 text-xs font-semibold">调整记录 <span className="font-normal text-fg-muted">· 最近 200 条</span></h4>{auditError ? <p role="alert" className="text-sm text-danger-fg">{auditError}</p> : !audit ? <p className="text-xs text-fg-muted">读取记录中…</p> : !audit.length ? <p className="text-xs text-fg-muted">没有可追溯的调整事件</p> : <ol className="space-y-3">{audit.map(event => <li key={event.id} className="rounded-lg bg-canvas-subtle p-3 text-xs leading-5"><div className="flex flex-wrap justify-between gap-x-3 text-fg-muted"><time>{formatTime(event.createdAt)}</time><span className="break-all">{event.actor || '操作者未知'}</span></div><p className="mt-1 whitespace-pre-wrap break-words">{event.reason || '调整记录'}</p>{event.before.reported !== event.after.reported && <p className="mt-1 font-medium">{event.after.reported === true ? '选入回报' : '撤回回报'}</p>}{event.after.acmgClassification !== event.before.acmgClassification && <p className="mt-1">分类：{classificationLabel(String(event.before.acmgClassification || ''))} → {classificationLabel(String(event.after.acmgClassification || ''))}</p>}</li>)}</ol>}</section>}
            </div>
          </article>)}
        </div>
        <footer className="shrink-0 border-t border-border-default px-5 py-3 text-xs leading-5 text-fg-muted">历史页仅供查看，回报与判读修改请进入来源工作台。</footer>
      </aside>
    </div>}
  </div>;
}
