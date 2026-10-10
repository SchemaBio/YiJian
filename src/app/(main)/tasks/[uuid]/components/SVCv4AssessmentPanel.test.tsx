import * as React from 'react';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {describe,it,expect,vi} from 'vitest';
import {SVCv4AssessmentPanel,EvidenceFields} from './SVCv4AssessmentPanel';
import {evaluateSVCv4} from '@/lib/svcv4';
import type {SNVIndel} from '../types';

vi.mock('@/lib/svcv4',()=>({getSVCv4Schema:vi.fn().mockResolvedValue({revision:'fixed',source:'https://example.org',moi:['AD'],geneDiseaseValidity:['MODERATE'],workflows:[],population:{type:'object',properties:{faf:{type:'number'}}},case:{type:'object',properties:{id:{type:'string'}}},caseControl:{type:'object',properties:{}},unsupported:[]}),evaluateSVCv4:vi.fn()}));
vi.mock('../result-api',()=>({ACMG_CONFIG:{VUS:{label:'意义未明'}}}));
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
