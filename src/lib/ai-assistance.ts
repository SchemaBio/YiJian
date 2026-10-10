/** Frontend boundary only. Wire an implementation here after API alignment. */
export type AIFeature = 'hpo' | 'acmg' | 'svcv4' | 'cnv_gain' | 'cnv_loss';
export type AIDeployment = 'saas' | 'opensource';
export interface AIAssistanceSettings {
  enabled: boolean;
  connected: boolean;
  configured: boolean;
  model?: string;
  baseUrl?: string;
  keyConfigured?: boolean;
}
export interface AISettingsDraft { enabled: boolean; baseUrl: string; apiKey: string; model: string; clearKey: boolean }
export interface AIAssistanceInput {
  feature: AIFeature;
  taskId?: string;
  reference?: string;
  diagnosis?: string;
  variant?: Record<string, unknown>;
  calculator?: unknown;
}
export interface AIAssistanceResult {
  feature: AIFeature;
  model?: string;
  generatedAt?: string;
  classification?: string;
  summary: string;
  evidence?: Array<{ code: string; reason: string }>;
  hpoTerms?: Array<{ id: string; name: string }>;
  warnings?: string[];
}
export interface AIAssistanceAdapter {
  getSettings(deployment: AIDeployment, signal?: AbortSignal): Promise<AIAssistanceSettings>;
  saveSettings(draft: AISettingsDraft): Promise<AIAssistanceSettings>;
  generate(input: AIAssistanceInput, options: { requestId: string; signal: AbortSignal; confirmedCharge: boolean }): Promise<AIAssistanceResult>;
}
export const AI_FEATURE_LABELS: Record<AIFeature, string> = { hpo: 'HPO 表型术语', acmg: 'ACMG 现版判决', svcv4: 'ACMG SVC v4.0版判决', cnv_gain: 'CNV Gain 判决', cnv_loss: 'CNV Loss 判决' };
export const AI_NOT_CONNECTED = 'AI 评估服务尚未接入，本次未调用模型、未扣费。';

// No speculative URL, credential storage, mock verdict or client-side billing.
export const pendingAIAssistanceAdapter: AIAssistanceAdapter = {
  async getSettings(deployment) { return { enabled: deployment === 'saas', connected: false, configured: false, keyConfigured: false }; },
  async saveSettings() { throw new Error('AI 配置服务尚未接入，配置未保存。'); },
  async generate() { throw new Error(AI_NOT_CONNECTED); },
};

export function formatAIInterpretation(result: AIAssistanceResult): string {
  return [`AI 辅助建议 · ${AI_FEATURE_LABELS[result.feature]}`, result.classification ? `建议分类：${result.classification}` : '', result.summary,
    ...(result.evidence ?? []).map(item => `${item.code}：${item.reason}`), ...(result.warnings ?? []).map(item => `待复核：${item}`)].filter(Boolean).join('\n');
}
