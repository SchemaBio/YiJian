import { describe, expect, it } from 'vitest';
import { evaluateRow } from './engine';
import { streamAssessmentRows } from './stream';
import type { AssessmentContext } from './types';

const ctx: AssessmentContext = { taskId:'task',attemptId:'attempt',version:'fixed',reference:'hg19',hpo:[],hpoVersion:'none',members:[],availability:[],proofs:{},pack:{version:'pack',reference:'hg19',licenses:[],hpo:{},diseases:[],dosage:[],str:[],imprinting:[]} };
const evaluate = (values: Record<string, unknown>) => evaluateRow({ id:'row',table:'snv-indel',values },ctx);

describe('fast SNV triage', () => {
  it.each([
    ['Pathogenic', 'Pathogenic'], ['Likely_pathogenic', 'Likely_Pathogenic'],
    ['Pathogenic/Likely_pathogenic', 'Likely_Pathogenic'], ['Benign', 'Benign'],
    ['Benign/Likely_benign', 'Likely_Benign'], ['Uncertain_significance', 'VUS'],
  ])('uses known ClinVar %s as a labelled reference', (sig, classification) => {
    const result = evaluate({ ClinVar_Sig:sig,ClinVar_RevStat:'criteria_provided&_multiple_submitters&_no_conflicts' });
    expect(result).toMatchObject({ classification,classificationBasis:'clinvar_reference',state:'evaluated' });
    expect(result.criteria).toHaveLength(0);
    expect(result.screeningNotes?.join(' ')).toContain('PP5/BP6');
  });
  it.each([[0.05,'Benign'],[0.01,'Likely_Benign'],[0.0099,'VUS'],[0,'VUS']])('screens population AF %s without inventing formal criteria', (af, classification) => {
    const result = evaluate({ GnomAD_AF:af });
    expect(result.classification).toBe(classification);
    expect(result.criteria).toHaveLength(0);
  });
  it('uses East Asian frequency even when global frequency is absent', () => {
    expect(evaluate({ GnomAD_AF:'.',GnomAD_AF_EAS:0.1 }).classification).toBe('Benign');
    expect(evaluate({ GnomAD_AF:0,GnomAD_AF_EAS:0.1 }).classification).toBe('Benign');
  });
  it.each(['Conflicting_classifications_of_pathogenicity','Pathogenic/Benign'])('keeps conflicting ClinVar %s for manual review', sig => {
    expect(evaluate({ ClinVar_Sig:sig,GnomAD_AF:0.5 })).toMatchObject({ classification:'VUS',classificationBasis:'screening_conflict',pinned:false });
  });
  it('flags a pathogenic reference with high frequency', () => {
    expect(evaluate({ ClinVar_Sig:'Pathogenic',GnomAD_AF_EAS:0.2 })).toMatchObject({ classification:'VUS',classificationBasis:'screening_conflict',pinned:false });
  });
  it.each(['.', '', null, -0.1, 1.1, '0.1&0.2', true])('does not treat malformed AF %s as evidence', af => {
    expect(evaluate({ GnomAD_AF:af }).classification).toBeUndefined();
  });
  it('gives new variants an explicit VUS triage result', () => {
    expect(evaluate({ Type:'DEL' })).toMatchObject({ classification:'VUS',classificationBasis:'screening_vus' });
    expect(evaluate({})).toMatchObject({ state:'insufficient_evidence' });
  });
  it('keeps calibrated prediction evidence independently of database screening', () => {
    const result = evaluate({ Type:'SNP',Transcript:'ENST1',Consequence:'missense_variant',AlphaMissense_AM:0.99,GnomAD_AF:0.1,ClinVar_Sig:'Benign' });
    expect(result.classification).toBe('Benign');
    expect(result.criteria).toEqual([expect.objectContaining({ code:'PP3',strength:'strong' })]);
    expect(result.classificationBasis).toBe('clinvar_reference');
  });
  it('passes report annotations through the real streaming projection', async () => {
    let sql='';
    const conn={send:async(query:string)=>{sql=query;return (async function*(){yield [{toJSON:()=>({__row_id:'row',ClinVar_Sig:'Benign',GnomAD_AF:0.2})}];})();},cancelSent:async()=>true};
    await streamAssessmentRows(conn as never,'source',['__row_id','ClinVar_Sig','GnomAD_AF'],'snv-indel',async rows=>{
      expect(evaluateRow(rows[0],ctx)).toMatchObject({classification:'Benign',classificationBasis:'clinvar_reference'});
    },new AbortController().signal);
    expect(sql).toContain('"ClinVar_Sig"');
    expect(sql).toContain('"GnomAD_AF"');
  });
  it('evaluates more than 50,000 annotated variants with constant work per row', () => {
    const started=performance.now();
    const counts:Record<string,number>={};
    const fixtures=[{Type:'SNP',GnomAD_AF:0.2,ClinVar_Sig:'Benign'},{Type:'SNP',GnomAD_AF:0.02},{Type:'DEL',GnomAD_AF:0.00001},{Type:'INS',ClinVar_Sig:'Likely_pathogenic'}];
    for(let i=0;i<55393;i++) {const result=evaluate(fixtures[i%fixtures.length]);counts[result.classification!]=(counts[result.classification!]??0)+1;}
    console.info(JSON.stringify({fixture:'fast-snv-55393',milliseconds:Math.round(performance.now()-started),counts}));
    expect(Object.values(counts).reduce((a,b)=>a+b,0)).toBe(55393);
    expect(Object.keys(counts).sort()).toEqual(['Benign','Likely_Benign','Likely_Pathogenic','VUS']);
  });
});
