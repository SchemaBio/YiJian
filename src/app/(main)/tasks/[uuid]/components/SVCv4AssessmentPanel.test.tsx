import * as React from 'react';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {describe,it,expect,vi,beforeEach} from 'vitest';
import {SVCv4AssessmentPanel,EvidenceFields} from './SVCv4AssessmentPanel';
import {evaluateSVCv4} from '@/lib/svcv4';
import type {AIAssistanceResult} from '@/lib/ai-assistance';
import type {SNVIndel} from '../types';

vi.mock('@/lib/svcv4',()=>({getSVCv4Schema:vi.fn().mockResolvedValue({revision:'fixed',source:'https://example.org',moi:['AD'],geneDiseaseValidity:['MODERATE'],workflows:[{id:'missense',label:'错义',schema:{type:'object',properties:{}}}],population:{type:'object',properties:{faf:{type:'number'}}},case:{type:'object',properties:{id:{type:'string'}}},caseControl:{type:'object',properties:{}},unsupported:[]}),evaluateSVCv4:vi.fn()}));
vi.mock('../result-api',()=>({ACMG_CONFIG:{VUS:{label:'意义未明'}}}));
const suggestion={feature:'svcv4',requestId:'11111111-1111-4111-8111-111111111111',resultKind:'experimental',summary:'Synthetic SVC summary',suggestedClassification:'VUS',evidence:[{code:'POP',reason:'Population evidence'}]} as AIAssistanceResult;
vi.mock('@/components/shared/AIAssistanceAction',async importOriginal=>{
 const actual=await importOriginal<typeof import('@/components/shared/AIAssistanceAction')>();
 return {...actual,AIAssistanceAction:({onResult,disabled}:{onResult:(r:AIAssistanceResult)=>void;disabled:boolean})=><button disabled={disabled} onClick={()=>onResult(suggestion)}>Generate synthetic SVC</button>};
});
const variant={id:'row',gene:'G',chromosome:'1',position:100,ref:'A',alt:'T',transcript:'NM_1'} as SNVIndel;

describe('SVCv4 guided assessment',()=>{
 it('keeps zero distinct from missing numeric input',()=>{
  const update=vi.fn();
  const {rerender}=render(<EvidenceFields label="faf" schema={{type:'number'}} value={undefined} onChange={update} />);
  fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'0'}});
  expect(update).toHaveBeenLastCalledWith(0);
  rerender(<EvidenceFields label="faf" schema={{type:'number'}} value={1} onChange={update} />);
  fireEvent.change(screen.getByRole('spinbutton'),{target:{value:''}});
  expect(update).toHaveBeenLastCalledWith(undefined);
 });
 it('calculates on server, invalidates stale results after edits and saves confirmation',async()=>{
  const save=vi.fn().mockResolvedValue(undefined);
  vi.mocked(evaluateSVCv4).mockResolvedValue({disease:'OMIM:1',moi:'AD',confirmed:false,inputs:{},result:{score:0,classification:'VUS',vusSubclass:'VUS-low',state:'classified',breakdown:{POP:0},warnings:['草案假设'],details:{}}});
  render(<SVCv4AssessmentPanel taskId="task" variant={variant} readOnly={false} onSave={save} />);
  await screen.findByRole('button',{name:'计算新版评定'});
  fireEvent.change(screen.getByLabelText('疾病（名称或 CURIE，人工确认）'),{target:{value:'OMIM:1'}});
  fireEvent.change(screen.getByLabelText('遗传模式'),{target:{value:'AD'}});
  fireEvent.click(screen.getByRole('button',{name:'计算新版评定'}));
  await screen.findByText('意义未明 · VUS-low · 0 分');
  expect(evaluateSVCv4).toHaveBeenCalledWith('task',expect.objectContaining({disease:'OMIM:1',moi:'AD',confirmed:false}));
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button',{name:'保存新版评定'}));
  await waitFor(()=>expect(save).toHaveBeenCalledWith(expect.objectContaining({confirmed:true}),''));
  fireEvent.change(screen.getByLabelText('新版证据调整理由'),{target:{value:'核验后保存'}});
  fireEvent.click(screen.getByRole('button',{name:'保存新版评定'}));
  await waitFor(()=>expect(save).toHaveBeenCalledWith(expect.objectContaining({confirmed:true}),'核验后保存'));
  fireEvent.change(screen.getByLabelText('疾病（名称或 CURIE，人工确认）'),{target:{value:'OMIM:2'}});
  expect(screen.queryByText('意义未明 · VUS-low · 0 分')).not.toBeInTheDocument();
  expect(screen.getByRole('button',{name:'保存新版评定'})).toBeDisabled();
 });
 it('shows saved result in read-only mode with editing disabled',async()=>{
  render(<SVCv4AssessmentPanel taskId="task" variant={{...variant,svcv4Assessment:{disease:'D',moi:'AD',confirmed:true,inputs:{}}}} readOnly />);
  await screen.findByRole('button',{name:'计算新版评定'});
  expect(screen.getByLabelText('遗传模式')).toBeDisabled();
  expect(screen.queryByRole('button',{name:'保存新版评定'})).not.toBeInTheDocument();
 });
});

