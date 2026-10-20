'use client';
import * as React from 'react';
import {useText} from '@/i18n/useText';
import {type DataAsset} from '@/lib/data-assets';
import {readResourcePage} from '@/lib/resource-pages';
import {getRuntimeBackendFlavor} from '@/lib/runtime-config';
import {Input} from '@schema/ui-kit';
import {TaskResourcePicker,type ResourcePageRequest} from './TaskResourcePicker';

export function VCFTaskFields({assetId,sampleName,onAssetChange,onSampleChange,disabled=false}: {
 assetId:string;sampleName:string;onAssetChange:(id:string)=>void;onSampleChange:(name:string)=>void;disabled?:boolean;
}) {
 const t=useText();const sampleInputId=React.useId();const [selected,setSelected]=React.useState<DataAsset|null>(null);
 const loadPage=React.useCallback(async({search,page,pageSize,signal}:ResourcePageRequest)=>{
  const result=await readResourcePage<DataAsset>('/v1/data/assets',{
   read_type:'vcf',status:'completed',available_only:'true',search,page:String(page),page_size:String(pageSize)
  },signal);
  return {...result,items:result.items.filter(asset=>!asset.expires_at||Date.parse(asset.expires_at)>Date.now())};
 },[]);
 return <section className="min-w-0 space-y-3">
  <TaskResourcePicker label={t('vcfAnnotation.file')} searchPlaceholder={t('resourcePicker.vcfSearch')}
   value={assetId} selectedItem={selected?.id===assetId?selected:null} disabled={disabled} loadPage={loadPage}
   onSelect={asset=>{setSelected(asset);onAssetChange(asset?.id??'');}}
   title={asset=>asset.file_name}
   details={asset=><>{asset.internal_id||'—'}{asset.file_size>0?` · ${(asset.file_size/1024/1024).toLocaleString(t.locale,{maximumFractionDigits:1})} MB`:''}</>}/>
  <label className="block text-sm font-medium" htmlFor={sampleInputId}>{t('vcfAnnotation.sampleName')}</label>
  <Input id={sampleInputId} value={sampleName} onChange={e=>onSampleChange(e.target.value)} maxLength={255} disabled={disabled}/>
  <p className="text-xs text-fg-muted">{t('vcfAnnotation.sampleHint')}</p>
  {getRuntimeBackendFlavor()==='squid'&&<p className="text-xs text-fg-muted">{t('vcfAnnotation.timeBilling')}</p>}
 </section>;
}
