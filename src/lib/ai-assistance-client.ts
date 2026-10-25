import { api } from './api';
import { unicodeSpanToUTF16 } from './svc-experimental';
import { AIRequestError } from './ai-assistance';
import type { AIAssistanceAdapter, AIAssistanceResult, AIAssistanceSettings } from './ai-assistance';

interface RequestView { requestId: string; status: string; result?: AIAssistanceResult; errorCode?: string }
const ROOT = '/v1/ai-assistance';
const ERRORS: Record<string, string> = {
  AI_OUTPUT_INVALID: 'assistance.modelOutputInvalid',
  AI_PROVIDER_UNAVAILABLE: 'assistance.modelProviderUnavailable',
  AI_TOOL_BUDGET_EXCEEDED: 'assistance.modelToolBudgetExceeded',
  upstream_outcome_unknown: '无法确认上游是否已执行，请保留此请求记录，勿重复发起模型调用。',
  hpo_input_not_retained: '服务重启后 HPO 原文未保留，原请求状态不确定；不会自动重新调用模型。',
  legacy_upstream_unknown: '历史请求缺少上游实例归属，请联系管理员核对，勿重复生成。',
  upstream_version_changed: '上游版本已变化，请核对原请求；本次未自动换键重新生成。',
  billing_unavailable: '积分服务不可用，本次未生成结果。',
  invalid_result: 'AI 返回内容无效，未作为有效结果交付。',
};
function pause(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
    const abort = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); reject(new DOMException('Aborted', 'AbortError')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, 2000);
    signal.addEventListener('abort', abort, { once: true });
  });
}
export const httpAIAssistanceAdapter: AIAssistanceAdapter = {
  getSavedHPO: (diagnosis, signal) => api.post<AIAssistanceResult | null>(`${ROOT}/hpo-cache`, { diagnosis }, { signal }),
  async getClinicalContext(taskId, signal) {
    const sample = await api.get<{ sample_type?: string; clinical_diagnosis?: { hpoTerms?: Array<{ id: string }> } }>(`/v1/tasks/${encodeURIComponent(taskId)}/sample`, { signal });
    const types: Record<string, string> = { 全血: 'blood', 唾液: 'saliva', 组织: 'tissue', 其他: 'other' };
    return { sampleType: types[sample.sample_type ?? ''] ?? '', hpoTerms: (sample.clinical_diagnosis?.hpoTerms ?? []).map(term => term.id).filter(id => /^HP:\d{7}$/.test(id)) };
  },
  getSettings: (_deployment, signal) => api.get<AIAssistanceSettings>(`${ROOT}/settings`, { signal }),
  saveSettings: draft => api.put<AIAssistanceSettings>(`${ROOT}/settings`, draft),
  async generate(input, options) {
    let view = await api.post<RequestView>(`${ROOT}/requests`, { ...input, confirmedCharge: options.confirmedCharge }, { signal: options.signal, headers: { 'Idempotency-Key': options.requestId } });
    options.onRequest?.(view.requestId);
    while (true) {
      if (options.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      if (view.status === 'completed' && view.result) {
        view.result.requestId = view.requestId;
        if (input.feature === 'hpo' && input.diagnosis) view.result.hpoTerms = view.result.hpoTerms?.map(term => {
          if (term.spanUnit !== 'unicode_codepoint' || term.spanStart === undefined || term.spanEnd === undefined) return term;
          try { const [spanStart,spanEnd] = unicodeSpanToUTF16(input.diagnosis!,term.spanStart,term.spanEnd); return {...term,spanStart,spanEnd,spanUnit:'utf16' as const}; }
          catch { const {spanStart,spanEnd,spanUnit,...withoutSpan} = term; void spanStart; void spanEnd; void spanUnit; return withoutSpan; }
        });
        return view.result;
      }
      if (view.status === 'cancelled') throw new AIRequestError('AI 请求已取消。', true);
      if (view.status === 'expired') throw new AIRequestError('AI 结果已删除或超过保留期限。', true);
      if (view.status === 'failed' || view.status === 'uncertain') throw new AIRequestError(ERRORS[view.errorCode ?? ''] ?? 'AI 请求未成功交付，请查看配置和引擎状态。', view.status === 'failed');
      await pause(options.signal);
      view = await api.get<RequestView>(`${ROOT}/requests/${encodeURIComponent(view.requestId)}`, { signal: options.signal });
    }
  },
  async cancel(id) { await api.post(`${ROOT}/requests/${encodeURIComponent(id)}/cancel`, {}); },
};
