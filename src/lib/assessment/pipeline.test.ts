import {expect,it} from 'vitest';
import {batchPipeline,preparedBatchPipeline} from './pipeline';
it('bounds outstanding batches and preserves order',async()=>{
 const order:number[]=[];let release!:()=>void;
 const gate=new Promise<void>(r=>{release=r;});
 const p=batchPipeline(async(n:number)=>{await gate;order.push(n);},new AbortController().signal);
 await p.push(1);let returned=false;const second=p.push(2).then(()=>{returned=true;});
 await Promise.resolve();expect(returned).toBe(false);release();await second;await p.finish();expect(order).toEqual([1,2]);
});
it('does not consume queued batches after failure or cancellation',async()=>{
 const controller=new AbortController();const order:number[]=[];
 const p=batchPipeline(async(n:number)=>{order.push(n);controller.abort();},controller.signal);
 await p.push(1);try{await p.push(2);}catch{/* Cancellation may be observed by push or finish. */}await p.finish().catch(()=>undefined);expect(order).toEqual([1]);
 const broken=batchPipeline(async()=>{throw new Error('failed');},new AbortController().signal);
 await broken.push(1);await expect(broken.finish()).rejects.toThrow('failed');
});
it('prepares the next batch while computing the current batch',async()=>{
 const prepared:number[]=[],consumed:number[]=[];let release!:()=>void;
 const gate=new Promise<void>(resolve=>{release=resolve;});
 const p=preparedBatchPipeline(async(n:number)=>{prepared.push(n);return n;},async(n:number)=>{if(n===1)await gate;consumed.push(n);},new AbortController().signal);
 await p.push(1);const second=p.push(2);
 await new Promise(resolve=>setTimeout(resolve,0));
 expect(prepared).toEqual([1,2]);expect(consumed).toEqual([]);release();await second;await p.finish();expect(consumed).toEqual([1,2]);
});
it('observes preparation failures and never consumes later batches',async()=>{
 const consumed:number[]=[];
 const p=preparedBatchPipeline(async(n:number)=>{if(n===1)throw undefined;return n;},async(n:number)=>{consumed.push(n);},new AbortController().signal);
 await p.push(1);await p.push(2).catch(()=>undefined);let rejected=false;try{await p.finish();}catch{rejected=true;}
 expect(rejected).toBe(true);expect(consumed).toEqual([]);
});
