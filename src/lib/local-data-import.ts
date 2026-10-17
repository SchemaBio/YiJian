import {parseCSVRecords} from './sample-import';
import {LocalizedError} from '@/i18n/errors';
import {createTextTranslator} from '@/i18n/text';
import {locales,type Locale} from '@/i18n/locales';
export interface LocalDataRow {line:number;internal_id:string;read1_path:string;read2_path:string;}
export function localDataTemplate(locale:Locale,directory:string):string {
 const headers=createTextTranslator(locale)('localDataImport.headers');
 const root=directory.replace(/\/$/,'');
 return '\uFEFF'+headers+'\r\n'+['INT-001',root+'/INT-001_R1.fastq.gz',root+'/INT-001_R2.fastq.gz'].map(value=>'"'+value.replaceAll('"','""')+'"').join(',')+'\r\n';
}
export function parseLocalDataCSV(text:string | {line:number;cells:string[]}[]):{rows:LocalDataRow[];issues:{line:number;key:string}[]} {
 const records=typeof text === 'string' ? parseCSVRecords(text) : [...text];
 if(records.length<2)throw new LocalizedError('sampleImport.empty');
 if(records.length>1001)throw new LocalizedError('sampleImport.tooMany');
 const aliases=new Map<string,number>();
 for(const locale of locales)createTextTranslator(locale)('localDataImport.headers').split(',').forEach((cell,index)=>aliases.set(cell.trim().toLowerCase(),index));
 const indexes=records.shift()!.cells.map(value=>aliases.get(value.trim().toLowerCase()));
 if(indexes.length!==3||new Set(indexes).size!==3||indexes.some(value=>value===undefined))throw new LocalizedError('localDataImport.headerError');
 const rows:LocalDataRow[]=[],issues:{line:number;key:string}[]=[],paths=new Set<string>();
 for(const record of records){
  if(record.cells.length!==3){issues.push({line:record.line,key:'localDataImport.headerError'});continue;}
  const cells:string[]=Array(3).fill('');indexes.forEach((column,index)=>{cells[column!]=record.cells[index].trim();});
  const [internal_id,read1_path,read2_path]=cells;
  let key='';
  if(!internal_id||internal_id.length>100)key='sampleImport.internalId';
  else if(!read1_path.startsWith('/')||!read2_path.startsWith('/')||read1_path.length>1000||read2_path.length>1000)key='localDataImport.absolute';
  else if(read1_path===read2_path||paths.has(read1_path)||paths.has(read2_path))key='localDataImport.duplicate';
  if(key){issues.push({line:record.line,key});continue;}
  paths.add(read1_path);paths.add(read2_path);rows.push({line:record.line,internal_id,read1_path,read2_path});
 }
 return {rows,issues};
}
