import * as React from 'react';
import {render,screen} from '@testing-library/react';
import {describe,expect,it} from 'vitest';
import {createTextTranslator} from '@/i18n/text';
import {readSNVSample} from '@/lib/snv-sample-metrics';
import type {SNVIndel} from '../types';
import {resultColumnLabels} from './ResultColumnFilter';
import {snvSampleColumns} from './SNVSampleColumns';
const t=createTextTranslator('zh-CN');
const row={id:'test',zygosity:'Heterozygous',proband:readSNVSample({VAF:'.',AD:'60,46',Genotype:'0/1'}),father:readSNVSample({VAF:'.',AD:'0,88',Genotype:'1/1'}),mother:readSNVSample({VAF:'.',AD:'50,0',Genotype:'0/0'})} as SNVIndel;
function Table({family=true,value=row}:{family?:boolean;value?:SNVIndel}){
 const columns=snvSampleColumns(family,t);
 return <table><thead><tr>{columns.map(c=><th key={c.id}>{c.header as React.ReactNode}</th>)}</tr></thead><tbody><tr>{columns.map(c=><td key={c.id}>{typeof c.accessor==='function'?c.accessor(value):null}</td>)}</tr></tbody></table>;
}
describe('family sample columns',()=>{
 it('renders each member zygosity and actual VAF, retaining real zero',()=>{
  render(<Table/>);
  for(const title of ['先证者杂合性','父亲杂合性','母亲杂合性','先证者 VAF','父亲 VAF','母亲 VAF'])expect(screen.getByRole('columnheader',{name:title})).toBeVisible();
  for(const value of ['杂合','纯合','野生型','43.4%','100.0%','0.0%'])expect(screen.getByText(value)).toBeVisible();
 });
 it('uses a missing placeholder instead of a fake zero',()=>{
  render(<Table value={{...row,mother:readSNVSample({VAF:'.',AD:'.',Genotype:'./.'})}}/>);
  expect(screen.queryByText('0.0%')).not.toBeInTheDocument();
  expect(screen.getAllByText('未提供')).toHaveLength(2);
 });
 it('does not add parent columns to a singleton table',()=>{
  render(<Table family={false}/>);
  expect(screen.getByRole('columnheader',{name:'杂合性'})).toBeVisible();
  expect(screen.getByRole('columnheader',{name:'VAF'})).toBeVisible();
  expect(screen.queryByRole('columnheader',{name:'父亲 VAF'})).not.toBeInTheDocument();
 });
});

it('maps the VAF header filters to the derived numeric fields for all three members',()=>{
 const labels=resultColumnLabels(snvSampleColumns(true,t),{columns:['VAF','Sample_VAF','VAF_father','Sample_VAF_father','VAF_mother','Sample_VAF_mother','Zygosity_father','Zygosity_mother']},'snv-indel',t);
 expect(labels).toMatchObject({Sample_VAF:'先证者 VAF',Sample_VAF_father:'父亲 VAF',Sample_VAF_mother:'母亲 VAF',Zygosity_father:'父亲杂合性',Zygosity_mother:'母亲杂合性'});
});
