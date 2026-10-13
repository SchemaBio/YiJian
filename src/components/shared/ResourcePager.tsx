'use client';
import { useText } from '@/i18n/useText';


import { ActionButton as Button } from '@/components/shared/ActionButton';


export function ResourcePager({page,total,onChange,pageSize=20}:{page:number;total:number;onChange:(page:number)=>void;pageSize?:number}){
  const t = useText();
 if (total === 0) return null;
 if (total <= pageSize) return <div className="py-3 text-xs text-fg-muted">{t("history.total497064")}{total} {t("history.recordseb8c2d")}</div>;
 const pages=Math.max(1,Math.ceil(total/pageSize));
 return <div className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs text-fg-muted"><span>{t("history.total497064")}{total} {t("common.recordsPage035cae")}{Math.min(page,pages)} / {pages} {t("history.labelaf8438")}</span><div className="flex gap-2"><Button size="small" variant="secondary" disabled={page<=1} onClick={()=>onChange(page-1)}>{t("history.previousb41561")}</Button><Button size="small" variant="secondary" disabled={page>=pages} onClick={()=>onChange(page+1)}>{t("history.next67a246")}</Button></div></div>;
}
