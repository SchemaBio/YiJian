import type {AssessmentRow, AutomaticAssessment, RowProof} from './types';

const scalar=(v:unknown):number|undefined=>{
  if((typeof v!=='string'&&typeof v!=='number')||String(v).trim()===''||v==='.')return;
  const n=Number(v);return Number.isFinite(n)?n:undefined;
};
export function explicitQualityFailure(row:AssessmentRow,p?:RowProof){
  const v=row.values,filter=String(v.Filter??v.FILTER??v.filter??'').trim();
  const dp=p?.proband?.dp??scalar(v.Depth??v.depth),gq=p?.proband?.gq??scalar(v.GQ);
  const gt=String(p?.proband?.gt??v.Genotype??v.GT??'');
  return p?.qualityPassed===false || !!filter&&filter!=='.'&&filter!=='PASS' || dp!==undefined&&dp<10 || gq!==undefined&&gq<20 || /^(0[|/]0|0)$/.test(gt) || p?.proband?.ad!==undefined&&(p.proband.ad[1]??0)<3;
}
export function triageFeatures(row:AssessmentRow){
  const v=row.values;
  const fs=[v.GnomAD_AF,v.gnomAD_AF,v.gnomadAF,v.GnomAD_AF_EAS,v.gnomAD_AF_EAS,v.gnomadEasAF,v.MAX_AF].map(scalar).filter((n):n is number=>n!==undefined&&n>=0&&n<=1);
  const rare=fs.length>0&&Math.max(...fs)<=.001;
  const functional=/\b(stop_gained|frameshift_variant|splice_acceptor_variant|splice_donor_variant|missense_variant|start_lost|stop_lost|inframe_deletion|inframe_insertion)\b/.test(String(v.Consequence??v.consequence??''));
  return {rare,functional};
}
export function priorityScore(row:AssessmentRow,result:AutomaticAssessment){
  const {rare,functional}=triageFeatures(row);
  if(result.classification==='Benign'||result.classification==='Likely_Benign'||result.classificationBasis==='screening_conflict')return 0;
  const clinical=result.classification==='Pathogenic'?60:result.classification==='Likely_Pathogenic'?50:0;
  return Math.min(100,clinical+Math.round(30*(result.phenotypeMatch?.score??result.phenotypeScore))+Number(rare)*5+Number(functional)*5);
}
