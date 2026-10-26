import {describe,it,expect} from 'vitest';
import {cnvBEDCoordinateSystem} from './cnv-coordinate-system';
describe('versioned CNV BED coordinate recognition',()=>{
 it.each([['cnv-segment',8],['cnv-exon',19]] as const)('recognizes %s with appended annotation columns', (table,last)=>{const core=['Chromosome','Start','End',...Array.from({length:last-3},(_,i)=>`Col${i+4}`)];expect(cnvBEDCoordinateSystem(table,core)).toBe('0-based-half-open');expect(cnvBEDCoordinateSystem(table,[...core,'Classification','Evidence_2A','ISCN','ISCN_Candidate','Gene_Count'])).toBe('0-based-half-open');expect(cnvBEDCoordinateSystem(table,core.slice(0,-1))).toBeUndefined();expect(cnvBEDCoordinateSystem(table,[...core,'Col99'])).toBeUndefined();});
 it('does not infer a convention from generic coordinate names or another table',()=>{expect(cnvBEDCoordinateSystem('cnv-exon',['Chromosome','Start','End'])).toBeUndefined();expect(cnvBEDCoordinateSystem('str',['Chromosome','Start','End'])).toBeUndefined();});
});
