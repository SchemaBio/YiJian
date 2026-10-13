import { LocalizedError } from '@/i18n/errors';
/// <reference lib="webworker" />
import {evaluateRow, selectCandidates} from './engine';
import type {AssessmentContext, AssessmentRow, AutomaticAssessment} from './types';
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
