import { api } from './api';
import {readResourcePages} from './resource-pages';

export type GeneListCategory = 'core' | 'important' | 'optional';

export interface GeneList {
 revision:number;scope:string;canMaintain:boolean;
  id: string;
  name: string;
  disease: string;
  description: string;
  genes: string[];
  category: GeneListCategory;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

type MaybeList<T> = T[] | {
  items?: T[];
  data?: T[] | { items?: T[]; total?: number };
  total?: number;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function rawString(raw: Record<string, unknown>, camel: string, snake: string, fallback = ''): string {
  const value = raw[camel] ?? raw[snake];
  return typeof value === 'string' ? value : fallback;
}

function rawGenes(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(item => String(item).trim().toUpperCase()).filter(Boolean)
    : [];
}

function unwrapList<T>(value: MaybeList<T>): T[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.items)) return value.items;
  if (Array.isArray(value.data)) return value.data;
  if (value.data && !Array.isArray(value.data) && Array.isArray(value.data.items)) return value.data.items;
  return [];
}

function normalizeCategory(value: unknown): GeneListCategory {
  return value === 'core' || value === 'important' || value === 'optional' ? value : 'optional';
}

export function normalizeGeneList(rawValue: unknown): GeneList {
  const raw = asRecord(rawValue);
  return {
    id: String(raw.id ?? ''),revision:Number(raw.revision??1),scope:String(raw.scope??'personal'),canMaintain:raw.can_maintain===true,
    name: rawString(raw, 'name', 'name'),
    disease: rawString(raw, 'disease', 'disease_category'),
    description: rawString(raw, 'description', 'description'),
    genes: [...new Set(rawGenes(raw.genes))],
    category: normalizeCategory(raw.category),
    createdAt: rawString(raw, 'createdAt', 'created_at'),
    updatedAt: rawString(raw, 'updatedAt', 'updated_at'),
    createdBy: rawString(raw, 'createdBy', 'created_by') || undefined,
  };
}

export function geneListPayload(data: {
  name: string;
  disease?: string;
  description?: string;
  genes: string[];
  category?: GeneListCategory;
}) {
  return {
    name: data.name.trim(),
    description: data.description ?? '',
    genes: data.genes.map(gene => gene.trim().toUpperCase()).filter(Boolean),
    category: data.category ?? 'optional',
    disease_category: data.disease ?? '',
  };
}

export async function listGeneLists(params:Record<string,string>={},signal?:AbortSignal):Promise<GeneList[]>{return (await readResourcePages<unknown>('/v1/gene-lists',params,signal)).map(normalizeGeneList).filter(x=>x.id);}
export async function publishGeneList(list:GeneList):Promise<GeneList>{return normalizeGeneList(await api.post(`/v1/gene-lists/${encodeURIComponent(list.id)}/publish`,{expected_revision:list.revision}));}

export async function createGeneList(data: {
  name: string;
  disease?: string;
  description?: string;
  genes: string[];
  category?: GeneListCategory;
}): Promise<GeneList> {
  const response = await api.post<unknown>('/v1/gene-lists', geneListPayload(data));
  return normalizeGeneList(response);
}

export async function updateGeneList(id: string, data: {
 expectedRevision:number;
  name: string;
  disease?: string;
  description?: string;
  genes: string[];
  category?: GeneListCategory;
}): Promise<GeneList> {
  const response = await api.put<unknown>(`/v1/gene-lists/${encodeURIComponent(id)}`, {...geneListPayload(data),expected_revision:data.expectedRevision});
  return normalizeGeneList(response);
}

export async function deleteGeneList(id: string): Promise<void> {
  await api.delete<void>(`/v1/gene-lists/${encodeURIComponent(id)}`);
}
