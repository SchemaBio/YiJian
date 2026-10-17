'use client';
import * as React from 'react';
import { readImportWorkbook, XLSX_ACCEPT } from '@/lib/import-workbook';
import { AppModal } from '@/components/shared';
import { FilePicker } from '@/components/shared/FilePicker';
import { ActionButton } from '@/components/shared/ActionButton';
import { useText } from '@/i18n/useText';
import { errorText } from '@/i18n/errors';
import { MAX_SAMPLE_IMPORT_BYTES, parseSampleImport, type SampleImportRow, type SampleImportIssue } from '@/lib/sample-import';
import { api, ApiError } from '@/lib/api';
import { samplePayload } from '@/lib/samples';

type Row = SampleImportRow & {status:'pending'|'success'|'error'; error?:string};
export function ImportSamplesModal({onClose,onImported}:{onClose:()=>void;onImported:()=>void}) {
 const t=useText();
 const [file,setFile]=React.useState<File|null>(null),[rows,setRows]=React.useState<Row[]>([]),[issues,setIssues]=React.useState<SampleImportIssue[]>([]),[error,setError]=React.useState(''),[busy,setBusy]=React.useState(false),[reading,setReading]=React.useState(false);
 const guard=React.useRef(false),generation=React.useRef(0);
 React.useEffect(()=>()=>{generation.current++;},[]);
 const choose=async(selected:File)=>{
  const current=++generation.current;
  setFile(selected);setRows([]);setIssues([]);setError('');setReading(true);
  try {
   if(selected.size>MAX_SAMPLE_IMPORT_BYTES)throw new Error(t('sampleImport.tooLarge'));
   const parsed=parseSampleImport(await readImportWorkbook(selected, 6));
   if(current===generation.current){setRows(parsed.rows.map(row=>({...row,status:'pending'})));setIssues(parsed.issues);}
  }catch(cause){if(current===generation.current)setError(errorText(cause,t));}
  finally{if(current===generation.current)setReading(false);}
 };
 const submit=async()=>{
  if(guard.current||reading||issues.length||!rows.some(row=>row.status!=='success'))return;
  guard.current=true;setBusy(true);let changed=false;
  try{
   for(const row of rows){
    if(row.status==='success')continue;
    try{await api.post('/v1/samples',samplePayload(row.data));changed=true;setRows(old=>old.map(item=>item.line===row.line?{...item,status:'success',error:undefined}:item));}
    catch(cause){setRows(old=>old.map(item=>item.line===row.line?{...item,status:'error',error:cause instanceof ApiError && cause.status===409 ? t('sampleImport.exists') : errorText(cause,t)}:item));}
   }
  }finally{setBusy(false);guard.current=false;if(changed)onImported();}
 };
 const succeeded=rows.filter(row=>row.status==='success').length;
 return <AppModal open onOpenChange={open=>{if(!open&&!guard.current)onClose();}} title={t('sampleImport.title')} size="large" footer={<>
  <ActionButton onClick={onClose} disabled={busy}>{t('tasks.close6c14bd')}</ActionButton>
  <ActionButton permission="samples.write" action="upload" variant="primary" loading={busy} onClick={()=>void submit()} disabled={reading||issues.length>0||!rows.some(row=>row.status!=='success')}>{t('sampleImport.start')}</ActionButton>
 </>}>
  <p className="mb-3 text-sm text-fg-muted">{t('sampleImport.instructions')}</p>
  <FilePicker label={t('sampleImport.file')} accept={XLSX_ACCEPT} file={file} onChange={selected=>void choose(selected)} disabled={busy||reading}/>
  {reading&&<p role="status">{t('sampleImport.reading')}</p>}
  {error&&<p role="alert" className="mt-3 text-danger-fg">{error}</p>}
  {issues.length>0&&<div role="alert" className="mt-3 text-sm text-danger-fg"><p>{t('sampleImport.fix')}</p><ul>{issues.map(issue=><li key={issue.line}>{t('sampleImport.line',{p0:issue.line})}: {t(issue.key)}</li>)}</ul></div>}
  {rows.length>0&&<><p role="status" className="my-3 text-sm">{t('sampleImport.progress',{p0:rows.length,p1:succeeded,p2:rows.filter(row=>row.status==='error').length})}</p>
   <div className="max-h-80 overflow-auto"><table className="w-full text-left text-sm"><thead><tr><th>{t('sampleImport.row')}</th><th>{t('samples.internalIdadcd0f')}</th><th>{t('samples.batch6b2cf2')}</th><th>{t('sampleImport.status')}</th></tr></thead><tbody>{rows.map(row=><tr key={row.line} className="border-t border-border-default"><td className="py-2">{row.line}</td><td className="break-all">{row.data.internalId}</td><td>{row.data.batch}</td><td>{row.status==='error'?row.error:t('sampleImport.'+row.status)}</td></tr>)}</tbody></table></div>
  </>}
 </AppModal>;
}
