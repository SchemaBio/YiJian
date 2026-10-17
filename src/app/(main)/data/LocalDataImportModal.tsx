'use client';
import * as React from 'react';
import { readImportWorkbook, XLSX_ACCEPT } from '@/lib/import-workbook';
import { AppModal } from '@/components/shared';
import { FilePicker } from '@/components/shared/FilePicker';
import { ActionButton } from '@/components/shared/ActionButton';
import { useText } from '@/i18n/useText';
import { errorText } from '@/i18n/errors';
import { MAX_SAMPLE_IMPORT_BYTES, type SampleImportIssue } from '@/lib/sample-import';
import { api, ApiError } from '@/lib/api';
import {parseLocalDataCSV,type LocalDataRow} from '@/lib/local-data-import';
import type {DataAsset} from '@/lib/data-assets';

type Row = LocalDataRow & {assets?:DataAsset[]} & {status:'pending'|'success'|'error'; error?:string};
export function LocalDataImportModal({onClose,onImported,directory}:{onClose:()=>void;onImported:()=>void;directory:string}) {
 const t=useText();
 const [file,setFile]=React.useState<File|null>(null),[rows,setRows]=React.useState<Row[]>([]),[issues,setIssues]=React.useState<SampleImportIssue[]>([]),[error,setError]=React.useState(''),[busy,setBusy]=React.useState(false),[reading,setReading]=React.useState(false);
 const guard=React.useRef(false),generation=React.useRef(0),mounted=React.useRef(true),request=React.useRef<AbortController|null>(null);
 React.useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;generation.current++;request.current?.abort();};},[]);
 const choose=async(selected:File)=>{
  const current=++generation.current;
  setFile(selected);setRows([]);setIssues([]);setError('');setReading(true);
  try {
   if(selected.size>MAX_SAMPLE_IMPORT_BYTES)throw new Error(t('sampleImport.tooLarge'));
   const parsed=parseLocalDataCSV(await readImportWorkbook(selected, 3));
   if(current===generation.current){setRows(parsed.rows.map(row=>({...row,status:'pending'})));setIssues(parsed.issues);}
  }catch(cause){if(current===generation.current)setError(errorText(cause,t));}
  finally{if(current===generation.current)setReading(false);}
 };
 const submit=async()=>{
  if(guard.current||reading||issues.length||!rows.some(row=>row.status!=='success'))return;
  guard.current=true;setBusy(true);let changed=false;
  try{
   for(const row of rows){
    if(!mounted.current)break;
    if(row.status==='success')continue;
    request.current=new AbortController();
    try{const assets=await api.post<DataAsset[]>('/v1/data/local-import',{internal_id:row.internal_id,read1_path:row.read1_path,read2_path:row.read2_path},{signal:request.current.signal});changed=true;setRows(old=>old.map(item=>item.line===row.line?{...item,status:'success',error:undefined,assets}:item));}
    catch(cause){if(!mounted.current)break;setRows(old=>old.map(item=>item.line===row.line?{...item,status:'error',error:cause instanceof ApiError && cause.status===409 ? t('localDataImport.existing') : localError(cause)}:item));}
   }
  }finally{guard.current=false;if(mounted.current){setBusy(false);if(changed)onImported();}}
 };
 const localError=(cause:unknown)=>{
  if(cause instanceof ApiError){const code=(cause.data as {code?:string}|undefined)?.code;if(code?.startsWith('local_import_'))return t('localDataImport.errors.'+code.slice('local_import_'.length));}
  return errorText(cause,t);
 };
 const succeeded=rows.filter(row=>row.status==='success').length;
 return <AppModal open onOpenChange={open=>{if(!open&&!guard.current)onClose();}} title={t('localDataImport.title')} size="large" footer={<>
  <ActionButton onClick={onClose} disabled={busy}>{t('tasks.close6c14bd')}</ActionButton>
  <ActionButton permission={["data.manage","samples.write"]} action="upload" variant="primary" loading={busy} onClick={()=>void submit()} disabled={reading||issues.length>0||!rows.some(row=>row.status!=='success')}>{t('localDataImport.start')}</ActionButton>
 </>}>
  <p className="mb-3 text-sm text-fg-muted">{t('localDataImport.instructions',{p0:directory})}</p>
  <FilePicker label={t('localDataImport.file')} accept={XLSX_ACCEPT} file={file} onChange={selected=>void choose(selected)} disabled={busy||reading}/>
  {busy&&<p role="status" className="my-3 text-sm">{t('localDataImport.validating')}</p>}
  {reading&&<p role="status">{t('sampleImport.reading')}</p>}
  {error&&<p role="alert" className="mt-3 text-danger-fg">{error}</p>}
  {issues.length>0&&<div role="alert" className="mt-3 text-sm text-danger-fg"><p>{t('sampleImport.fix')}</p><ul>{issues.map(issue=><li key={issue.line}>{t('sampleImport.line',{p0:issue.line})}: {t(issue.key)}</li>)}</ul></div>}
  {rows.length>0&&<><p role="status" className="my-3 text-sm">{t('sampleImport.progress',{p0:rows.length,p1:succeeded,p2:rows.filter(row=>row.status==='error').length})}</p>
   <div className="max-h-80 overflow-auto"><table className="w-full text-left text-sm"><thead><tr><th>{t('sampleImport.row')}</th><th>{t('samples.internalIdadcd0f')}</th><th>Read1 / Read2</th><th>{t('sampleImport.status')}</th></tr></thead><tbody>{rows.map(row=><tr key={row.line} className="border-t border-border-default"><td className="py-2">{row.line}</td><td className="break-all">{row.internal_id}</td><td className="max-w-xs break-all text-xs"><div>{row.read1_path}</div><div>{row.read2_path}</div></td><td>{row.status==='error'?row.error:t('sampleImport.'+row.status)}{row.assets?.map(asset=><div key={asset.id} className="break-all text-xs">{asset.read_type}: {asset.id} · {asset.file_size.toLocaleString(t.locale)} B</div>)}</td></tr>)}</tbody></table></div>
  </>}
 </AppModal>;
}
