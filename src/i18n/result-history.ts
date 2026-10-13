import type { TextTranslator } from './text';

const systemReasons = new Set([
  '手动置顶', '取消置顶', '更新复核状态',
  '选入回报，确认当前有效判读及初评证据快照', '撤回回报', '更新 CNV 人工解读',
]);

/** Translate fixed operation messages in existing records; preserve clinical free text. */
export function resultHistoryReason(reason: string | undefined, t: TextTranslator): string {
  if (!reason) return t('tasks.noReasonProvidedcb9c56');
  return systemReasons.has(reason) ? t(reason) : reason;
}
