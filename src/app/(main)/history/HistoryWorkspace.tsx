'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, RefreshCw, Search, X } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { ApiError } from '@/lib/api';
import { HistoryWorkerClient, reportDetail, syncReports, type HistoryAudit } from './history-client';
import { CLASS_LABELS, HISTORY_TYPES, locus, type HistoryQuery, type HistoryQueryResult, type HistoryTask, type HistoryType, type ReportRow } from './history-engine';

const initialQuery: Omit<HistoryQuery, 'table'> = { search: '', includeWithdrawn: false, filters: {}, sort: 'detectionCount', direction: 'desc', page: 1, pageSize: 25 };
const columns = [['locus', '位点', 230], ['gene', '基因', 150], ['reference', '参考版本', 110], ['classification', '当前分类', 160], ['detectionCount', '涉及任务数', 110], ['firstReportedAt', '首次回报', 155], ['lastReportedAt', '最近回报', 155], ['af', '人群 AF', 100]] as const;
const formatTime = (value?: string | null) => value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '未提供';
const classificationLabel = (value: string) => CLASS_LABELS[value] || value || '未提供';
function ClassBadge({ value }: { value: string }) {
  const colors: Record<string, string> = { Pathogenic: 'bg-red-50 text-red-700 border-red-200', Likely_Pathogenic: 'bg-orange-50 text-orange-700 border-orange-200', VUS: 'bg-amber-50 text-amber-800 border-amber-200', Likely_Benign: 'bg-teal-50 text-teal-700 border-teal-200', Benign: 'bg-green-50 text-green-700 border-green-200', mixed: 'bg-violet-50 text-violet-700 border-violet-200' };
  return <span className={`inline-block whitespace-nowrap rounded border px-2 py-0.5 text-xs ${colors[value] || 'border-gray-200 bg-gray-50 text-gray-600'}`}>{classificationLabel(value)}</span>;
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
    if (!selected) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close);
  }, [selected]);
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

  return <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden p-4 xl:p-6" data-testid="history-workspace">
    <header className="shrink-0 pb-3"><div className="flex flex-wrap items-center justify-between gap-2">
      <div><h1 className="text-xl font-semibold text-fg-default">历史检出</h1><p className="mt-1 text-xs text-fg-muted">仅统计已选入回报的位点，不代表所有检出位点或人群频率。同一位点按不同任务计数。</p></div>
      <button type="button" onClick={() => setRefresh(value => value + 1)} disabled={syncing} className="flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded border border-border-default px-3 text-sm disabled:opacity-50"><RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />刷新</button>
    </div><div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm"><span>有效回报位点 <strong>{visibleReady && result ? result.totalVariants.toLocaleString() : '—'}</strong></span><span>涉及任务 <strong>{visibleReady && result ? result.totalTasks.toLocaleString() : '—'}</strong></span><span className="text-xs text-fg-muted">{syncing ? `同步中 · 已接收 ${received.toLocaleString()} 条` : visibleReady ? '已同步 · 浏览器本地统计' : '等待同步'}</span></div></header>
    <div className="flex min-h-0 flex-1 overflow-hidden rounded-lg border border-border-default bg-bg-elevated">
      <nav aria-label="变异类型" className="w-36 shrink-0 overflow-y-auto border-r border-border-default bg-bg-subtle p-2">{HISTORY_TYPES.map(([key, label]) => <button type="button" key={key} aria-current={table === key ? 'page' : undefined} onClick={() => chooseType(key)} className={`mb-1 w-full whitespace-nowrap rounded px-3 py-2.5 text-left text-sm ${table === key ? 'bg-blue-50 font-semibold text-blue-700' : 'text-fg-muted hover:bg-bg-elevated'}`}>{label}</button>)}</nav>
      <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border-default p-3"><div className="relative min-w-48 max-w-sm flex-1"><Search size={15} className="absolute left-2.5 top-2.5 text-fg-muted" /><input aria-label="搜索历史检出" value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索位点、基因、任务或样本" className="h-9 w-full rounded border border-border-default bg-bg-default pl-8 pr-3 text-sm" /></div><label className="flex shrink-0 items-center gap-2 whitespace-nowrap text-sm"><input type="checkbox" checked={query.includeWithdrawn} onChange={event => setQuery(previous => ({ ...previous, includeWithdrawn: event.target.checked, page: 1 }))} />包含已撤回</label><button type="button" className="text-xs text-blue-700" onClick={() => { setQuery(initialQuery); setSearch(''); }}>清空筛选</button><span className="text-xs text-fg-muted">{visibleReady && result ? `${result.total.toLocaleString()} 个匹配位点` : ''}</span></div>
        {error && <div role="alert" className="shrink-0 border-b border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}<button className="ml-3 underline" onClick={() => setRefresh(value => value + 1)}>重新同步</button></div>}
        <datalist id="history-presence-options"><option value="未提供" /><option value="已提供" /></datalist><div className="relative min-h-0 flex-1 overflow-auto"><table className="w-full min-w-[1210px] border-collapse text-center text-sm"><thead className="sticky top-0 z-10 bg-bg-subtle shadow-sm">
          <tr>{columns.map(([key, label, width]) => <th key={key} style={{ width, minWidth: width }} className="border-b border-border-default px-2 pt-3 pb-2 font-medium"><button onClick={() => sort(key)}>{label}{query.sort === key ? query.direction === 'desc' ? ' ↓' : ' ↑' : ''}</button></th>)}<th className="w-24 min-w-24 border-b border-border-default">来源</th></tr>
          <tr>{columns.map(([key, label]) => <th key={key} className="border-b border-border-default px-2 pb-2 font-normal">{key === 'classification' ? <select aria-label={`${label}筛选`} value={query.filters[key] || ''} onChange={event => filter(key, event.target.value)} className="h-7 w-full rounded border border-border-default bg-bg-default px-1 text-xs"><option value="">全部</option><option value="__missing">未提供</option>{Object.entries(CLASS_LABELS).filter(([value]) => value).map(([value, text]) => <option value={value} key={value}>{text}</option>)}</select> : <input aria-label={`${label}筛选`} value={query.filters[key] || ''} onChange={event => filter(key, event.target.value)} list="history-presence-options" placeholder={key === 'detectionCount' || key === 'af' ? '例如 >=0.01' : '筛选…'} className="h-7 w-full rounded border border-border-default bg-bg-default px-2 text-center text-xs" />}</th>)}<th className="border-b border-border-default" /></tr>
        </thead><tbody>{!visibleReady || !result ? <tr><td colSpan={9} className="p-12 text-fg-muted">{error ? '同步未完成，点击重新同步' : '正在同步回报索引，完整统计将在同步完成后显示…'}</td></tr> : result.groups.length === 0 ? <tr><td colSpan={9} className="p-12 text-fg-muted">{result.totalVariants ? '没有符合条件的历史记录' : '尚无已选入回报的位点'}</td></tr> : result.groups.map(group => <tr key={group.id} className={`border-b border-border-default ${selected === group.id ? 'bg-blue-50' : 'hover:bg-bg-subtle'}`}>
          <td className="px-3 py-3 font-mono text-xs">{group.locus}{!group.identityKnown && <span className="mt-1 block font-sans text-amber-700">身份不完整，独立记录</span>}</td><td className="px-3 py-3">{group.gene || '未提供'}</td><td className="px-3 py-3">{group.reference || '未提供'}</td><td className="px-2 py-3"><ClassBadge value={group.classification} />{group.classification === 'mixed' && <div className="mt-1 text-[11px] text-fg-muted">{Object.entries(group.classificationCounts).map(([value, count]) => `${classificationLabel(value)} ${count}`).join(' · ')}</div>}</td><td className="px-3 py-3 font-semibold tabular-nums">{group.detectionCount}</td><td className="px-2 py-3 text-xs tabular-nums">{formatTime(group.firstReportedAt)}</td><td className="px-2 py-3 text-xs tabular-nums">{formatTime(group.lastReportedAt)}</td><td className="px-2 py-3 font-mono text-xs">{group.fields.gnomadAF || '未提供'}</td><td className="px-2 py-3"><button onClick={() => setSelected(group.id)} className="whitespace-nowrap text-xs text-blue-700 hover:underline">查看 {group.sourceCount} 条</button></td>
        </tr>)}</tbody></table></div>
        <footer className="flex h-11 shrink-0 items-center justify-between gap-2 border-t border-border-default px-3 text-xs"><span>撤回来源不计入任务数</span><div className="flex items-center gap-3"><button aria-label="上一页" disabled={!result || result.page <= 1} onClick={() => setQuery(previous => ({ ...previous, page: previous.page - 1 }))} className="disabled:opacity-30"><ChevronLeft size={16} /></button><span>{result?.page || 1} / {Math.max(1, Math.ceil((result?.total || 0) / query.pageSize))}</span><button aria-label="下一页" disabled={!result || result.page * query.pageSize >= result.total} onClick={() => setQuery(previous => ({ ...previous, page: previous.page + 1 }))} className="disabled:opacity-30"><ChevronRight size={16} /></button></div></footer>
      </section>
    </div>
    {visibleReady && selected && <aside aria-label="历史位点来源" className="fixed inset-y-0 right-0 z-40 flex w-full max-w-xl flex-col border-l border-border-default bg-bg-elevated shadow-xl"><div className="flex shrink-0 items-center justify-between border-b border-border-default p-4"><h2 className="font-semibold">回报来源与判读追溯</h2><button aria-label="关闭来源" onClick={() => setSelected(null)}><X size={20} /></button></div><div className="flex-1 overflow-auto p-4">
      {sourceError && <p role="alert">{sourceError}</p>}{!sources.length && !sourceError && <p>正在读取来源…</p>}
      {sources.map(({ row, task }) => <article key={row.id} className="mb-3 rounded-lg border border-border-default p-3 text-sm"><div className="flex items-center justify-between gap-2"><strong className="break-all">{task?.name || row.taskUuid}</strong><span className={row.reported ? 'whitespace-nowrap text-blue-700' : 'whitespace-nowrap text-fg-muted'}>{row.reported ? '有效回报' : '已撤回'}</span></div><dl className="mt-2 grid grid-cols-[90px_1fr] gap-x-2 gap-y-1 text-xs">
        <dt className="text-fg-muted">任务编号</dt><dd className="break-all select-text">{row.taskUuid}</dd><dt className="text-fg-muted">样本</dt><dd className="select-text">{task?.internalId || task?.sampleId || '未提供'}</dd><dt className="text-fg-muted">成员 / 角色</dt><dd>{row.fields.member || row.fields.memberId || row.fields.role || row.fields.memberRole || '未提供'}</dd><dt className="text-fg-muted">执行批次</dt><dd className="break-all select-text">{row.attemptId}</dd><dt className="text-fg-muted">原始位点</dt><dd className="break-all select-text">{locus(row.fields)}</dd><dt className="text-fg-muted">转录本</dt><dd className="break-all select-text">{row.fields.transcript || '未提供'}</dd><dt className="text-fg-muted">当前分类</dt><dd><ClassBadge value={row.classification} /></dd><dt className="text-fg-muted">回报时分类</dt><dd>{classificationLabel(row.reportedClassification)}</dd><dt className="text-fg-muted">最近回报</dt><dd>{formatTime(row.lastReportedAt)}</dd><dt className="text-fg-muted">操作者</dt><dd>{row.reportedBy || '未提供'}</dd>
      </dl><div className="mt-3 flex items-center gap-4 text-xs">{task?.currentAttempt === row.attemptId ? <button onClick={() => void openSource(row)} className="text-blue-700 hover:underline">打开来源工作台</button> : <span className="text-fg-muted">历史执行快照，当前任务已更换执行批次</span>}<button className="text-blue-700 hover:underline" onClick={() => setAuditID(row.id)}>查看调整记录</button></div>
        {auditID === row.id && <div className="mt-3 border-t border-border-default pt-3">{auditError ? <p role="alert" className="text-red-700">{auditError}</p> : !audit ? <p>读取记录中…</p> : !audit.length ? <p className="text-fg-muted">没有可追溯的调整事件</p> : <ol className="space-y-2">{audit.map(event => <li key={event.id} className="rounded bg-bg-subtle p-2 text-xs"><div className="text-fg-muted">{formatTime(event.createdAt)} · {event.actor || '操作者未知'}</div><p className="mt-1 whitespace-pre-wrap break-words">{event.reason || '调整记录'}</p>{event.before.reported !== event.after.reported && <p>{event.after.reported === true ? '选入回报' : '撤回回报'}</p>}{event.after.acmgClassification !== event.before.acmgClassification && <p>分类：{classificationLabel(String(event.before.acmgClassification || ''))} → {classificationLabel(String(event.after.acmgClassification || ''))}</p>}</li>)}</ol>}</div>}
      </article>)}
    </div></aside>}
  </div>;
}
