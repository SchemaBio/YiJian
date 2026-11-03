import type { TextTranslator } from './text';

const retrievalNotice = '外部文献检索不可用，以下建议未完成文献核验；不可将检索失败理解为没有相关证据。';
const adoptionNotice = '模型建议、规则结果与人工判定分别保存；本结果尚未由人工采纳。';

/** Hide the retired retrieval notice in saved results; preserve all model text. */
export function aiWarningsForDisplay(warnings: string[] | undefined, t: TextTranslator): string[] {
  return (warnings ?? []).filter(warning => warning !== retrievalNotice)
    .map(warning => warning === adoptionNotice ? t(warning) : warning);
}
