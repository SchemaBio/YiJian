 'use client';
import * as React from 'react';
import {useText} from '@/i18n/useText';
import {type DataAsset} from '@/lib/data-assets';
import {readResourcePages} from '@/lib/resource-pages';
import {getRuntimeBackendFlavor} from '@/lib/runtime-config';
import {Input} from '@schema/ui-kit';

export function VCFTaskFields({assetId, sampleName, onAssetChange, onSampleChange}: {assetId:string; sampleName:string; onAssetChange:(id:string)=>void; onSampleChange:(name:string)=>void}) {
 const t=useText(); const [assets,setAssets]=React.useState<DataAsset[]>([]); const [failed,setFailed]=React.useState(false); const [retry,setRetry]=React.useState(0);
 React.useEffect(()=>{let cancelled=false; setFailed(false);
 readResourcePages<DataAsset>('/v1/data/assets',{read_type:'vcf',status:'completed'}).then(items=>{if(!cancelled)setAssets(items.filter(a=>!a.expires_at||Date.parse(a.expires_at)>Date.now()));}).catch(()=>{if(!cancelled)setFailed(true);});
 return()=>{cancelled=true;};},[retry]);
 return <section className="space-y-3">
 <label className="block text-sm font-medium">{t('vcfAnnotation.file')}<select required className="mt-1 block w-full rounded-md border border-border-default bg-canvas-default p-2" value={assetId} onChange={e=>onAssetChange(e.target.value)}><option value="">{t('vcfAnnotation.selectFile')}</option>{assets.map(a=><option value={a.id} key={a.id}>{a.file_name} · {a.id}</option>)}</select></label>
 {failed&&<div role="alert"><button type="button" onClick={()=>setRetry(n=>n+1)}>{t('vcfAnnotation.loadError')}</button></div>}
 <label className="block text-sm font-medium">{t('vcfAnnotation.sampleName')}<Input value={sampleName} onChange={e=>onSampleChange(e.target.value)} maxLength={255}/></label>
 <p className="text-xs text-fg-muted">{t('vcfAnnotation.sampleHint')}</p>{getRuntimeBackendFlavor()==='squid' && <p className="text-xs text-fg-muted">{t('vcfAnnotation.timeBilling')}</p>}
 </section>;
}
