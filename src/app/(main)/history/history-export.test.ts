// @vitest-environment node
import readXlsxFile from 'read-excel-file/universal';
import { expect, it } from 'vitest';
import { chineseText } from '@/i18n/text';
import { HISTORY_TYPES, type HistoryGroup, type HistoryType } from './history-engine';
import { createHistoryWorkbook } from './history-export';

it('writes all history tabs as separate sheets and preserves identifiers as text', async () => {
  const variant: HistoryGroup = {
    id: 'mt-1', reference: 'hg19', identityKnown: true, locus: 'MT:16304 T>C', gene: '=MT-DLOOP',
    classification: 'VUS', classificationCounts: { VUS: 1 }, detectionCount: 2,
    firstFocusedAt: '2026-11-06T01:00:00Z', lastFocusedAt: '2026-11-06T02:00:00Z',
    sourceCount: 2, withdrawnCount: 0, fields: { chromosome: 'MT', position: '16304', ref: 'T', alt: 'C' },
  };
  const groups = new Map<HistoryType, HistoryGroup[]>([['mt', [variant]]]);
  const sheets = await readXlsxFile(await createHistoryWorkbook(groups, chineseText));
  expect(sheets.map(sheet => sheet.sheet)).toEqual(HISTORY_TYPES.map(([, label]) => chineseText(label).replace('/', '-')));
  expect(sheets[0].data).toHaveLength(1);
  const mt = sheets.find(sheet => sheet.sheet === chineseText('MT'));
  expect(mt?.data[1]?.slice(0, 8)).toEqual(['MT', '16304', 'T', 'C', 'hg19', '=MT-DLOOP', '意义不明', 2]);
});
