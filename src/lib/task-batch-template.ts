import {downloadImportWorkbook} from './import-workbook';
export async function downloadTaskBatchTemplate():Promise<void> {
 await downloadImportWorkbook('样本ID,流程ID,任务备注\nSAMPLE-001,builtin-wes-single-hg19,\nPROBAND-001,builtin-wes-family-hg19,','task-batch-import-template.xlsx','批量任务');
}
