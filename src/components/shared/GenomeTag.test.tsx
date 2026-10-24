import {render,screen} from '@testing-library/react';
import {expect,it} from 'vitest';
import {GenomeTag} from './GenomeTag';
it('normalizes reference aliases and uses distinct genome palettes',()=>{
 render(<><GenomeTag genome="GRCh37"/><GenomeTag genome="GRCh38"/></>);
 expect(screen.getByText('hg19')).toHaveAttribute('data-genome','hg19');
 expect(screen.getByText('hg19').className).toContain('bg-blue-50');
 expect(screen.getByText('hg38').className).toContain('bg-purple-50');
});
