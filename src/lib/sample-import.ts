import { LocalizedError } from '@/i18n/errors';
import { createTextTranslator } from '@/i18n/text';
import { locales } from '@/i18n/locales';
import type { NewSampleFormData } from '@/app/(main)/samples/components/NewSampleModal';

export interface SampleImportRow { line: number; data: NewSampleFormData; }
export interface SampleImportIssue { line: number; key: string; }
export const MAX_SAMPLE_IMPORT_BYTES = 2 * 1024 * 1024;

// CSV quoting follows the downloaded template, including escaped quotes and
// embedded commas/newlines. A record retains its physical source line.
export function parseCSVRecords(text: string): { line: number; cells: string[] }[] {
 const rows: {line:number; cells:string[]}[]=[];
 let cells:string[]=[], cell='', quoted=false, closed=false, line=1, start=1;
 const value=text.replace(/^\uFEFF/,'');
 for(let i=0;i<value.length;i++) {
  const ch=value[i];
  if(quoted) {
   if(ch==='"') {if(value[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}
   else {cell+=ch;if(ch==='\n')line++;}
   continue;
  }
  if(ch==='"') {if(cell!==''||closed)throw new LocalizedError('sampleImport.invalidCsv');quoted=true;}
  else if(ch===','){cells.push(cell);cell='';closed=false;}
  else if(ch==='\n'||ch==='\r') {
   if(ch==='\r'&&value[i+1]==='\n')i++;
   cells.push(cell);if(cells.some(c=>c.trim()))rows.push({line:start,cells});
   cells=[];cell='';closed=false;line++;start=line;
  } else if(closed) {if(ch!==' '&&ch!=='\t')throw new LocalizedError('sampleImport.invalidCsv');}
  else cell+=ch;
 }
 if(quoted)throw new LocalizedError('sampleImport.invalidCsv');
 cells.push(cell);if(cells.some(c=>c.trim()))rows.push({line:start,cells});
 return rows;
}
const genderValues: Record<string,NewSampleFormData['gender']>={male:'male',m:'male','男':'male',masculino:'male',female:'female',f:'female','女':'female',femenino:'female',unknown:'unknown','未知':'unknown',desconocido:'unknown'};
const typeValues: Record<string,NewSampleFormData['sampleType']>={'全血':'全血','whole blood':'全血','sangre total':'全血','唾液':'唾液',saliva:'唾液',dna:'DNA',adn:'DNA','组织':'组织','組織':'组织',tissue:'组织',tejido:'组织','其他':'其他',other:'其他',otro:'其他'};

export function parseSampleImport(text: string | {line:number;cells:string[]}[]): {rows:SampleImportRow[]; issues:SampleImportIssue[]} {
 const all=typeof text === 'string' ? parseCSVRecords(text) : [...text];
 if(all.length<2)throw new LocalizedError('sampleImport.empty');
 if(all.length>1001)throw new LocalizedError('sampleImport.tooMany');
 const aliases=new Map<string,number>();
 for(const locale of locales) {
  const headers=createTextTranslator(locale)('samples.sampleIdInternalIdSexSampleType463874').split('\n')[0].split(',');
  headers.forEach((header,index)=>aliases.set(header.trim().toLowerCase(),index));
 }
 const header=all.shift()!.cells;
 const indexes=header.map(cell=>aliases.get(cell.trim().toLowerCase()));
 if(header.length!==6||new Set(indexes).size!==6||indexes.some(index=>index===undefined))throw new LocalizedError('sampleImport.headers');
 const rows:SampleImportRow[]=[], issues:SampleImportIssue[]=[];
 const seen=new Set<string>();
 for(const row of all) {
  if(row.cells.length!==6){issues.push({line:row.line,key:'sampleImport.columns'});continue;}
  const cells:string[]=Array(6).fill('');indexes.forEach((column,index)=>{cells[column!]=row.cells[index].trim();});
  const [,internalId,sex,type,batch,clinicalDiagnosis]=cells;
  const gender=sex?genderValues[sex.toLowerCase()]:'unknown';
  const sampleType=type?typeValues[type.toLowerCase()]:'其他';
  let key='';
  if(!internalId||internalId.length>100)key='sampleImport.internalId';
  else if(seen.has(internalId))key='sampleImport.duplicate';
  else if(!gender)key='sampleImport.gender';
  else if(!sampleType)key='sampleImport.type';
  else if(batch.length>100)key='sampleImport.batch';
  seen.add(internalId);
  if(key){issues.push({line:row.line,key});continue;}
  rows.push({line:row.line,data:{internalId,gender,sampleType,batch,clinicalDiagnosis,hpoTerms:[],remark:''}});
 }
 return {rows,issues};
}
