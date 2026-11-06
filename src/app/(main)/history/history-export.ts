import type { SheetData } from 'write-excel-file/universal';
import { LocalizedError } from '@/i18n/errors';
import type { TextTranslator } from '@/i18n/text';
import { HistoryWorkerClient, syncFocuses } from './history-client';
import { CLASS_LABELS, HISTORY_TYPES, historyPosition, type HistoryGroup, type HistoryQueryResult, type HistoryType } from './history-engine';

const maxDataRows = 1_048_575;

export async function createHistoryWorkbook(groups: ReadonlyMap<HistoryType, HistoryGroup[]>, t: TextTranslator): Promise<Blob> {
  const { default: writeXlsxFile } = await import('write-excel-file/universal');
  const headers = ['CHROM', 'POS', 'REF', 'ALT', '参考版本', '基因', '当前分类', '涉及任务数', '首次关注', '最近关注', '人群 AF'];
  const header = headers.map(label => ({ value: t(label), fontWeight: 'bold' as const, backgroundColor: '#E8EFF8' }));
  return writeXlsxFile(HISTORY_TYPES.map(([table, label]) => {
    const rows = groups.get(table) ?? [];
    if (rows.length > maxDataRows) throw new LocalizedError('history.exportTooLarge');
    const data: SheetData = [header, ...rows.map(group => [
      group.fields.chromosome || '', historyPosition(group.fields), group.fields.ref || '', group.fields.alt || '',
      group.reference, group.gene, t(CLASS_LABELS[group.classification] ?? group.classification),
      group.detectionCount, group.firstFocusedAt, group.lastFocusedAt, group.fields.gnomadAF || '',
    ].map(value => ({ value, type: typeof value === 'number' ? Number : String })))];
    return { sheet: t(label).replace(/[\\/?:*\[\]]/g, '-').slice(0, 31), data };
  })).toBlob();
}

export async function downloadHistoryWorkbook(includeWithdrawn: boolean, t: TextTranslator, signal: AbortSignal) {
  const worker = new HistoryWorkerClient();
  const dispose = () => worker.dispose();
  signal.addEventListener('abort', dispose, { once: true });
  try {
    const groups = new Map<HistoryType, HistoryGroup[]>();
    for (const [table] of HISTORY_TYPES) {
      signal.throwIfAborted();
      await worker.call({ action: 'begin', table });
      let cursor = '';
      let watermark: number | undefined;
      for (;;) {
        const page = await syncFocuses(table, cursor, watermark, signal);
        await worker.call({ action: 'stage', table, rows: page.rows, tasks: page.tasks });
        if (page.complete) break;
        cursor = page.cursor;
        watermark = page.watermark;
      }
      await worker.call({ action: 'commit', table });
      const result = await worker.call<HistoryQueryResult>({ action: 'query', query: {
        table, search: '', includeWithdrawn, filters: {}, sort: 'detectionCount', direction: 'desc', page: 1, pageSize: maxDataRows,
      } });
      if (result.total > maxDataRows) throw new LocalizedError('history.exportTooLarge');
      groups.set(table, result.groups);
      await worker.call({ action: 'clear' });
    }
    const blob = await createHistoryWorkbook(groups, t);
    signal.throwIfAborted();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    try {
      link.href = url;
      link.download = `${t('history.detectionHistory2312ad')}.xlsx`;
      document.body.appendChild(link);
      link.click();
    } finally {
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  } finally {
    signal.removeEventListener('abort', dispose);
    dispose();
  }
}
