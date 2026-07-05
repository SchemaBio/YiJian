import { api } from './api';

export type GeneListCategory = 'core' | 'important' | 'optional';

export interface GeneList {
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
    id: String(raw.id ?? ''),
    name: rawString(raw, 'name', 'name'),
    disease: rawString(raw, 'disease', 'disease_category'),
    description: rawString(raw, 'description', 'description'),
    genes: rawGenes(raw.genes),
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

export async function listGeneLists(params: Record<string, string> = { page: '1', page_size: '100' }): Promise<GeneList[]> {
  const response = await api.get<MaybeList<unknown>>('/v1/gene-lists', { params });
  return unwrapList(response).map(normalizeGeneList).filter(list => list.id);
}

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
  name: string;
  disease?: string;
  description?: string;
  genes: string[];
  category?: GeneListCategory;
}): Promise<GeneList> {
  const response = await api.put<unknown>(`/v1/gene-lists/${encodeURIComponent(id)}`, geneListPayload(data));
  return normalizeGeneList(response);
}

export async function deleteGeneList(id: string): Promise<void> {
  await api.delete<void>(`/v1/gene-lists/${encodeURIComponent(id)}`);
}
