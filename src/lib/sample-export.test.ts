import { describe, expect, it } from 'vitest';
import { sampleListCSV } from './sample-export';
import type { Sample } from '@/app/(main)/samples/types';

const sample: Sample = {
  id: 'sample-1', internalId: '编号甲', gender: 'female', age: 0, sampleType: '全血', batch: '批次1',
  clinicalDiagnosis: '诊断,包含"引号"\n第二行', hpoTerms: [{ id: 'HP:0001250', name: '癫痫' }, { id: 'HP:0000252', name: '小头畸形' }],
  matchedPair: null, matchStatus: 'unmatched', matchMode: '', autoMatchEnabled: false, remark: '',
  createdAt: '2026-10-12T01:00:00Z', updatedAt: '2026-10-12T02:00:00Z',
};

describe('sample list CSV', () => {
  it('preserves Chinese, multiline fields, zero age and multi-value HPO terms', () => {
    const csv = sampleListCSV([sample]);
    expect(csv.startsWith('\ufeff')).toBe(true);
    expect(csv).toContain('"编号甲","女","0"');
    expect(csv).toContain('"诊断,包含""引号""\n第二行"');
    expect(csv).toContain('"HP:0001250 癫痫; HP:0000252 小头畸形"');
    expect(csv).toContain('"未匹配","","",""');
    expect(csv.endsWith('\r\n')).toBe(true);
  });
  it('keeps spreadsheet formulas in user fields as literal text', () => {
    const csv = sampleListCSV([{ ...sample, internalId: '=SUM(1,2)', batch: ' @formula', remark: '\t=HYPERLINK("url")' }]);
    expect(csv).toContain('"\'=SUM(1,2)"');
    expect(csv).toContain('"\' @formula"');
    expect(csv).toContain('"\'\t=HYPERLINK(""url"")"');
  });
});
