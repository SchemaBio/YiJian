import { api } from './api';
import type {
  AffectedStatus,
  Pedigree,
  PedigreeListItem,
  PedigreeMember,
  RelationType,
} from '@/app/(main)/samples/pedigree/types';
import type { Gender } from '@/app/(main)/samples/types';

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

function rawNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function rawBoolean(value: unknown): boolean {
  return value === true;
}

function unwrapList<T>(value: MaybeList<T>): T[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.items)) return value.items;
  if (Array.isArray(value.data)) return value.data;
  if (value.data && !Array.isArray(value.data) && Array.isArray(value.data.items)) return value.data.items;
  return [];
}

function normalizeGender(value: unknown): Gender {
  return value === 'male' || value === 'female' || value === 'unknown' ? value : 'unknown';
}

function normalizeRelation(value: unknown): RelationType {
  const allowed: RelationType[] = [
    'proband', 'father', 'mother', 'sibling', 'child', 'spouse',
    'grandfather_paternal', 'grandmother_paternal',
    'grandfather_maternal', 'grandmother_maternal',
    'uncle', 'aunt', 'cousin', 'other',
  ];
  return allowed.includes(value as RelationType) ? value as RelationType : 'other';
}

function normalizeAffectedStatus(value: unknown): AffectedStatus {
  return value === 'affected' || value === 'unaffected' || value === 'carrier' || value === 'unknown'
    ? value
    : 'unknown';
}

function normalizePhenotypes(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const items = value.map(String).filter(Boolean);
    return items.length ? items : undefined;
  }
  const raw = asRecord(value);
  const candidate = raw.values ?? raw.items ?? raw.hpo_terms ?? raw.hpoTerms ?? raw.symptoms;
  if (Array.isArray(candidate)) {
    const items = candidate.map(String).filter(Boolean);
    return items.length ? items : undefined;
  }
  return undefined;
}

export function normalizePedigreeMember(rawValue: unknown): PedigreeMember {
  const raw = asRecord(rawValue);
  return {
    id: String(raw.id ?? ''),
    sampleId: rawString(raw, 'sampleId', 'sample_id') || undefined,
    name: rawString(raw, 'name', 'name'),
    gender: normalizeGender(raw.gender),
    birthYear: rawNumber(raw.birthYear ?? raw.birth_year),
    isDeceased: rawBoolean(raw.isDeceased ?? raw.is_deceased),
    deceasedYear: rawNumber(raw.deceasedYear ?? raw.deceased_year),
    relation: normalizeRelation(raw.relation),
    affectedStatus: normalizeAffectedStatus(raw.affectedStatus ?? raw.affected_status),
    phenotypes: normalizePhenotypes(raw.phenotypes),
    fatherId: rawString(raw, 'fatherId', 'father_id') || undefined,
    motherId: rawString(raw, 'motherId', 'mother_id') || undefined,
    generation: rawNumber(raw.generation) ?? 0,
    position: rawNumber(raw.position) ?? 0,
  };
}

export function normalizePedigreeListItem(rawValue: unknown): PedigreeListItem {
  const raw = asRecord(rawValue);
  const members = Array.isArray(raw.members) ? raw.members.map(normalizePedigreeMember) : [];
  const probandMemberId = rawString(raw, 'probandMemberId', 'proband_member_id');
  const proband = members.find(member => member.id === probandMemberId || member.relation === 'proband');
  const sampleIds = members.map(member => member.sampleId).filter(Boolean) as string[];

  return {
    id: String(raw.id ?? ''),
    internalId: rawString(raw, 'internalId', 'name', String(raw.id ?? '')),
    sampleIds,
    sampleInternalIds: sampleIds,
    probandSampleId: proband?.sampleId,
    probandSampleInternalId: proband?.sampleId,
    probandIndex: Math.max(0, sampleIds.findIndex(id => id === proband?.sampleId)),
    clinicalDiagnosis: rawString(raw, 'clinicalDiagnosis', 'disease') || undefined,
    remark: rawString(raw, 'remark', 'note') || undefined,
    createdAt: rawString(raw, 'createdAt', 'created_at'),
    updatedAt: rawString(raw, 'updatedAt', 'updated_at'),
  };
}

