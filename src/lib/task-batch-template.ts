import {downloadImportWorkbook} from './import-workbook';
export async function downloadTaskBatchTemplate():Promise<void> {
 await downloadImportWorkbook('样本ID,流程ID,任务备注,启用CNV,启用SV\nSAMPLE-001,builtin-wes-single-hg19,,TRUE,FALSE\nPROBAND-001,builtin-wes-family-hg19,,TRUE,FALSE','task-batch-import-template.xlsx','批量任务');
}
