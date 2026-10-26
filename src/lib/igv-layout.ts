import type {IGVBrowser,IGVTrackView} from 'igv';

type Original={height:number;autoHeight?:boolean;coverageTrackHeight?:number};

/** Fit the loaded tracks, preserving the same browser, loci and read data. */
export class IGVTrackLayout {
 private originals=new WeakMap<IGVTrackView,Original>();
 fit(browser:Pick<IGVBrowser,'trackViews'>,viewportHeight:number,contentHeight:number) {
  const views=(browser.trackViews??[]).filter(view=>Number.isFinite(view.track.height));
  const alignments=views.filter(view=>view.track.type==='alignment');
  if(!alignments.length||viewportHeight<=0||contentHeight<=0)return;
  for(const view of views)if(!this.originals.has(view))this.originals.set(view,{height:view.track.height,autoHeight:view.track.autoHeight,coverageTrackHeight:view.track.coverageTrackHeight});
  // Measure the navbar, ideogram, borders and other browser chrome rather than
  // assuming a fixed header size. Every sample gets its own visible viewport.
  const chrome=Math.max(0,contentHeight-views.reduce((sum,view)=>sum+view.track.height,0));
  const budget=Math.max(views.length,Math.floor(viewportHeight-chrome-2));
  const other=views.filter(view=>view.track.type!=='alignment');
  const desired=other.map(view=>Math.min(this.originals.get(view)!.height,view.track.type==='sequence'?25:view.track.type==='ruler'?32:view.track.type==='variant'?32:40));
  const desiredTotal=desired.reduce((a,b)=>a+b,0);
  const otherBudget=Math.min(desiredTotal,Math.floor(budget*.35));
  const heights=new Map<IGVTrackView,number>();
  other.forEach((view,i)=>heights.set(view,Math.max(1,Math.floor(desired[i]*otherBudget/Math.max(1,desiredTotal)))));
  const remaining=budget-[...heights.values()].reduce((a,b)=>a+b,0);
  alignments.forEach(view=>heights.set(view,Math.max(1,Math.floor(remaining/alignments.length))));
  for(const view of views){
   view.track.autoHeight=false;
   const height=heights.get(view)!;
   const coverage=this.originals.get(view)!.coverageTrackHeight;
   const previousCoverage=view.track.coverageTrackHeight;
   if(view.track.type==='alignment'&&coverage!==undefined)view.track.coverageTrackHeight=Math.min(coverage,Math.max(0,Math.floor(height*.22)));
   if(Math.abs(view.track.height-height)>=1||previousCoverage!==view.track.coverageTrackHeight)view.setTrackHeight(height,true);
  }
 }
 restore(browser:Pick<IGVBrowser,'trackViews'>) {
  for(const view of browser.trackViews??[]){
   const original=this.originals.get(view);if(!original)continue;
   view.track.autoHeight=original.autoHeight;
   if(original.coverageTrackHeight!==undefined)view.track.coverageTrackHeight=original.coverageTrackHeight;
   view.setTrackHeight(original.height,true);this.originals.delete(view);
  }
 }
}
