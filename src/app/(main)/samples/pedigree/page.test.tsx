import {expect,it,vi} from 'vitest';
import {redirect} from 'next/navigation';
import PedigreePage from './page';
vi.mock('next/navigation',()=>({redirect:vi.fn()}));
it('redirects the retired pedigree workspace to samples',()=>{PedigreePage();expect(redirect).toHaveBeenCalledWith('/samples');});
