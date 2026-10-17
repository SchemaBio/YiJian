// @vitest-environment node
import { File } from 'node:buffer';
import { expect, it } from 'vitest';
import { createTextTranslator } from '@/i18n/text';
import { locales } from '@/i18n/locales';
import { createImportWorkbook, readImportWorkbook } from './import-workbook';
import { parseSampleImport } from './sample-import';
import { localDataTemplate, parseLocalDataCSV } from './local-data-import';

const file = async (blob: Blob) => new File([new Uint8Array(await blob.arrayBuffer())], 'import.xlsx') as unknown as globalThis.File;

it.each(locales)('round-trips the localized sample and path XLSX templates in %s', async locale => {
  const t = createTextTranslator(locale);
  const sample = await createImportWorkbook(t('samples.sampleIdInternalIdSexSampleType463874'));
  expect(new Uint8Array(await sample.arrayBuffer()).slice(0, 2)).toEqual(new Uint8Array([80, 75]));
  const samples = parseSampleImport(await readImportWorkbook(await file(sample), 6));
  expect(samples.issues).toEqual([]);
  expect(samples.rows.length).toBeGreaterThan(0);
  const paths = await createImportWorkbook(localDataTemplate(locale, '/mounted data'));
  const parsed = parseLocalDataCSV(await readImportWorkbook(await file(paths), 3));
  expect(parsed.issues).toEqual([]);
  expect(parsed.rows[0]).toMatchObject({internal_id: 'INT-001', read1_path: '/mounted data/INT-001_R1.fastq.gz', read2_path: '/mounted data/INT-001_R2.fastq.gz'});
});

it('preserves text identifiers, optional blank columns, commas and Excel row numbers', async () => {
  const {default: writeXlsxFile} = await import('write-excel-file/universal');
  const blob = await writeXlsxFile([
    ['Sample ID','Internal ID','Sex','Sample type','Batch','Clinical diagnosis'],
    ['', '000123'],
    [],
    ['', '=1+1', 'unknown', 'DNA', '', 'contains, comma'],
  ]).toBlob();
  const parsed = parseSampleImport(await readImportWorkbook(await file(blob), 6));
  expect(parsed.issues).toEqual([]);
  expect(parsed.rows.map(row => [row.line, row.data.internalId])).toEqual([[2, '000123'], [4, '=1+1']]);
  expect(parsed.rows[1].data.clinicalDiagnosis).toBe('contains, comma');
});

it('rejects renamed CSV, legacy extensions and oversized files before import', async () => {
  await expect(readImportWorkbook(await file(new Blob(['not a workbook'])), 6)).rejects.toMatchObject({messageKey: 'sampleImport.invalidXlsx'});
  await expect(readImportWorkbook(new File(['data'], 'old.csv') as unknown as globalThis.File, 6)).rejects.toMatchObject({messageKey: 'sampleImport.invalidXlsx'});
  await expect(readImportWorkbook(await file(new Blob([new Uint8Array(2 * 1024 * 1024 + 1)])), 6)).rejects.toMatchObject({messageKey: 'sampleImport.tooLarge'});
});