describe('SVC AI result persistence',()=>{
 beforeEach(()=>{delete suggestion.svcContext;});
 it('saves a generated AI result without manual calculator fields or a second model call',async()=>{
  const saveAI=vi.fn().mockResolvedValue(undefined),saveManual=vi.fn();
  render(<SVCv4AssessmentPanel taskId="task" variant={variant} readOnly={false} onSaveAI={saveAI} onSave={saveManual}/>);
  fireEvent.click(screen.getByRole('button',{name:'Generate synthetic SVC'}));
  expect(screen.getByText('Synthetic SVC summary')).toBeInTheDocument();
  const calculateCalls=vi.mocked(evaluateSVCv4).mock.calls.length;
  fireEvent.click(screen.getByRole('button',{name:'保存 AI 评估结果'}));
  await waitFor(()=>expect(saveAI).toHaveBeenCalledWith(suggestion.requestId));
  expect(screen.getByRole('button',{name:'AI 评估结果已保存'})).toBeDisabled();
  expect(screen.getByLabelText('疾病（名称或 CURIE，人工确认）')).toHaveValue('');
  expect(screen.getByLabelText('遗传模式')).toHaveValue('');
  expect(evaluateSVCv4).toHaveBeenCalledTimes(calculateCalls);expect(saveManual).not.toHaveBeenCalled();
 });
 it('restores a saved result when reopening and keeps it visible in read-only mode',async()=>{
  render(<SVCv4AssessmentPanel taskId="task" variant={{...variant,svcv4AIResult:suggestion}} readOnly onSaveAI={vi.fn()}/>);
  await screen.findByRole('button',{name:'计算新版评定'});
  expect(screen.getByText('Synthetic SVC summary')).toBeInTheDocument();
  expect(screen.getByText('AI 评估结果已保存')).toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'保存 AI 评估结果'})).not.toBeInTheDocument();
 });
 it('preserves the generated result and enables retry after a save failure',async()=>{
  const saveAI=vi.fn().mockRejectedValueOnce(new Error('Save unavailable')).mockResolvedValue(undefined);
  render(<SVCv4AssessmentPanel taskId="task" variant={variant} readOnly={false} onSaveAI={saveAI}/>);
  fireEvent.click(screen.getByRole('button',{name:'Generate synthetic SVC'}));
  fireEvent.click(screen.getByRole('button',{name:'保存 AI 评估结果'}));
  await screen.findByRole('alert');
  expect(screen.getByText('Synthetic SVC summary')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'保存 AI 评估结果'}));
  await waitFor(()=>expect(saveAI).toHaveBeenCalledTimes(2));
  await waitFor(()=>expect(screen.getByRole('button',{name:'AI 评估结果已保存'})).toBeDisabled());
 });
});

