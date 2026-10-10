import { api } from './api';
import type { ACMGClassification } from '@/app/(main)/tasks/[uuid]/types';

export interface EvidenceSchema {
  $ref?: string; $defs?: Record<string,EvidenceSchema>; anyOf?: EvidenceSchema[];
  type?: string; title?: string; description?: string; enum?: string[]; const?: unknown;
  properties?: Record<string,EvidenceSchema>; items?: EvidenceSchema; required?: string[];
}
export interface SVCv4Assessment {
  disease: string; moi: string; geneDiseaseValidity?: string | null;
  inputs: {workflow?: string; impact?: Record<string,unknown>; population?: Record<string,unknown>; cases?: Record<string,unknown>[]; caseControl?: Record<string,unknown>; family?: Record<string,unknown>};
  revision?: string; source?: string; authoritative?: false; confirmed: boolean;
  result?: {score: number | null; classification?: ACMGClassification | null; vusSubclass?: string | null; state: string; breakdown: Record<string,number>; warnings: string[]; details: Record<string,unknown>};
}
export interface SVCv4Schema {
  revision: string; source: string; authoritative: false;
  workflows: {id:string;label:string;schema:EvidenceSchema}[];
  population: EvidenceSchema; case: EvidenceSchema; caseControl: EvidenceSchema;
  moi: string[]; geneDiseaseValidity: string[]; unsupported: string[];
}
export const getSVCv4Schema = (taskId:string,signal?:AbortSignal) => api.get<SVCv4Schema>(`/v1/tasks/${encodeURIComponent(taskId)}/results/assessment/svcv4/schema`,{signal});
export const evaluateSVCv4 = (taskId:string,input:SVCv4Assessment) => api.post<SVCv4Assessment>(`/v1/tasks/${encodeURIComponent(taskId)}/results/assessment/svcv4/evaluate`,input);
