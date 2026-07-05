import { api } from './api';
import type { Sample, SampleDetail } from '@/app/(main)/samples/types';

type MaybeList<T> = T[] | { items?: T[]; data?: T[] | { items?: T[] }; total?: number };
type SampleFormPayload = {
  internalId: string;
  gender: Sample['gender'];
  age?: number;
  sampleType: Sample['sampleType'];
  batch: string;
  clinicalDiagnosis: string;
  hpoTerms: { id: string; name: string }[];
  r1Path?: string;
  r2Path?: string;
  remark: string;
};

function unwrapList<T>(value: MaybeList<T>): T[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.items)) return value.items;
  if (Array.isArray(value.data)) return value.data;
  if (value.data && !Array.isArray(value.data) && Array.isArray(value.data.items)) return value.data.items;
  return [];
}

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

function rawHpoTerms(value: unknown): { id: string; name: string }[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const raw = asRecord(item);
      return { id: String(raw.id ?? ''), name: String(raw.name ?? '') };
    })
    .filter(term => term.id);
}

function rawStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function rawMatchedPair(value: unknown): Sample['matchedPair'] {
  const raw = asRecord(value);
  const r1Path = rawString(raw, 'r1Path', 'r1_path').trim();
  const r2Path = rawString(raw, 'r2Path', 'r2_path').trim();
  return r1Path && r2Path ? { r1Path, r2Path } : null;
}

export function normalizeSample(rawValue: unknown): Sample {
  const raw = asRecord(rawValue);
  const clinical = raw.clinicalDiagnosis ?? raw.clinical_diagnosis;
  return {
    id: String(raw.id ?? ''),
    internalId: rawString(raw, 'internalId', 'internal_id'),
    gender: (raw.gender === 'male' || raw.gender === 'female' || raw.gender === 'unknown') ? raw.gender : 'unknown',
    age: rawNumber(raw.age),
    sampleType: rawString(raw, 'sampleType', 'sample_type', '其他') as Sample['sampleType'],
    batch: rawString(raw, 'batch', 'batch'),
    clinicalDiagnosis: typeof clinical === 'string'
      ? clinical
      : rawString(asRecord(clinical), 'mainDiagnosis', 'main_diagnosis'),
    hpoTerms: rawHpoTerms(raw.hpoTerms ?? raw.hpo_terms),
    matchedPair: rawMatchedPair(raw.matchedPair ?? raw.matched_pair),
    remark: rawString(raw, 'remark', 'remark'),
    createdAt: rawString(raw, 'createdAt', 'created_at'),
    updatedAt: rawString(raw, 'updatedAt', 'updated_at'),
  };
}

export function normalizeSampleDetail(rawValue: unknown): SampleDetail {
  const raw = asRecord(rawValue);
  const base = normalizeSample(raw);
  const clinical = asRecord(raw.clinicalDiagnosis ?? raw.clinical_diagnosis);
  const submission = asRecord(raw.submissionInfo ?? raw.submission_info);
  const project = asRecord(raw.projectInfo ?? raw.project_info);
  const family = asRecord(raw.familyHistory ?? raw.family_history);
  const affectedMembers = Array.isArray(family.affectedMembers ?? family.affected_members)
    ? (family.affectedMembers ?? family.affected_members) as unknown[]
    : [];
  const analysisTasks = Array.isArray(raw.analysisTasks ?? raw.analysis_tasks)
    ? (raw.analysisTasks ?? raw.analysis_tasks) as unknown[]
    : [];

  return {
    ...base,
    clinicalDiagnosis: {
      mainDiagnosis: rawString(clinical, 'mainDiagnosis', 'main_diagnosis', base.clinicalDiagnosis),
      symptoms: Array.isArray(clinical.symptoms) ? clinical.symptoms.map(String) : [],
      hpoTerms: rawHpoTerms(clinical.hpoTerms ?? clinical.hpo_terms ?? raw.hpoTerms ?? raw.hpo_terms),
      onsetAge: rawString(clinical, 'onsetAge', 'onset_age'),
      diseaseHistory: rawString(clinical, 'diseaseHistory', 'disease_history'),
    },
    submissionInfo: {
      submissionDate: rawString(submission, 'submissionDate', 'submission_date'),
      sampleCollectionDate: rawString(submission, 'sampleCollectionDate', 'sample_collection_date'),
      sampleReceiveDate: rawString(submission, 'sampleReceiveDate', 'sample_receive_date'),
      sampleQuality: (submission.sampleQuality === 'good' || submission.sampleQuality === 'acceptable' || submission.sampleQuality === 'poor')
        ? submission.sampleQuality
        : 'acceptable',
    },
    projectInfo: {
      projectId: rawString(project, 'projectId', 'project_id'),
      projectName: rawString(project, 'projectName', 'project_name'),
      testItems: rawStringArray(project.testItems ?? project.test_items),
      panel: rawString(project, 'panel', 'panel'),
      turnaroundDays: rawNumber(project.turnaroundDays ?? project.turnaround_days) ?? 0,
      priority: project.priority === 'urgent' ? 'urgent' : 'normal',
    },
    familyHistory: {
      hasHistory: Boolean(family.hasHistory ?? family.has_history),
      affectedMembers: affectedMembers.map((member) => {
        const item = asRecord(member);
        return {
          relation: rawString(item, 'relation', 'relation'),
          condition: rawString(item, 'condition', 'condition'),
          onsetAge: rawString(item, 'onsetAge', 'onset_age'),
        };
      }),
      pedigreeNote: rawString(family, 'pedigreeNote', 'pedigree_note'),
    },
    analysisTasks: analysisTasks.map((task) => {
      const item = asRecord(task);
      return {
        id: String(item.id ?? ''),
        name: rawString(item, 'name', 'name'),
        status: rawString(item, 'status', 'status'),
        createdAt: rawString(item, 'createdAt', 'created_at'),
      };
    }).filter(task => task.id),
  };
}

