import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { NewSampleModal } from './NewSampleModal';
vi.mock('@/lib/hpo-terms',()=>({useHpoTerms:()=>[],searchHpoTerms:()=>[]}));
vi.mock('@/components/shared/AIDiagnosisField',()=>({AIDiagnosisField:()=>null}));
it('requires fresh identity confirmation and sends its version with creation',async()=>{
 const submit=vi.fn().mockResolvedValue(undefined),close=vi.fn();
 const {rerender}=render(<NewSampleModal isOpen onClose={close} onSubmit={submit} />);
 const checkbox=screen.getByRole('checkbox');expect(checkbox).not.toBeChecked();
 const create=screen.getByRole('button',{name:'创建样本'});expect(create).toBeDisabled();
 fireEvent.submit(document.querySelector('form')!);expect(submit).not.toHaveBeenCalled();
 fireEvent.change(screen.getAllByRole('textbox')[0],{target:{value:'research-001'}});
 fireEvent.click(checkbox);expect(create).toBeEnabled();fireEvent.click(create);
 await waitFor(()=>expect(submit).toHaveBeenCalledWith(expect.objectContaining({internalId:'research-001',identityPolicyAcknowledged:true,identityPolicyVersion:'research-identity-v1'})));
 rerender(<NewSampleModal isOpen={false} onClose={close} onSubmit={submit} />);
 rerender(<NewSampleModal isOpen onClose={close} onSubmit={submit} />);
 expect(screen.getByRole('checkbox')).not.toBeChecked();
});
