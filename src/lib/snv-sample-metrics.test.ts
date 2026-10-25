import {describe, expect, it} from 'vitest';
import {readSNVSample, sampleZygosity,sampleRoleSQL} from './snv-sample-metrics';

describe('per-sample SNP/InDel metrics', () => {
  it('recovers the missing trio VAFs from each sample AD without using DP', () => {
    const row={Genotype:'0/1',Zygosity:'Het',VAF:'.',AD:'60,46',Depth:500,Genotype_father:'1/1',Zygosity_father:'Hom',VAF_father:'.',AD_father:'0,88',Genotype_mother:'0|1',VAF_mother:'.',AD_mother:'52,41'};
    expect(readSNVSample(row)).toMatchObject({zygosity:'Heterozygous',alleleFrequency:46/106,vafSource:'ad'});
    expect(readSNVSample(row,'father')).toMatchObject({zygosity:'Homozygous',alleleFrequency:1});
    expect(readSNVSample(row,'mother')).toMatchObject({zygosity:'Heterozygous',alleleFrequency:41/93});
    expect(row.VAF).toBe('.');
  });
  it.each([undefined,null,'','.','NA','NaN'])('does not turn missing VAF %s into zero', VAF => {
    expect(readSNVSample({VAF,AD:'.'}).alleleFrequency).toBeUndefined();
  });
  it.each(['0',0,0.5,'1'])('preserves valid reported VAF %s rather than replacing it', VAF=>{
    expect(readSNVSample({VAF,AD:'60,46'})).toMatchObject({alleleFrequency:Number(VAF),vafSource:'reported'});
  });
  it.each(['0,0','.', '-1,5','1,x','1,2,3','1.5,2','9007199254740992,1'])('leaves unsupported AD %s missing', AD=>{
    expect(readSNVSample({VAF:'.',AD}).alleleFrequency).toBeUndefined();
  });
  it('does not infer one allele fraction from a multiallelic record',()=>{
    expect(readSNVSample({VAF:'.',AD:'10,5',Alt:'A,T'}).alleleFrequency).toBeUndefined();
    expect(readSNVSample({VAF:'.',AD:'10,0',Genotype:'0/0'})).toMatchObject({zygosity:'Reference',alleleFrequency:0});
  });
  it.each([['WT','0/0','Reference'],['.','0|1','Heterozygous'],['.','1|1','Homozygous'],['Hemi','1','Hemizygous'],['.','./.','Unknown'],['.','0/.','Unknown']] as const)('maps %s %s to %s', (label,gt,want)=>{
    expect(sampleZygosity(label,gt)).toBe(want);
  });
});

it('rejects ambiguous or incomplete role permutations',()=>{expect(()=>sampleRoleSQL(['AD'],{proband:'father',father:'father',mother:'mother'})).toThrow('Invalid sample role mapping');});
