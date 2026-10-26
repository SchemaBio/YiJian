import {describe,it,expect} from 'vitest';
import {prepareAIRequestInput} from './ai-request-input';
import type {AIAssistanceInput} from './ai-assistance';
describe('AI request preparation',()=>{
 it('serializes CNV worker integers while preserving zero and exact wide values',()=>{const input={feature:'cnv_loss',variant:{startPosition:BigInt('0'),endPosition:BigInt('100'),copyNumber:BigInt('0'),annotationValues:{wide:BigInt('9007199254740993')}},calculator:{geneCount:BigInt('4')}} as unknown as AIAssistanceInput;const out=prepareAIRequestInput(input);expect(out.variant).toEqual({startPosition:0,endPosition:100,copyNumber:0,annotationValues:{wide:'9007199254740993'}});expect(()=>JSON.stringify(out)).not.toThrow();expect(input.variant!.copyNumber).toBe(BigInt('0'));});
 it('rejects circular input before any API submission',()=>{const input:AIAssistanceInput={feature:'cnv_gain',calculator:{}};(input.calculator as any).self=input;expect(()=>prepareAIRequestInput(input)).toThrow();});
});