export function samplePayload(data: SampleFormPayload) {
  const r1Path = data.r1Path?.trim();
  const r2Path = data.r2Path?.trim();
  if ((r1Path && !r2Path) || (!r1Path && r2Path)) {
    throw new Error('R1 and R2 FASTQ paths must be provided together');
  }
  return {
    internal_id: data.internalId,
    gender: data.gender,
    age: data.age ?? null,
    sample_type: data.sampleType,
    batch: data.batch,
    clinical_diagnosis: data.clinicalDiagnosis,
    hpo_terms: data.hpoTerms,
    ...(r1Path ? { r1_path: r1Path } : {}),
    ...(r2Path ? { r2_path: r2Path } : {}),
    remark: data.remark,
  };
}

export function sampleDetailPayload(data: Partial<SampleDetail>) {
  const r1Path = data.matchedPair?.r1Path?.trim();
  const r2Path = data.matchedPair?.r2Path?.trim();
  if ((r1Path && !r2Path) || (!r1Path && r2Path)) {
    throw new Error('R1 and R2 FASTQ paths must be provided together');
  }
  return {
    internal_id: data.internalId ?? '',
    gender: data.gender ?? 'unknown',
    age: data.age ?? null,
    sample_type: data.sampleType ?? '其他',
    batch: data.batch ?? '',
    clinical_diagnosis: data.clinicalDiagnosis?.mainDiagnosis ?? '',
    hpo_terms: data.clinicalDiagnosis?.hpoTerms ?? [],
    ...(r1Path ? { r1_path: r1Path } : {}),
    ...(r2Path ? { r2_path: r2Path } : {}),
    remark: data.remark ?? '',
  };
}

export async function listSamples(params: Record<string, string> = { page: '1', page_size: '100' }): Promise<Sample[]> {
  const response = await api.get<MaybeList<unknown>>('/v1/samples', { params });
  return unwrapList(response).map(normalizeSample).filter(sample => sample.id);
}

export async function getSampleDetail(id: string): Promise<SampleDetail | null> {
  const response = await api.get<unknown>(`/v1/samples/${encodeURIComponent(id)}`);
  const detail = normalizeSampleDetail(response);
  return detail.id ? detail : null;
}

export async function updateSampleMatchedPair(
  id: string,
  matchedPair: { r1Path: string; r2Path: string }
): Promise<SampleDetail> {
  const r1Path = matchedPair.r1Path.trim();
  const r2Path = matchedPair.r2Path.trim();
  if (!r1Path || !r2Path) {
    throw new Error('Both R1 and R2 FASTQ storage keys are required');
  }
  await api.put<unknown>(`/v1/samples/${encodeURIComponent(id)}`, {
    ...(r1Path ? { r1_path: r1Path } : {}),
    ...(r2Path ? { r2_path: r2Path } : {}),
  });

  const updated = await getSampleDetail(id);
  if (!updated) {
    throw new Error('Sample was updated but could not be reloaded');
  }
  return updated;
}
