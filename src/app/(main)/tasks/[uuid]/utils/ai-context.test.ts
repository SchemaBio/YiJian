import { expect, it } from 'vitest';
import type { SNVIndel } from '../types';
import { aiVariantContext } from './ai-context';

it('includes annotation columns outside the old prefixes and excludes operational fields', () => {
  const context = aiVariantContext({ id: 'row', depth: 100, pubmedIds: ['123'], annotationValues: { SIFT_pred: 'deleterious', GT: '0/1', REVEL_score: '0.8', sample_id: 'private', api_key: 'secret', fastq_path: '/private' } } as unknown as SNVIndel);
  expect(context.annotationValues).toEqual({ SIFT_pred: 'deleterious', GT: '0/1', REVEL_score: '0.8' });
  expect(context.depth).toBe(100);
});
