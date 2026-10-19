 'use client';
import * as React from 'react';
import {AppModal} from '@/components/shared';
import {Input} from '@schema/ui-kit';
import {ActionButton as Button} from '@/components/shared/ActionButton';
import {useText} from '@/i18n/useText';
import {errorText} from '@/i18n/errors';
import {api} from '@/lib/api';
export function VCFLocalImportModal({onClose,onImported}:{onClose:()=>void;onImported:()=>void}) {
 const t=useText();const [path,setPath]=React.useState('');const [id,setId]=React.useState('');const [busy,setBusy]=React.useState(false);const [error,setError]=React.useState('');
 const submit=async()=>{if(busy||!id||!path)return;setBusy(true);setError('');try{await api.post('/v1/data/local-import',{internal_id:id,vcf_path:path});onImported();onClose();}catch(e){setError(errorText(e,t));}finally{setBusy(false);}};
 return <AppModal open onOpenChange={open=>{if(!open&&!busy)onClose();}} title={t('vcfAnnotation.import')} footer={<Button permission={['data.manage','samples.write']} loading={busy} disabled={!id||!path||busy} onClick={()=>void submit()}>{t('vcfAnnotation.import')}</Button>}><div className="space-y-4"><label className="block">{t('data.internalIdRecommendedb0481f')}<Input value={id} maxLength={100} disabled={busy} onChange={e=>setId(e.target.value)}/></label><label className="block">{t('vcfAnnotation.path')}<Input value={path} maxLength={1000} disabled={busy} onChange={e=>setPath(e.target.value)}/></label>{error&&<p role="alert" className="text-danger-fg">{error}</p>}</div></AppModal>;
}
