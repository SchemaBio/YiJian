'use client';
import { errorText } from '@/i18n/errors';

import { useText } from '@/i18n/useText';
import { chineseText, type TextTranslator } from '@/i18n/text';

import * as React from 'react';
import { getResultRowAdjustmentHistory, type ResultRowAdjustmentEvent } from '../result-api';

export function ResultChangeHistory({ taskId, table, rowId, active, revision }: { taskId?: string; table: string; rowId: string; active: boolean; revision?: number }) {
  const t = useText();
  const [events, setEvents] = React.useState<ResultRowAdjustmentEvent[]>([]), [loading, setLoading] = React.useState(false), [error, setError] = React.useState('');
  React.useEffect(() => {
    setEvents([]); setError('');
    if (!active || !taskId) return;
    const controller = new AbortController(); setLoading(true);
    void getResultRowAdjustmentHistory(taskId, table, rowId, controller.signal).then(data => { if (!controller.signal.aborted) setEvents(data); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? errorText(cause, t) : t("tasks.unableToLoadChangesc65166")); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [taskId, table, rowId, active, revision]);
  return <div className="space-y-3"><h4 className="text-sm font-semibold">{t("tasks.interpretationChangeHistory8ee03f")}</h4>
    {loading ? <p className="text-sm text-fg-muted">{t("tasks.loading300ee3")}</p> : error ? <p role="alert" className="text-sm text-danger-fg">{error}</p> : !taskId ? <p className="text-sm text-fg-muted">{t("tasks.noAssociatedTask39462d")}</p> : events.length === 0 ? <p className="text-sm text-fg-muted">{t("tasks.noChangesd43ef6")}</p> : events.map(event => <article key={event.id} className="rounded-md border border-border-subtle p-3">
      <div className="flex flex-wrap justify-between gap-2 text-xs text-fg-muted"><span>{event.actor || t("tasks.user9ba763")}</span><time>{event.createdAt ? new Date(event.createdAt).toLocaleString(t.locale) : ''}</time></div>
      <p className="mt-2 text-sm">{event.reason || t("tasks.noReasonProvidedcb9c56")}</p>
      {changes(event.before, event.after, t).map(item => <p key={item.key} className="mt-1 whitespace-pre-wrap break-words text-xs text-fg-muted"><strong>{item.key === 'interpretation' ? t("tasks.manualInterpretation1fcaef") : item.key}：</strong>{item.before} → {item.after}</p>)}
    </article>)}
  </div>;
}
function changes(before: Record<string, unknown> | string, after: Record<string, unknown> | string, t: TextTranslator = chineseText) {
  try {
    const a = typeof before === 'string' ? JSON.parse(before || '{}') : before;
    const b = typeof after === 'string' ? JSON.parse(after || '{}') : after;
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(key => JSON.stringify(a[key]) !== JSON.stringify(b[key])).map(key => ({ key, before: a[key] === undefined ? t("tasks.notSet55a04b") : typeof a[key] === 'string' ? a[key] : JSON.stringify(a[key]), after: b[key] === undefined ? t("tasks.notSet55a04b") : typeof b[key] === 'string' ? b[key] : JSON.stringify(b[key]) }));
  } catch { return []; }
}
