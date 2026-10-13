import { expect, it } from 'vitest';
import type { DataAsset } from './data-assets';
import { buildCNVSamplePairs, selectedCNVSamplePairs } from './cnv-sample-pairs';

const asset = (id: string, file_name: string, read_type: 'read1' | 'read2', extra: Partial<DataAsset> = {}): DataAsset => ({ id, file_name, read_type, file_size: 10, provider: 's3', status: 'completed', source: 'upload', created_at: '', updated_at: '', ...extra });

it('pairs by data identifier even when filenames are unrelated', () => {
  const files = [asset('a1', 'one.fastq.gz', 'read1', { internal_id: 'A' }), asset('b2', 'other.fastq.gz', 'read2', { internal_id: 'B' }), asset('a2', 'two.fastq.gz', 'read2', { internal_id: 'A' }), asset('b1', 'another.fastq.gz', 'read1', { internal_id: 'B' })];
  const pairs = buildCNVSamplePairs(files);
  expect(pairs.map(pair => [pair.label, pair.read1.id, pair.read2.id])).toEqual([['A', 'a1', 'a2'], ['B', 'b1', 'b2']]);
  expect(selectedCNVSamplePairs(files, [pairs[1].id, pairs[0].id]).map(pair => [pair.read1.id, pair.read2.id])).toEqual([['b1', 'b2'], ['a1', 'a2']]);
});

it('recognizes UUID prefixes, FASTQ extensions and lane-specific pairs', () => {
  const prefix = '550e8400-e29b-41d4-a716-446655440000_';
  const files = [asset('a1', `${prefix}A_S3_L001_R1_001.fastq.gz`, 'read1'), asset('a2', 'A_S3_L001_R2_001.fastq.gz', 'read2'), asset('b1', 'case.1.fq', 'read1'), asset('b2', 'case.2.fq', 'read2'), asset('wrong-lane', 'A_S3_L002_R2_001.fastq.gz', 'read2')];
  expect(buildCNVSamplePairs(files).map(pair => [pair.read1.id, pair.read2.id])).toEqual([['a1', 'a2'], ['b1', 'b2']]);
});

it('excludes missing, duplicate, expired and conflicting pairs', () => {
  const files = [asset('a1', 'A_R1.fastq', 'read1'), asset('a2', 'A_R2.fastq', 'read2'), asset('a3', 'A_R1.fastq', 'read1'), asset('b1', 'B_R1.fastq', 'read1'), asset('c1', 'C_R1.fastq', 'read1'), asset('c2', 'C_R2.fastq', 'read2', { expires_at: '2020-01-01' }), asset('d1', 'D_R1.fastq', 'read1', { internal_id: 'different-1' }), asset('d2', 'D_R2.fastq', 'read2', { internal_id: 'different-2' }), asset('e1', 'E_R2.fastq', 'read1'), asset('e2', 'E_R1.fastq', 'read2')];
  expect(buildCNVSamplePairs(files)).toEqual([]);
  expect(() => selectedCNVSamplePairs(files, ['a1:a2'])).toThrow('重新选择');
});

it('deduplicates repeated assets and rejects data that expires before submit', () => {
  const files = [asset('a1', 'A_R1.fastq', 'read1'), asset('a2', 'A_R2.fastq', 'read2')];
  expect(buildCNVSamplePairs([...files, files[0]])).toHaveLength(1);
  files[1].expires_at = '2000-01-01';
  expect(() => selectedCNVSamplePairs(files, ['a1:a2'])).toThrow('已不可用');
});
