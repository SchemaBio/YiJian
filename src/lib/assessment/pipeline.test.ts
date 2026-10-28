import {expect,it} from 'vitest';
import {batchPipeline} from './pipeline';
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
 await p.push(1);await expect(p.push(2)).rejects.toThrow();await p.finish();expect(order).toEqual([1]);
 const broken=batchPipeline(async()=>{throw new Error('failed');},new AbortController().signal);
 await broken.push(1);await expect(broken.finish()).rejects.toThrow('failed');
});
