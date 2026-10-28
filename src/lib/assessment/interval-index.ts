import type {Interval} from './types';
// Start-sorted containment lookup, returning the original reference order.
export function containmentIndex<T extends Interval>(records:T[]) {
 const sorted=records.map((record,order)=>({record,order})).sort((a,b)=>a.record.start-b.record.start||a.order-b.order);
 return (region:Interval):T[]=>{
  let low=0,high=sorted.length;
  while(low<high){const mid=(low+high)>>>1;if(sorted[mid].record.start<region.start)low=mid+1;else high=mid;}
  const found:typeof sorted=[];
  for(let i=low;i<sorted.length&&sorted[i].record.start<region.end;i++){
   const item=sorted[i];if(item.record.end<=region.end)found.push(item);
  }
  return found.sort((a,b)=>a.order-b.order).map(x=>x.record);
 };
}

export function overlapIndex<T extends Interval>(records:T[]) {
 const sorted=records.map((record,order)=>({record,order})).sort((a,b)=>a.record.start-b.record.start||a.order-b.order);
 const ends:number[]=[];let maximum=-Infinity;
 for(const item of sorted){maximum=Math.max(maximum,item.record.end);ends.push(maximum);}
 return (region:Interval):T[]=>{
  let low=0,high=ends.length;
  while(low<high){const mid=(low+high)>>>1;if(ends[mid]<=region.start)low=mid+1;else high=mid;}
  const found:typeof sorted=[];
  for(let i=low;i<sorted.length&&sorted[i].record.start<region.end;i++)if(sorted[i].record.end>region.start)found.push(sorted[i]);
  return found.sort((a,b)=>a.order-b.order).map(x=>x.record);
 };
}
