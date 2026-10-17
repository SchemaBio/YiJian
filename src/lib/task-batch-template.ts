export const TASK_BATCH_TEMPLATE_URL = '/outputs/01a033ef-28c3-7ce2-83fa-633c8032fc26/task-batch-import-template.xlsx';
export function downloadTaskBatchTemplate():void {
 const link=document.createElement('a');
 link.href=TASK_BATCH_TEMPLATE_URL;link.download='task-batch-import-template.xlsx';
 document.body.appendChild(link);link.click();link.remove();
}
