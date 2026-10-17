import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NewSampleModal } from './NewSampleModal';
const mode=vi.hoisted(()=>({backend:'squid'}));
vi.mock('@/lib/runtime-config',()=>({getRuntimeBackendFlavor:()=>mode.backend}));
vi.mock('@/lib/hpo-terms',()=>({useHpoTerms:()=>[],searchHpoTerms:()=>[]}));
vi.mock('@/components/shared/AIDiagnosisField',()=>({AIDiagnosisField:()=>null}));
// The shared checkbox measures its native input; jsdom has no layout observer.
beforeEach(() => vi.stubGlobal('ResizeObserver', class {
 observe() {}
 unobserve() {}
 disconnect() {}
}));
afterEach(() => vi.unstubAllGlobals());
it('requires fresh identity confirmation and sends its version with creation',async()=>{
 mode.backend='squid';
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

it('creates a self-hosted sample without identity acknowledgement',async()=>{
 mode.backend='octopus';const submit=vi.fn().mockResolvedValue(undefined);
 render(<NewSampleModal isOpen onClose={()=>{}} onSubmit={submit}/>);
 expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
 fireEvent.change(screen.getAllByRole('textbox')[0],{target:{value:'local-001'}});
 fireEvent.click(screen.getByRole('button',{name:'创建样本'}));
 await waitFor(()=>expect(submit).toHaveBeenCalled());
 expect(submit.mock.calls[0][0]).not.toHaveProperty('identityPolicyAcknowledged');
});
