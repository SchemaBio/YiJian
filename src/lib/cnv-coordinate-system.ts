/** Recognize the versioned source BED core; named annotation columns do not alter coordinates. */
export function cnvBEDCoordinateSystem(table:string,columns:readonly string[]):'0-based-half-open'|undefined {
 const last=table==='cnv-segment'?8:table==='cnv-exon'?19:0;
 if(!last||!['Chromosome','Start','End'].every(key=>columns.includes(key)))return undefined;
 const expected=Array.from({length:last-3},(_,i)=>`Col${i+4}`);
 const positional=columns.filter(key=>/^Col[0-9]+$/.test(key));
 return positional.length===expected.length&&expected.every(key=>positional.includes(key))?'0-based-half-open':undefined;
}
