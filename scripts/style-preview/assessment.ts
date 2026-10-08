export * from '../../src/lib/assessment/client';
let current: any = {taskId:'preview-task',state:'ready',processed:55393,pinned:3,pinnedByTable:{'snv-indel':3},version:'preview-v1',packVersion:'preview',pending:['合成提示 · 缺少家系证据']};
export const assessmentStatus = (taskId:string) => ({...current,taskId});
export function previewAssessment(state:string) {current={...current,state};window.dispatchEvent(new CustomEvent('yijian:assessment-status',{detail:current}));}
export const cancelAssessment = () => previewAssessment('cancelled');
