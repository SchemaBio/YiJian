import {describe,it,expect,vi} from 'vitest';
import {readResourcePages} from './resource-pages';
import {api} from './api';
vi.mock('./api',()=>({api:{get:vi.fn()}}));
describe('complete resource transport',()=>{
 it('loads more than 100 resources and removes repeated built-ins',async()=>{
 const items=Array.from({length:105},(_,i)=>({id:String(i)}));
 vi.mocked(api.get).mockImplementation(async(_path,options)=>({items:[{id:'builtin'},...items.slice((Number(options?.params?.page)-1)*100,Number(options?.params?.page)*100)],total:106}));
 const rows=await readResourcePages<{id:string}>('/v1/pipelines');expect(rows).toHaveLength(106);expect(rows.at(-1)?.id).toBe('104');
 });
 it('forwards cancellation rather than returning a partial list',async()=>{
 vi.mocked(api.get).mockRejectedValueOnce(new DOMException('aborted','AbortError'));await expect(readResourcePages('/v1/pipelines',{},new AbortController().signal)).rejects.toThrow('aborted');
 });
});
