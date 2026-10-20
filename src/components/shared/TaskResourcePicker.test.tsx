import * as React from 'react';
import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import {TaskResourcePicker,type ResourcePageRequest} from './TaskResourcePicker';
import type {ResourcePage} from '@/lib/resource-pages';
type Item={id:string;name:string};
function Harness({loadPage}:{loadPage:(request:ResourcePageRequest)=>Promise<ResourcePage<Item>>}) {
 const [selected,setSelected]=React.useState<Item|null>(null);
 return <TaskResourcePicker label="Samples" searchPlaceholder="Search UUID or ID" value={selected?.id??''} selectedItem={selected}
 onSelect={setSelected} loadPage={loadPage} title={item=>item.name}/>;
}
it('searches all pages, resets to page one and preserves the selected item',async()=>{
 const load=vi.fn(async({search,page}:ResourcePageRequest)=>({items:search?[{id:'uuid-105',name:'Outside first 100'}]:[{id:`id-${page}`,name:`Sample ${page}`}],total:search?1:105}));
 render(<Harness loadPage={load}/>);
 fireEvent.click(await screen.findByRole('radio',{name:/Sample 1/}));
 fireEvent.click(screen.getByRole('button',{name:'下一页'}));
 await screen.findByRole('radio',{name:/Sample 2/});
 expect(load).toHaveBeenLastCalledWith(expect.objectContaining({page:2,pageSize:20,search:''}));
 expect(screen.getByText('id-1')).toBeInTheDocument();
 fireEvent.change(screen.getByRole('searchbox'),{target:{value:' UUID-105 '}});
 await screen.findByRole('radio',{name:/Outside first 100/});
 expect(load).toHaveBeenLastCalledWith(expect.objectContaining({page:1,pageSize:20,search:'UUID-105'}));
 expect(screen.getByText('id-1')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:/清除选择/}));
 expect(screen.queryByText('id-1')).not.toBeInTheDocument();
});
it('ignores stale responses after changing the search',async()=>{
 let resolveOld!:(page:ResourcePage<Item>)=>void;
 const load=vi.fn(({search}:ResourcePageRequest)=>search?Promise.resolve({items:[{id:'new',name:'New result'}],total:1}):new Promise<ResourcePage<Item>>(resolve=>{resolveOld=resolve;}));
 render(<Harness loadPage={load}/>);
 fireEvent.change(screen.getByRole('searchbox'),{target:{value:'new'}});
 await screen.findByRole('radio',{name:/New result/});
 await act(async()=>resolveOld({items:[{id:'old',name:'Stale result'}],total:1}));
 expect(screen.queryByRole('radio',{name:/Stale result/})).not.toBeInTheDocument();
 expect(screen.getByRole('radio',{name:/New result/})).toBeEnabled();
 expect(load.mock.calls[0][0].signal.aborted).toBe(true);
});
it('retries a failed page and exposes no selectable stale rows while loading',async()=>{
 const load=vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({items:[{id:'ok',name:'Recovered'}],total:1});
 render(<Harness loadPage={load}/>);
 expect(await screen.findByRole('alert')).toHaveTextContent('offline');
 fireEvent.click(screen.getByRole('button',{name:'重试'}));
 await screen.findByRole('radio',{name:/Recovered/});
 await waitFor(()=>expect(load).toHaveBeenCalledTimes(2));
});
