import { LocalizedError } from '@/i18n/errors';
/** Frontend boundary only. Wire an implementation here after API alignment. */
export type AIFeature = 'hpo' | 'acmg' | 'svcv4' | 'cnv_gain' | 'cnv_loss';
export type AIDeployment = 'saas' | 'opensource';
export class AIRequestError extends LocalizedError {
  constructor(message: string, public readonly safeToRegenerate: boolean) { super(message); this.name = 'AIRequestError'; }
}
export interface AIAssistanceSettings {
  enabled: boolean;
  connected: boolean;
  configured: boolean;
  model?: string;
  baseUrl?: string;
  keyConfigured?: boolean;
  protocol?: 'openai_responses' | 'openai_chat';
  billingEnabled?: boolean;
  capabilities?: Partial<Record<AIFeature, { enabled: boolean; reason?: string; mode?: 'candidate' | 'experimental' | 'formal'; billingEnabled?: boolean }>>;
}
export interface AISettingsDraft { enabled: boolean; baseUrl: string; apiKey: string; model: string; clearKey: boolean; protocol?: 'openai_responses' | 'openai_chat' }
export interface AIClinicalContext { diseaseId: string; inheritance: string; sampleType: string; variantOrigin: 'unknown' | 'germline_confirmed'; hpoTerms?: string[] }
export interface AIAssistanceInput {
  feature: AIFeature;
  mode?: 'experimental';
  draftAssessment?: Record<string, unknown>;
  taskId?: string;
  reference?: string;
  diagnosis?: string;
  variant?: Record<string, unknown>;
  calculator?: unknown;
  clinicalContext?: AIClinicalContext;
}
export interface AIAssistanceResult {
  feature: AIFeature;
  model?: string;
  generatedAt?: string;
  classification?: string;
  summary: string;
  evidence?: Array<{ code: string; reason: string }>;
  hpoTerms?: Array<{ id: string; name: string; polarity?: string; spanStart?: number; spanEnd?: number; spanUnit?: 'unicode_codepoint' | 'utf16' }>;
  warnings?: string[];
  agentProposal?: unknown;
  ruleEngineResult?: unknown;
  reviewerDecision?: unknown;
  resultKind?: string;
  experimentalResult?: Record<string, unknown>;
}
export interface AIAssistanceAdapter {
  getSavedHPO?(diagnosis: string, signal: AbortSignal): Promise<AIAssistanceResult | null>;
  getClinicalContext?(taskId: string, signal: AbortSignal): Promise<Partial<AIClinicalContext>>;
  getSettings(deployment: AIDeployment, signal?: AbortSignal): Promise<AIAssistanceSettings>;
  saveSettings(draft: AISettingsDraft): Promise<AIAssistanceSettings>;
  generate(input: AIAssistanceInput, options: { requestId: string; signal: AbortSignal; confirmedCharge: boolean; onRequest?: (id: string) => void }): Promise<AIAssistanceResult>;
  cancel?(requestId: string): Promise<void>;
}
export const AI_FEATURE_LABELS: Record<AIFeature, string> = { hpo: 'HPO 候选术语', acmg: 'ACMG 现版建议', svcv4: 'SVC v4.0 草案实验', cnv_gain: 'CNV Gain 建议', cnv_loss: 'CNV Loss 建议' };
export const AI_NOT_CONNECTED = 'AI 评估服务尚未接入，本次未调用模型、未扣费。';

// No speculative URL, credential storage, mock verdict or client-side billing.
export const pendingAIAssistanceAdapter: AIAssistanceAdapter = {
  async getSettings(deployment) { return { enabled: deployment === 'saas', connected: false, configured: false, keyConfigured: false }; },
  async saveSettings() { throw new LocalizedError("display.aiConfigurationServiceIsNotConnectedSettings42c5e7"); },
  async generate() { throw new LocalizedError(AI_NOT_CONNECTED); },
};

export function formatAIInterpretation(result: AIAssistanceResult): string {
  if (result.resultKind === 'experimental' || result.experimentalResult) return 'SVC 草案实验结果禁止临床审核采纳。';
  return [`AI 辅助建议 · ${AI_FEATURE_LABELS[result.feature]}`, result.classification ? `建议分类：${result.classification}` : '', result.summary,
    ...(result.evidence ?? []).map(item => `${item.code}：${item.reason}`), ...(result.warnings ?? []).map(item => `待复核：${item}`)].filter(Boolean).join('\n');
}
