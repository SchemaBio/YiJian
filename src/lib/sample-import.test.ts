import { expect, it } from 'vitest';
import { parseSampleImport } from './sample-import';
import { createTextTranslator } from '@/i18n/text';
import { locales } from '@/i18n/locales';

it.each(locales)('imports the downloaded %s template', locale => {
  const result = parseSampleImport('\uFEFF' + createTextTranslator(locale)('samples.sampleIdInternalIdSexSampleType463874'));
  expect(result.issues).toEqual([]);
  expect(result.rows[0].data).toMatchObject({ internalId: 'INT-001', gender: 'male', sampleType: '全血' });
  expect(result.rows[0].data).not.toHaveProperty('identityPolicyAcknowledged');
});
const header = 'Sample ID,Internal ID,Sex,Sample type,Batch,Clinical diagnosis\r\n';
it('reads quoted commas, escaped quotes, multiline fields and CRLF', () => {
  const result = parseSampleImport(header + 'S1,I1,female,DNA,B1,"a,b ""quoted""\nnext"\r\n');
  expect(result.issues).toEqual([]);
  expect(result.rows[0]).toMatchObject({ line: 2, data: { clinicalDiagnosis: 'a,b "quoted"\nnext' } });
});
it('rejects wrong headers and malformed quoting', () => {
  expect(() => parseSampleImport('wrong\nvalue')).toThrow();
  expect(() => parseSampleImport(header + 'S,I,male,DNA,B,"unfinished')).toThrow();
});
it('reports duplicate IDs, invalid values and malformed rows', () => {
  const result = parseSampleImport(header + 'S1,I1,male,DNA,B,x\nS2,I1,male,DNA,B,y\nS3,I3,invalid,DNA,B,z\nS4,I4,male,invalid,B,z\nS5,I5');
  expect(result.rows).toHaveLength(1);
  expect(result.issues.map(x => x.key)).toEqual(['sampleImport.duplicate', 'sampleImport.gender', 'sampleImport.type', 'sampleImport.columns']);
});
it('limits the batch size', () => {
  expect(() => parseSampleImport(header + Array.from({ length: 1001 }, (_, i) => `S${i},I${i},male,DNA,B,x`).join('\n'))).toThrow();
});
