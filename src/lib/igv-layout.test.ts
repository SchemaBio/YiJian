import {expect,it,vi} from 'vitest';
import type {IGVTrackView} from 'igv';
import {IGVTrackLayout} from './igv-layout';
function view(type:string,height:number):IGVTrackView {
 const result={track:{type,height,autoHeight:true,...(type==='alignment'?{coverageTrackHeight:50}:{})},setTrackHeight:vi.fn((next:number)=>{result.track.height=next;})};return result;
}
it.each([420,560,720,980])('keeps all three sample viewports within %s px with browser chrome, annotation and VCF tracks',height=>{
 const views=[view('ruler',40),view('sequence',25),view('annotation',300),...Array.from({length:3},()=>view('variant',200)),...Array.from({length:3},()=>view('alignment',180))];
 const browser={trackViews:views},layout=new IGVTrackLayout();const total=()=>views.reduce((sum,v)=>sum+v.track.height,0);
 layout.fit(browser,height,total()+90);
 expect(total()+90).toBeLessThanOrEqual(height);expect(views.filter(v=>v.track.type==='alignment')).toHaveLength(3);
 for(const v of views.filter(v=>v.track.type==='alignment')){expect(v.track.height).toBeGreaterThan(30);expect(v.track.height-(v.track.coverageTrackHeight??0)).toBeGreaterThan(20);expect(v.track.autoHeight).toBe(false);}
 layout.fit(browser,height,total()+90);const fitted=views.map(v=>v.track.height);layout.fit(browser,height,total()+90);expect(views.map(v=>v.track.height)).toEqual(fitted);
 layout.restore(browser);expect(views.map(v=>v.track.height)).toEqual([40,25,300,200,200,200,180,180,180]);expect(views.every(v=>v.track.autoHeight)).toBe(true);expect(views.at(-1)?.track.coverageTrackHeight).toBe(50);
});
it('grows reads with the viewport and restores the original heights after repeated resizes',()=>{
 const views=Array.from({length:3},()=>view('alignment',180)),browser={trackViews:views},layout=new IGVTrackLayout();
 layout.fit(browser,900,630);expect(views[0].track.height).toBeGreaterThan(180);
 layout.fit(browser,500,views.reduce((s,v)=>s+v.track.height,0)+90);expect(views[0].track.height).toBeLessThan(180);
 layout.restore(browser);expect(views.every(v=>v.track.height===180&&v.track.coverageTrackHeight===50)).toBe(true);
});
it('ignores an unmeasured container or a disposed/uninitialized browser',()=>{
 const layout=new IGVTrackLayout();expect(()=>layout.fit({},0,0)).not.toThrow();const v=view('alignment',180);layout.fit({trackViews:[v]},0,270);expect(v.setTrackHeight).not.toHaveBeenCalled();
});
