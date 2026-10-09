'use client';
import {Button} from '@schema/ui-kit';
export function ResourcePager({page,total,onChange,pageSize=20}:{page:number;total:number;onChange:(page:number)=>void;pageSize?:number}){
 if (total === 0) return null;
 if (total <= pageSize) return <div className="py-3 text-xs text-fg-muted">共 {total} 条</div>;
 const pages=Math.max(1,Math.ceil(total/pageSize));
 return <div className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs text-fg-muted"><span>共 {total} 条 · 第 {Math.min(page,pages)} / {pages} 页</span><div className="flex gap-2"><Button size="small" variant="secondary" disabled={page<=1} onClick={()=>onChange(page-1)}>上一页</Button><Button size="small" variant="secondary" disabled={page>=pages} onClick={()=>onChange(page+1)}>下一页</Button></div></div>;
}