export function normalizePedigree(rawValue: unknown): Pedigree {
  const raw = asRecord(rawValue);
  const members = Array.isArray(raw.members) ? raw.members.map(normalizePedigreeMember) : [];
  const probandMemberId = rawString(raw, 'probandMemberId', 'proband_member_id');
  const proband = members.find(member => member.id === probandMemberId || member.relation === 'proband');

  return {
    id: String(raw.id ?? ''),
    internalId: rawString(raw, 'internalId', 'name', String(raw.id ?? '')),
    probandId: proband?.id ?? probandMemberId,
    probandSampleId: proband?.sampleId,
    members,
    clinicalDiagnosis: rawString(raw, 'clinicalDiagnosis', 'disease') || undefined,
    remark: rawString(raw, 'remark', 'note') || undefined,
    note: rawString(raw, 'note', 'note') || undefined,
    createdAt: rawString(raw, 'createdAt', 'created_at'),
    updatedAt: rawString(raw, 'updatedAt', 'updated_at'),
  };
}

export function pedigreePayload(data: { internalId?: string; clinicalDiagnosis?: string; remark?: string }) {
  return {
    name: data.internalId ?? '',
    disease: data.clinicalDiagnosis ?? '',
    note: data.remark ?? '',
  };
}

export function memberPayload(data: Partial<PedigreeMember>) {
  const isDeceased = data.isDeceased;
  return {
    name: data.name ?? '',
    gender: data.gender ?? 'unknown',
    birth_year: data.birthYear ?? null,
    is_deceased: isDeceased,
    deceased_year: data.deceasedYear ?? null,
    relation: data.relation ?? 'other',
    affected_status: data.affectedStatus ?? 'unknown',
    phenotypes: data.phenotypes?.length ? { values: data.phenotypes } : {},
    father_id: data.fatherId ?? '',
    mother_id: data.motherId ?? '',
    generation: data.generation ?? 0,
    position: data.position ?? 0,
    sample_id: data.sampleId ?? '',
  };
}

export async function listPedigrees(params: Record<string, string> = { page: '1', page_size: '100' }): Promise<PedigreeListItem[]> {
  const response = await api.get<MaybeList<unknown>>('/v1/pedigrees', { params });
  return unwrapList(response).map(normalizePedigreeListItem).filter(pedigree => pedigree.id);
}

export async function getPedigree(id: string): Promise<Pedigree | null> {
  const response = await api.get<unknown>(`/v1/pedigrees/${encodeURIComponent(id)}`);
  const pedigree = normalizePedigree(response);
  return pedigree.id ? pedigree : null;
}

export async function createPedigree(data: { internalId: string; clinicalDiagnosis?: string; remark?: string }): Promise<PedigreeListItem> {
  const response = await api.post<unknown>('/v1/pedigrees', pedigreePayload(data));
  return normalizePedigreeListItem(response);
}

export async function updatePedigree(id: string, data: { internalId: string; clinicalDiagnosis?: string; remark?: string }): Promise<PedigreeListItem> {
  const response = await api.put<unknown>(`/v1/pedigrees/${encodeURIComponent(id)}`, pedigreePayload(data));
  return normalizePedigreeListItem(response);
}

export async function deletePedigree(id: string): Promise<void> {
  await api.delete<void>(`/v1/pedigrees/${encodeURIComponent(id)}`);
}

export async function createPedigreeMember(pedigreeId: string, data: Partial<PedigreeMember>): Promise<PedigreeMember> {
  const response = await api.post<unknown>(`/v1/pedigrees/${encodeURIComponent(pedigreeId)}/members`, memberPayload(data));
  return normalizePedigreeMember(response);
}

export async function updatePedigreeMember(pedigreeId: string, memberId: string, data: Partial<PedigreeMember>): Promise<PedigreeMember> {
  const response = await api.put<unknown>(
    `/v1/pedigrees/${encodeURIComponent(pedigreeId)}/members/${encodeURIComponent(memberId)}`,
    memberPayload(data)
  );
  return normalizePedigreeMember(response);
}

export async function deletePedigreeMember(pedigreeId: string, memberId: string): Promise<void> {
  await api.delete<void>(`/v1/pedigrees/${encodeURIComponent(pedigreeId)}/members/${encodeURIComponent(memberId)}`);
}

export async function setPedigreeProband(pedigreeId: string, memberId: string): Promise<Pedigree> {
  const response = await api.put<unknown>(`/v1/pedigrees/${encodeURIComponent(pedigreeId)}/proband/${encodeURIComponent(memberId)}`, {});
  return normalizePedigree(response);
}
