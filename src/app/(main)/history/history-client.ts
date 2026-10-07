import { api } from '@/lib/api';
import type { HistoryTask, HistoryType, ReportRow } from './history-engine';

export interface HistorySync {
  scope: string; cursor: string; watermark: number; complete: boolean;
  rows: ReportRow[]; tasks: Record<string, HistoryTask>;
}
export function syncReports(table: HistoryType, cursor: string, watermark: number | undefined, signal: AbortSignal) {
  return api.get<HistorySync>('/v1/history/sync', { params: { table, cursor, ...(watermark === undefined ? {} : { watermark: String(watermark) }) }, signal });
}
export interface HistoryAudit {
  id: string; actor: string; createdAt: string; reason: string;
  before: Record<string, unknown>; after: Record<string, unknown>;
}
export function reportDetail(id: string, signal: AbortSignal) {
  return api.get<{ row: ReportRow; events: HistoryAudit[] }>(`/v1/history/reports/${encodeURIComponent(id)}`, { signal });
}

export class HistoryWorkerClient {
  private worker: Worker;
  private sequence = 0;
  private failure: Error | null = null;
  private requests = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  constructor() {
    this.worker = new Worker(new URL('./history.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (event: MessageEvent<{ id: number; result: unknown; error?: string }>) => {
      const request = this.requests.get(event.data.id); if (!request) return;
      clearTimeout(request.timer); this.requests.delete(event.data.id);
      if (event.data.error) request.reject(new Error(event.data.error)); else request.resolve(event.data.result);
    };
    this.worker.onerror = () => this.fail(new Error('浏览器统计组件加载失败，请刷新页面'));
  }
  private fail(error: Error) {
    this.failure = error;
    for (const request of this.requests.values()) { clearTimeout(request.timer); request.reject(error); }
    this.requests.clear();
  }
  call<T>(message: Record<string, unknown>): Promise<T> {
    if (this.failure) return Promise.reject(this.failure);
    const id = ++this.sequence;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => { this.requests.delete(id); reject(new Error('浏览器统计超时，请重新同步')); }, 30000);
      this.requests.set(id, { resolve: value => resolve(value as T), reject, timer });
      this.worker.postMessage({ ...message, id });
    });
  }
  dispose() { this.worker.terminate(); this.fail(new Error('历史页面已关闭')); }
}
