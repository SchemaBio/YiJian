import { LocalizedError } from '@/i18n/errors';
/// <reference lib="webworker" />
import {evaluateRow, selectCandidates} from './engine';
import type {AssessmentContext, AssessmentRow, AutomaticAssessment,ReferenceSupplement} from './types';
import {ASSESSMENT_BATCH_SIZE} from './transport';
let context: AssessmentContext | undefined;
let evaluated: {row: AssessmentRow; assessment: AutomaticAssessment}[] = [];
let completed = false;
let cursor = 0;
self.onmessage = (event: MessageEvent) => {
  const {id, action, payload} = event.data;
  try {
    if (action === 'init') {context=payload; evaluated=[]; completed=false;cursor=0; self.postMessage({id,value:true});return;}
    if (!context) throw new LocalizedError("display.assessmentContextNotFixedYet2c45a3");
    if(action==='references'){
      const supplement=payload as ReferenceSupplement;
      if(supplement.resourceVersion!==context.referenceVersion)throw new Error('Reference version mismatch');
      if(!context.supplement)context.supplement={...supplement,canonical:{},matches:{},background:{}};
      Object.assign(context.supplement.canonical,supplement.canonical);Object.assign(context.supplement.matches,supplement.matches);Object.assign(context.supplement.background,supplement.background);context.supplement.warnings=supplement.warnings;
      self.postMessage({id,value:true});return;
    }
    if(action==='references-unavailable'){
      context.supplement=undefined;
      for(const {assessment} of evaluated){if(assessment.phenotypePriority)assessment.pinned=assessment.legacyPinned??false;assessment.phenotypePriority=false;assessment.phenotypeMatch=undefined;assessment.pinReasons=assessment.pinReasons.filter(reason=>reason!=='HPO 相关且初评致病/可能致病');}
      self.postMessage({id,value:true});return;
    }
    if (action === 'batch') {
      if(completed)throw new LocalizedError("display.assessmentCompleted80797a");
      for (const row of payload as AssessmentRow[]) {
        const assessment=evaluateRow(row,context);
        // Full annotations are not retained by the assessment worker.
        evaluated.push({row:{...row,values:{}},assessment});
      }
      self.postMessage({id,value:evaluated.length});return;
    }
    if (action === 'finish') {
      if(!completed)selectCandidates(evaluated,context);
      completed=true;
      self.postMessage({id,value:evaluated.length});return;
    }
    if (action === 'drain') {
      if(!completed)throw new LocalizedError("display.assessmentNotCompleted170cb7");
      const end=Math.min(cursor+ASSESSMENT_BATCH_SIZE,evaluated.length);
      const values=evaluated.slice(cursor,end).map(x=>({table:x.row.table,rowId:x.row.id,assessment:x.assessment}));
      // Release each returned batch without shifting the remaining array.
      for(let i=cursor;i<end;i++)delete evaluated[i];cursor=end;
      self.postMessage({id,value:values});
      if(cursor===evaluated.length){evaluated=[];cursor=0;context=undefined;}
      return;
    }
    throw new LocalizedError("display.unknownAssessmentOperationba5220");
  } catch {self.postMessage({id,error:'本地初评失败；未发布不完整评估结果',errorKey:'本地初评失败；未发布不完整评估结果'});}
};
