import { getIGVSession, getIGVTrackURLs } from '../result-api';

export interface CNRBin {
  chromosome: string; start: number; end: number; log2: number;
  gene: string; weight: number | null;
}
export const normalizeContig = (value: string) => value.replace(/^chr/i, '').toUpperCase().replace(/^M$/, 'MT');
// Only parsed data is cached. Authorization is checked again on every opening;
// signed URLs are never retained. Two task/version entries bound memory use.
const cache = new Map<string, CNRBin[]>();
async function readCNR(url: string, signal: AbortSignal): Promise<CNRBin[]> {
  const response = await fetch(url, {signal, credentials:'omit', referrerPolicy:'no-referrer', cache:'no-store'});
  if (!response.ok || !response.body) throw new Error('CNR 对象不可读取，请检查授权和 COS 浏览器访问配置');
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let text = '', bytes = 0;
  try {
    for (;;) {
      const chunk = await reader.read(); if(chunk.done)break;
      bytes += chunk.value.byteLength;
      if(bytes > 32*1024*1024)throw new Error('CNR 超过浏览器读取上限（32 MiB）');
      text += decoder.decode(chunk.value,{stream:true});
    }
    text += decoder.decode();
  } finally { await reader.cancel(); }
  const lines=text.split(/\r?\n/).filter(line=>line.trim()&&!line.startsWith('#'));
  const fields=lines.shift()?.split('\t').map(field=>field.toLowerCase())??[];
  const indexes=['chromosome','start','end','log2'].map(field=>fields.indexOf(field));
  if(indexes.some(index=>index<0))throw new Error('CNR 缺少 chromosome/start/end/log2 列');
  const result:CNRBin[]=[];
  for(const line of lines){
    const parts=line.split('\t');
    if(indexes.some(index=>!parts[index]||parts[index]==='.'))continue;
    const [chromosome,start,end,log2]=indexes.map(index=>parts[index]);
    const rawWeight=parts[fields.indexOf('weight')];
    const weight=rawWeight?.trim()&&rawWeight!=='.'?Number(rawWeight):NaN;
    const bin={chromosome,start:Number(start),end:Number(end),log2:Number(log2),gene:parts[fields.indexOf('gene')]??'',weight:Number.isFinite(weight)&&weight>0?weight:null};
    if(Number.isSafeInteger(bin.start)&&Number.isSafeInteger(bin.end)&&bin.start>=0&&bin.end>bin.start&&Number.isFinite(bin.log2))result.push(bin);
  }
  if(!result.length)throw new Error('CNR 没有有效信号');
  return result;
}
export async function loadCNR(taskId:string, attemptId:string|undefined, signal:AbortSignal):Promise<CNRBin[]> {
  const session=await getIGVSession(taskId,signal);
  if(attemptId&&session.executionAttemptId!==attemptId)throw new Error('执行版本已改变，请重新加载结果');
  const track=session.tracks?.find(track=>track.format==='cnr'&&track.available);
  if(!track)throw new Error('当前归档未提供原始 CNR，无法生成逐外显子信号');
  const key=`${taskId}/${session.executionAttemptId}/${session.version}`;
  const cached=cache.get(key);if(cached)return cached;
  const signed=await getIGVTrackURLs(taskId,session.version,[track.id],signal);
  const target=signed.tracks.find(value=>value.id===track.id);
  if(!target)throw new Error('CNR 读取授权缺失');
  const bins=await readCNR(target.url,signal);
  if(signal.aborted)throw new DOMException('Aborted','AbortError');
  if(cache.size>=2)cache.delete(cache.keys().next().value!);
  cache.set(key,bins);return bins;
}

export interface ExonSignal { exon:string; start:number; end:number; log2:number; cn:number; bins:number; }
export function exonSignals(bins:CNRBin[],gene:string,chromosome:string):Map<string,ExonSignal[]> {
  const groups=new Map<string,Map<string,CNRBin[]>>();
  for(const bin of bins){
    if(normalizeContig(bin.chromosome)!==normalizeContig(chromosome))continue;
    // Pipeline target annotation: gene|transcript|ensembl|exon|strand|band.
    // Never invent exon numbers from bin positions or the gene-level exon count.
    for(const annotation of bin.gene.split(/[;,]/)){
      const parts=annotation.trim().split('|');
      if(parts[0]!==gene||!parts[1]||!parts[3]||['.','-','NA'].includes(parts[3]))continue;
      const transcript=parts[1],exon=parts[3];
      const exons=groups.get(transcript)??new Map<string,CNRBin[]>();
      const members=exons.get(exon)??[];if(!members.includes(bin))members.push(bin);
      exons.set(exon,members);groups.set(transcript,exons);
    }
  }
  const result=new Map<string,ExonSignal[]>();
  for(const [transcript,exons] of groups){
    const rows:ExonSignal[]=[];
    for(const [exon,members] of exons){
      // Use CNR weights only when every bin has a usable weight. Otherwise
      // aggregate the entire exon by bin span, so weight units never mix.
      const weighted=members.every(bin=>bin.weight!==null);
      let sum=0,weights=0;
      for(const bin of members){const weight=weighted?bin.weight!:bin.end-bin.start;sum+=bin.log2*weight;weights+=weight;}
      const log2=sum/weights,cn=2*Math.pow(2,log2);
      if(Number.isFinite(cn))rows.push({exon,start:Math.min(...members.map(b=>b.start)),end:Math.max(...members.map(b=>b.end)),log2,cn,bins:members.length});
    }
    rows.sort((a,b)=>a.exon.localeCompare(b.exon,undefined,{numeric:true}));
    result.set(transcript,rows);
  }
  return result;
}
