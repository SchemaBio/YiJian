// @vitest-environment node
import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { DEMO_MANIFEST } from './policy';
import { DemoSource, type DemoManifest } from './source';
import { demoBackendRow, demoWorkspaceContext, workspaceServices } from './workspace-source';
import { DEFAULT_FILTER_STATE } from '@/app/(main)/tasks/[uuid]/types';

const manifest=JSON.parse(readFileSync('public'+DEMO_MANIFEST,'utf8')) as DemoManifest;
it('maps the static MYH3 row through the same mapper as the formal result table',async()=>{
 const query=vi.fn().mockResolvedValue({total:1,rows:[{__demo_ordinal:3,Gene:'MYH3',Chromosome:'17',Position:'10641317',Ref:'C',Alt:'T',Type:'SNP',Genotype:'0/1',Depth:'45',AD:'23,22',VAF:'0.488889',HGVS_c:'c.2015G>A',HGVS_p:'p.Arg672His',Transcript:'NM_002470.4',ClinVar_Sig:'Pathogenic',GnomAD_AF:'8.996e-7'}]});
 const services=workspaceServices({query} as unknown as DemoSource,manifest);
 const page=await services.getSNVIndels('demo',{...DEFAULT_FILTER_STATE,searchQuery:'MYH3',sortColumn:'position',sortDirection:'asc'});
 expect(page.data[0]).toMatchObject({gene:'MYH3',chromosome:'17',position:10641317,ref:'C',alt:'T',depth:45,hgvsp:'p.Arg672His',clinvarSignificance:'Pathogenic',gnomadAF:8.996e-7});
 expect(query).toHaveBeenCalledWith('snv-indel',expect.objectContaining({search:'MYH3',sort:'Position',pageSize:20}));
 expect(page.data[0].acmgClassification).toBeUndefined();
 await expect(services.pinVariant()).rejects.toThrow('immutable');
 await expect(services.saveResultRowAdjustment()).rejects.toThrow('immutable');
});
it('preserves CNV absolute copy number, exon count and fixed classification',()=>{
 const row=demoBackendRow({__demo_ordinal:1,Gene:'ACTRT2',Chromosome:'1',Start:'3021687',End:'3022820',Type:'Normal',Copy_Number:'2.25',Exon_Count:'4',Log2_Ratio:'0.172024',Classification:'Benign',Total_Score:'0.00'},'cnv-exon',manifest.version);
 expect(row).toMatchObject({copyNumber:'2.25',exonCount:'4',log2Ratio:'0.172024',cnvAssessment:{classification:'Benign',totalScore:0}});
});
it('supplies the original QC components with explicit units and keeps absent tables unknown',()=>{
 const context=demoWorkspaceContext(manifest);
 expect(context.qc[0].metrics.find(m=>m.key==='mappedReadsFraction')).toMatchObject({value:0.998,unit:'fraction'});
 expect(context.qc[0].metrics.find(m=>m.key==='coverageGte30x')).toMatchObject({value:0.6575,unit:'fraction'});
 expect(context.qc[0].metrics.find(m=>m.key==='beforeTotalReads')?.value).toBe(31964466);
 expect(context.types.mei).toBeUndefined();
 expect(context.permissions).toEqual({canReview:false,canFocus:false});
});