it('fills all four SVC fields from researched context and restores them from the saved AI result',async()=>{
 const context={disease:{value:'MONDO:synthetic',reason:'Disease match',source_ids:['PMID:1']},moi:{value:'AD',reason:'Inheritance evidence',source_ids:['PMID:1']},geneDiseaseValidity:{value:'MODERATE',reason:'Curated assertion',source_ids:['PMID:1']},workflow:{value:'missense',reason:'Consequence annotation',source_ids:['annotation']},sources:[{id:'PMID:1',title:'Synthetic publication',url:'https://pubmed.ncbi.nlm.nih.gov/1/'}]};
 suggestion.svcContext=context;
 const saveAI=vi.fn().mockResolvedValue(undefined);
 const {unmount}=render(<SVCv4AssessmentPanel taskId="task" variant={variant} readOnly={false} onSaveAI={saveAI}/>);
 await screen.findByRole('button',{name:'计算新版评定'});
 fireEvent.click(screen.getByRole('button',{name:'Generate synthetic SVC'}));
 expect(screen.getByLabelText('疾病（名称或 CURIE，人工确认）')).toHaveValue('MONDO:synthetic');
 expect(screen.getByLabelText('遗传模式')).toHaveValue('AD');
 expect(screen.getByLabelText('基因与疾病关联有效性')).toHaveValue('MODERATE');
 expect(screen.getByLabelText('变异影响工作流')).toHaveValue('missense');
 expect(screen.getAllByRole('link',{name:'Synthetic publication'})[0]).toHaveAttribute('href','https://pubmed.ncbi.nlm.nih.gov/1/');
 fireEvent.click(screen.getByRole('button',{name:'保存 AI 评估结果'}));await waitFor(()=>expect(saveAI).toHaveBeenCalledWith(suggestion.requestId));
 unmount();render(<SVCv4AssessmentPanel taskId="task" variant={{...variant,svcv4AIResult:{...suggestion}}} readOnly />);
 await screen.findByRole('button',{name:'计算新版评定'});
 expect(screen.getByLabelText('遗传模式')).toHaveValue('AD');
 expect(screen.getByLabelText('变异影响工作流')).toHaveValue('missense');
 delete suggestion.svcContext;
});

it('evaluates and saves a blank context as an unconfirmed partial result',async()=>{
 const partial={disease:'',moi:'',confirmed:false,inputs:{},result:{state:'insufficient_context',partial:true,missingFields:['disease','moi'],score:null,classification:null,breakdown:{},details:{},warnings:[]}};
 vi.mocked(evaluateSVCv4).mockResolvedValueOnce(partial);
 const save=vi.fn().mockResolvedValue(undefined);
 render(<SVCv4AssessmentPanel taskId="task" variant={variant} readOnly={false} onSave={save}/>);
 fireEvent.click(await screen.findByRole('button',{name:'计算新版评定'}));
 await screen.findByText('信息不足（部分评估）');
 expect(screen.getByText('疾病尚未明确')).toBeInTheDocument();expect(screen.getByText('遗传模式尚未明确')).toBeInTheDocument();
 expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
 expect(screen.queryByRole('alert')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'保存新版评定'}));await waitFor(()=>expect(save).toHaveBeenCalledWith(expect.objectContaining({confirmed:false,result:expect.objectContaining({state:'insufficient_context',score:null,classification:null})}),''));
});

it('restores a saved partial assessment alongside an AI context with unknown fields',async()=>{
 const field={value:'',reason:'No source',source_ids:[]};
 const partial={disease:'',moi:'',confirmed:false,inputs:{},result:{state:'insufficient_context',partial:true,missingFields:['disease','moi'],score:null,classification:null,breakdown:{},details:{},warnings:[]}};
 render(<SVCv4AssessmentPanel taskId="task" variant={{...variant,svcv4Assessment:partial,svcv4AIResult:{...suggestion,svcContext:{disease:field,moi:field,geneDiseaseValidity:field,workflow:field}}}} readOnly/>);
 await screen.findByRole('button',{name:'计算新版评定'});
 expect(screen.getByText('信息不足（部分评估）')).toBeInTheDocument();
 expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
});
