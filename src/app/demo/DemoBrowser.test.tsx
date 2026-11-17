import { renderToStaticMarkup } from 'react-dom/server';
import { expect,it,vi } from 'vitest';
import { PublicProviders } from '@/components/providers/PublicProviders';
import { DemoBrowser } from './DemoBrowser';
import { PublicResultContext } from '@/components/shared/PublicResultContext';
import { MTDetailPanelView } from '@/app/(main)/tasks/[uuid]/components/MTDetailPanelView';
import { mapMT } from '@/app/(main)/tasks/[uuid]/result-mappers';
import { demoBackendRow } from '@/lib/demo/workspace-source';
vi.mock('next/navigation',()=>({usePathname:()=>'/demo',useRouter:()=>({refresh:vi.fn(),replace:vi.fn(),push:vi.fn()})}));

it('uses the actual YiJian shell and logo and links back to the canonical website',()=>{
 const html=renderToStaticMarkup(<PublicProviders locale="zh-CN"><DemoBrowser/></PublicProviders>);
 expect(html).toContain('src="/logo.svg"');
 expect(html).toContain('yj-workspace');
 expect(html).toContain('href="https://www.schema-bio.com/"');
 expect(html).not.toContain('demo-shell');
 expect(html).not.toMatch(/href="\/(tasks|samples|pipeline|settings|dashboard)(?:["/])/);
});
it('retains original mitochondrial annotations in public mode while removing online resources',()=>{
 const variant=mapMT(demoBackendRow({__demo_ordinal:1,Chromosome:'MT',Position:'73',Ref:'A',Alt:'G',MT_Gene:'MT-ND1',Heteroplasmy:'0.5',Depth:'90',MT_HGVS:'m.73A>G'},'mt','demo'));
 const html=renderToStaticMarkup(<PublicResultContext.Provider value={true}><MTDetailPanelView taskId="demo" variant={variant} isOpen onClose={()=>undefined} onSaveAssessment={async()=>undefined} MTACMGEditor={()=><></>}/></PublicResultContext.Provider>);
 expect(html).toContain('MT-ND1');
 expect(html).toContain('m.73A&gt;G');
 expect(html).not.toContain('href="https://www.mitomap.org');
 expect(html).not.toContain('href="https://www.hmtvar');
});
