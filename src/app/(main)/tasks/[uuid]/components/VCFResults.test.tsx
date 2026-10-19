import * as React from 'react';
import {render,screen} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import {VariantTypeNav} from './VariantTypeNav';
import {ResultOverview} from './ResultOverview';
import type {ResultContext} from '../types';
vi.mock('./QCResultTab',()=>({SampleFamilyTable:()=> <div>family-qc</div>,QCAndFamilyTables:()=> <div>sequencing-qc</div>}));
it('shows only SNP/InDel navigation and no missing WES QC for a VCF result',()=>{
 const context={state:'ready',members:[],reference:{available:false},types:{'snv-indel':{total:0,focused:0}},capabilities:['snv_indel','report','vcf'],vcfAnnotation:{sex_inference:{x_sum:0,sex:'unknown',ratio:null}}} as unknown as ResultContext;
 render(<><VariantTypeNav activeTab="snv-indel" context={context} snvOnly onTabChange={vi.fn()}/><ResultOverview context={context} onNavigate={vi.fn()}/></>);
 expect(screen.queryByText('CNV(Region)')).not.toBeInTheDocument();expect(screen.queryByText('sequencing-qc')).not.toBeInTheDocument();expect(screen.queryByText('family-qc')).not.toBeInTheDocument();expect(screen.getByText('推算性别')).toBeInTheDocument();
});
