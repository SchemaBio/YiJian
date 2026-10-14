'use client';
import * as React from 'react';
import { getRuntimeBackendFlavor } from './runtime-config';

export function useResearchExpiry(deadline: string | undefined, onExpire: () => void) {
 const callback=React.useRef(onExpire);callback.current=onExpire;
 React.useEffect(()=>{
  if(getRuntimeBackendFlavor()!=='squid'||!deadline)return;
  let timer:ReturnType<typeof setTimeout>;
  const check=()=>{
   clearTimeout(timer);
   const left=Date.parse(deadline)-Date.now();
   if(!Number.isFinite(left))return;
   if(left<=0){callback.current();return;}
   timer=setTimeout(check,Math.min(left,60_000));
  };
  check();window.addEventListener('focus',check);
  return()=>{clearTimeout(timer);window.removeEventListener('focus',check);};
 },[deadline]);
}

export function useLiveRetention<T extends {expiresAt?:string}>(items:readonly T[]|null|undefined):T[] {
 const [now,setNow]=React.useState(()=>Date.now());
 const saas=getRuntimeBackendFlavor()==='squid';
 const deadlines=saas?(items??[]).map(x=>Date.parse(x.expiresAt??'')).filter(x=>Number.isFinite(x)&&x>now):[];
 const next=deadlines.length?new Date(Math.min(...deadlines)).toISOString():undefined;
 useResearchExpiry(next,()=>setNow(Date.now()));
 return React.useMemo(()=>(items??[]).filter(x=>!saas||!x.expiresAt||Date.parse(x.expiresAt)>now),[items,now,saas]);
}
