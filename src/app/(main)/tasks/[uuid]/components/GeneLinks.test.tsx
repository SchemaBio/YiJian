import {fireEvent,render,screen} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import {GeneLinks} from './GeneLinks';
it('uses the supplied NCBI ID for one gene and avoids triggering row selection',()=>{
 const select=vi.fn();render(<div onClick={select}><GeneLinks genes="BRCA1" annotationValues={{NCBI_Gene_ID:'672'}} /></div>);
 const link=screen.getByRole('link',{name:'BRCA1'});
 expect(link).toHaveAttribute('href','https://www.ncbi.nlm.nih.gov/gene/672');
 fireEvent.click(link);expect(select).not.toHaveBeenCalled();
});
it('creates distinct human symbol lookups instead of assigning one ID to several genes',()=>{
 render(<GeneLinks genes="BRCA1;SCN1A" annotationValues={{NCBI_Gene_ID:'672'}} />);
 for(const symbol of ['BRCA1','SCN1A']){
  const link=screen.getByRole('link',{name:symbol});
  const url=new URL(link.getAttribute('href')!);
  expect(url.searchParams.get('term')).toBe(`"${symbol}"[sym] AND 9606[taxid]`);
  expect(link).toHaveAttribute('target','_blank');
 }
});
