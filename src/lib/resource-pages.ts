import { api } from './api';

export async function readResourcePages<T>(endpoint: string, params: Record<string,string> = {}, signal?: AbortSignal): Promise<T[]> {
  const rows = new Map<string,T>();
  for (let page=1;page<=10000;page++) {
    const response = await api.get<T[] | {items?:T[];total?:number}>(endpoint,{params:{...params,page:String(page),page_size:'100'},signal});
    const items=Array.isArray(response)?response:response.items??[];
    let added=0;
    for(const item of items){const id=String((item as {id?:unknown}).id??'');if(id&&!rows.has(id)){rows.set(id,item);added++;}}
    if (Array.isArray(response)||!items.length||!added|| (typeof response.total==='number'&&rows.size>=response.total)) return [...rows.values()];
  }
  throw new Error('资源列表过大，请缩小搜索范围');
}
