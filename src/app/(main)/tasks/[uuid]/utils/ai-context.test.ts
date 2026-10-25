import { expect, it } from 'vitest';
import type { SNVIndel } from '../types';
import { aiVariantContext } from './ai-context';

it('includes annotation columns outside the old prefixes and excludes operational fields', () => {
  const context = aiVariantContext({ id: 'row', depth: 100, pubmedIds: ['123'], annotationValues: { SIFT_pred: 'deleterious', GT: '0/1', REVEL_score: '0.8', sample_id: 'private', api_key: 'secret', fastq_path: '/private' } } as unknown as SNVIndel);
  expect(context.annotationValues).toEqual({ SIFT_pred: 'deleterious', GT: '0/1', REVEL_score: '0.8' });
  expect(context.depth).toBe(100);
});

it('keeps named trio genotypes, true zero VAF and missing data distinct without sample identities',()=>{
 const context=aiVariantContext({proband:{genotype:'1|0',zygosity:'Heterozygous',alleleDepth:'63,68',alleleFrequency:68/131,sampleId:'private'},father:{genotype:'0/0',zygosity:'Reference',alleleDepth:'53,0',alleleFrequency:0},mother:{genotype:'0/1',zygosity:'Heterozygous',alleleDepth:'58,59',alleleFrequency:59/117}} as unknown as SNVIndel);
 expect(context.sampleGenotypes).toEqual({proband:{genotype:'1|0',zygosity:'Heterozygous',alleleDepth:'63,68',alleleFrequency:68/131},father:{genotype:'0/0',zygosity:'Reference',alleleDepth:'53,0',alleleFrequency:0},mother:{genotype:'0/1',zygosity:'Heterozygous',alleleDepth:'58,59',alleleFrequency:59/117}});
 expect(aiVariantContext({proband:{zygosity:'Unknown'}} as unknown as SNVIndel).sampleGenotypes).toEqual({proband:{zygosity:'Unknown'}});
});
