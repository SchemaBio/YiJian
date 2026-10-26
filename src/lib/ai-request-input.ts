import type { AIAssistanceInput } from './ai-assistance';

/** Detach worker-backed data and preserve wide integers without rounding. */
export function prepareAIRequestInput(input: AIAssistanceInput): AIAssistanceInput {
  return JSON.parse(JSON.stringify(input, (_key, value: unknown) => {
    if (typeof value !== 'bigint') return value;
    const number = Number(value);
    return Number.isSafeInteger(number) ? number : value.toString();
  })) as AIAssistanceInput;
}
