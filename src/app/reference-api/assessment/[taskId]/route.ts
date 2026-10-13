import { NextRequest, NextResponse } from 'next/server';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';
import { queryReferences } from '@/lib/assessment/reference-server';

export const runtime='nodejs';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(request:NextRequest,{params}:{params:Promise<{taskId:string}>}){
  const {taskId}=await params;
  if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(taskId))return reply({error:'INVALID_TASK'},400);
  const token=request.cookies.get('access_token')?.value;
  if(!token)return reply({error:'UNAUTHORIZED'},401);
  if(Number(request.headers.get('content-length'))>65536)return reply({error:'REQUEST_TOO_LARGE'},413);
  let body:{contextVersion?:string;genes?:string[];cursor?:number;resourceVersion?:string};
  try{const raw=await request.text();if(raw.length>65536)return reply({error:'REQUEST_TOO_LARGE'},413);body=JSON.parse(raw);}catch{return reply({error:'INVALID_REQUEST'},400);}
  if(!body.contextVersion||!Array.isArray(body.genes)||body.genes.length>512||body.genes.some(g=>typeof g!=='string'||g.length>80||!g.trim())||body.cursor!==undefined&&(!Number.isInteger(body.cursor)||body.cursor<0||body.cursor>body.genes.length))return reply({error:'INVALID_REQUEST'},400);
  // Fixed administrator-configured origin; never forward cookies to an incoming Host.
  const flavor=getRuntimeBackendFlavor();
  const base=(process.env.YIJIAN_SERVER_API_URL||`http://${process.env.NODE_ENV==='production'?flavor:'127.0.0.1'}:8080/api`).replace(/\/$/,'');
  const prefix=flavor==='squid'?'/v1/octopus':'/v1';
  try{
    const response=await fetch(`${base}${prefix}/tasks/${taskId}/results/assessment/context?summary=1`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});
    if(!response.ok)return reply({error:'CONTEXT_UNAVAILABLE'},[401,403,404].includes(response.status)?response.status:503);
    const envelope=await response.json();const active=(envelope.data??envelope).active;
    if(!active||active.taskId!==taskId||active.version!==body.contextVersion)return reply({error:'CONTEXT_CHANGED'},409);
    const resourceVersion=active.referenceVersion;
    if(!resourceVersion || body.resourceVersion&&body.resourceVersion!==resourceVersion)return reply({error:'REFERENCE_VERSION_CHANGED'},409);
    const value=await queryReferences({genes:body.genes,hpo:active.hpo??[],cursor:body.cursor,resourceVersion});
    return reply(value);
  }catch(error){return error instanceof Error&&error.message==='REFERENCE_VERSION_CHANGED'?reply({error:'REFERENCE_VERSION_CHANGED'},409):reply({error:'REFERENCE_UNAVAILABLE'},503);}
}
