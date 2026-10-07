/// <reference lib="webworker" />
import {evaluateRow, selectCandidates} from './engine';
import type {AssessmentContext, AssessmentRow, AutomaticAssessment} from './types';
let context: AssessmentContext | undefined;
let evaluated: {row: AssessmentRow; assessment: AutomaticAssessment}[] = [];
self.onmessage = (event: MessageEvent) => {
  const {id, action, payload} = event.data;
  try {
    if (action === 'init') {context=payload; evaluated=[]; self.postMessage({id,value:true});return;}
    if (!context) throw new Error('评估上下文尚未固定');
    if (action === 'batch') {
      for (const row of payload as AssessmentRow[]) {
        const assessment=evaluateRow(row,context);
        // Full annotations are not retained by the assessment worker.
        evaluated.push({row:{...row,values:{}},assessment});
      }
      self.postMessage({id,value:evaluated.length});return;
    }
    if (action === 'finish') {
      const values=selectCandidates(evaluated,context);
      self.postMessage({id,value:values.map(x=>({table:x.row.table,rowId:x.row.id,assessment:x.assessment}))});
      evaluated=[];return;
    }
    throw new Error('未知评估操作');
  } catch {self.postMessage({id,error:'本地初评失败；未发布不完整评估结果'});}
};
