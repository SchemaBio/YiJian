import {describe,it,expect} from 'vitest';
import {createDefaultLossAssessmentCriteria,createDefaultGainAssessmentCriteria} from '../types';
import {calculateLossTotal} from './loss-calculator';
import {calculateGainTotal} from './gain-calculator';
describe('ACMG/ClinGen independent segregation evidence',()=>{
 it.each([['4F',.15],['4G',.30],['4H',.45]] as const)('scores %s using the official segregation bucket', (code,score)=>{
  const loss=createDefaultLossAssessmentCriteria(),gain=createDefaultGainAssessmentCriteria();loss.section4.segregation[code]=1;gain.section4.segregation[code]=1;
  expect(calculateLossTotal(loss).sectionScores.section4).toBe(score);expect(calculateGainTotal(gain).sectionScores.section4).toBe(score);
 });
 it('caps cumulative segregation evidence at .45',()=>{const c=createDefaultLossAssessmentCriteria();c.section4.segregation['4F']=4;expect(calculateLossTotal(c).sectionScores.section4).toBe(.45);});
});
