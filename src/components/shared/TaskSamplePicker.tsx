'use client';
import * as React from 'react';
import {useText} from '@/i18n/useText';
import {readResourcePage} from '@/lib/resource-pages';
import {normalizeSampleListItem,type TaskSampleListItem} from '@/lib/task-resources';
import {TaskResourcePicker,type ResourcePageRequest} from './TaskResourcePicker';

export function TaskSamplePicker({selected,onSelect,showSequencingStatus=true,disabled=false}:{selected:TaskSampleListItem|null;onSelect:(sample:TaskSampleListItem|null)=>void;showSequencingStatus?:boolean;disabled?:boolean}) {
  const t=useText();
  const loadPage=React.useCallback(async({search,page,pageSize,signal}:ResourcePageRequest)=>{
    const result=await readResourcePage<unknown>('/v1/samples',{search,page:String(page),page_size:String(pageSize)},signal);
    return {...result,items:result.items.map(normalizeSampleListItem)};
  },[]);
  return <TaskResourcePicker label={t('tasks.selectSample47fc82')} searchPlaceholder={t('resourcePicker.sampleSearch')}
    value={selected?.id??''} selectedItem={selected} onSelect={onSelect} disabled={disabled} loadPage={loadPage}
    title={sample=>sample.internalId||sample.id}
    details={showSequencingStatus?sample=>sample.matchedPair?t('tasks.rRReady50a422'):t('tasks.awaitingSequencingData4671bd'):undefined}/>;
}
