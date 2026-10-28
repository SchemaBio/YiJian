import {expect,it} from 'vitest';
import {containmentIndex,overlapIndex} from './interval-index';
it('matches exhaustive scans at boundaries and preserves source order',()=>{
 const records=Array.from({length:1000},(_,i)=>({reference:'hg19',chromosome:'1',start:(i*179)%2000,end:(i*179)%2000+1+(i%100)}));
 const contained=containmentIndex(records),overlap=overlapIndex(records);
 for(let start=0;start<2100;start+=13){const region={reference:'hg19',chromosome:'1',start,end:start+37};
 expect(contained(region)).toEqual(records.filter(r=>r.start>=start&&r.end<=region.end));
 expect(overlap(region)).toEqual(records.filter(r=>r.start<region.end&&r.end>start));}
});
