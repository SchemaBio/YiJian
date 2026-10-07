import { HistoryEngine, type HistoryQuery, type HistoryTask, type HistoryType, type ReportRow } from './history-engine';

const engine = new HistoryEngine();
type Message = { id: number } & (
  { action: 'apply'; rows: ReportRow[]; tasks: Record<string, HistoryTask> } |
  { action: 'begin' | 'commit' | 'discard'; table: HistoryType } |
  { action: 'stage'; table: HistoryType; rows: ReportRow[]; tasks: Record<string, HistoryTask> } |
  { action: 'query'; query: HistoryQuery } |
  { action: 'clear'; table?: HistoryType } |
  { action: 'sources'; table: HistoryType; group: string; includeWithdrawn: boolean }
);
self.onmessage = (event: MessageEvent<Message>) => {
  const message = event.data;
  try {
    let result: unknown;
    if (message.action === 'apply') engine.apply(message.rows, message.tasks);
    else if (message.action === 'begin') engine.begin(message.table);
    else if (message.action === 'stage') engine.stage(message.table, message.rows, message.tasks);
    else if (message.action === 'commit') engine.commit(message.table);
    else if (message.action === 'discard') engine.discard(message.table);
    else if (message.action === 'query') result = engine.query(message.query);
    else if (message.action === 'clear') engine.clear(message.table);
    else if (message.action === 'sources') result = engine.sources(message.table, message.group, message.includeWithdrawn);
    self.postMessage({ id: message.id, result });
  } catch { self.postMessage({ id: message.id, error: '浏览器历史统计失败，请重新同步' }); }
};
