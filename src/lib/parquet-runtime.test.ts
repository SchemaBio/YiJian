import {afterEach,expect,it,vi} from 'vitest';
import {awaitWorkerStartup,configureBrowserRuntime} from './parquet-runtime';
afterEach(()=>vi.useRealTimers());
it('completes worker startup and cancels the deadline',async()=>{
 vi.useFakeTimers(); await awaitWorkerStartup(new EventTarget() as Worker,async()=>{},new AbortController().signal);
 expect(vi.getTimerCount()).toBe(0);
});
it('turns a pending compilation failure into a visible timeout',async()=>{
 vi.useFakeTimers();const pending=awaitWorkerStartup(new EventTarget() as Worker,()=>new Promise(()=>{}),new AbortController().signal,100);
 const error=expect(pending).rejects.toThrow('启动超时');await vi.advanceTimersByTimeAsync(100);await error;
});
it('rejects worker errors without leaking their script URL',async()=>{
 const worker=new EventTarget() as Worker;const pending=awaitWorkerStartup(worker,()=>new Promise(()=>{}),new AbortController().signal);
 worker.dispatchEvent(new Event('error'));await expect(pending).rejects.toThrow('启动失败');
});
it('extends the idle deadline while the engine reports download progress',async()=>{
 vi.useFakeTimers(); let progress!:()=>void; let complete!:()=>void;
 const pending=awaitWorkerStartup(new EventTarget() as Worker,p=>{progress=p;return new Promise<void>(r=>{complete=r;});},new AbortController().signal,100);
 await vi.advanceTimersByTimeAsync(90);progress();await vi.advanceTimersByTimeAsync(90);complete();await pending;
 expect(vi.getTimerCount()).toBe(0);
});

it('loads only pinned same-origin Parquet and JSON extensions and forbids autoload',async()=>{
 const query=vi.fn().mockResolvedValue({});await configureBrowserRuntime({query} as never,'https://yijian.schema-bio.com');
 const sql=query.mock.calls[0][0];
 expect(sql).toContain("custom_extension_repository='https://yijian.schema-bio.com/duckdb/extensions'");
 expect(sql).toContain('LOAD parquet; LOAD json');
 expect(sql).toContain('autoload_known_extensions=false');
 expect(sql).toContain('autoinstall_known_extensions=false');
 expect(sql).not.toContain('extensions.duckdb.org');
 expect(sql).not.toContain('TimeZone');
});
