'use client';
import * as React from 'react';
import { getResultRowAdjustmentHistory, type ResultRowAdjustmentEvent } from '../result-api';

export function ResultChangeHistory({ taskId, table, rowId, active, revision }: { taskId?: string; table: string; rowId: string; active: boolean; revision?: number }) {
  const [events, setEvents] = React.useState<ResultRowAdjustmentEvent[]>([]), [loading, setLoading] = React.useState(false), [error, setError] = React.useState('');
  React.useEffect(() => {
    setEvents([]); setError('');
    if (!active || !taskId) return;
    const controller = new AbortController(); setLoading(true);
    void getResultRowAdjustmentHistory(taskId, table, rowId, controller.signal).then(data => { if (!controller.signal.aborted) setEvents(data); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : '变更记录加载失败'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [taskId, table, rowId, active, revision]);
  return <div className="space-y-3"><h4 className="text-sm font-semibold">判读变更记录</h4>
    {loading ? <p className="text-sm text-fg-muted">加载中…</p> : error ? <p role="alert" className="text-sm text-danger-fg">{error}</p> : !taskId ? <p className="text-sm text-fg-muted">未关联任务</p> : events.length === 0 ? <p className="text-sm text-fg-muted">暂无调整记录</p> : events.map(event => <article key={event.id} className="rounded-md border border-border-subtle p-3">
      <div className="flex flex-wrap justify-between gap-2 text-xs text-fg-muted"><span>{event.actor || '用户'}</span><time>{event.createdAt ? new Date(event.createdAt).toLocaleString() : ''}</time></div>
      <p className="mt-2 text-sm">{event.reason || '未填写理由'}</p>
      {changes(event.before, event.after).map(item => <p key={item.key} className="mt-1 whitespace-pre-wrap break-words text-xs text-fg-muted"><strong>{item.key === 'interpretation' ? '人工解读' : item.key}：</strong>{item.before} → {item.after}</p>)}
    </article>)}
  </div>;
}
function changes(before: Record<string, unknown> | string, after: Record<string, unknown> | string) {
  try {
    const a = typeof before === 'string' ? JSON.parse(before || '{}') : before;
    const b = typeof after === 'string' ? JSON.parse(after || '{}') : after;
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(key => JSON.stringify(a[key]) !== JSON.stringify(b[key])).map(key => ({ key, before: a[key] === undefined ? '未设置' : typeof a[key] === 'string' ? a[key] : JSON.stringify(a[key]), after: b[key] === undefined ? '未设置' : typeof b[key] === 'string' ? b[key] : JSON.stringify(b[key]) }));
  } catch { return []; }
}
