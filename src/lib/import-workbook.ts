import { LocalizedError } from '@/i18n/errors';
import { MAX_SAMPLE_IMPORT_BYTES, parseCSVRecords } from './sample-import';

export const XLSX_ACCEPT = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Generate the workbook in the browser so translated headers and the configured
// container paths always match the current deployment.
export async function createImportWorkbook(template: string, sheet = 'Import'): Promise<Blob> {
  const { default: writeXlsxFile } = await import('write-excel-file/universal');
  const records = parseCSVRecords(template);
  return writeXlsxFile(records.map((row, index) => row.cells.map(value => ({
    value, type: String, format: '@',
    ...(index === 0 ? { fontWeight: 'bold' as const, backgroundColor: '#E8EFF8' } : {}),
  }))), {
    sheet,
    columns: records[0].cells.map((_, index) => ({
      width: Math.min(80, Math.max(24, ...records.map(row => (row.cells[index]?.length ?? 0) + 4))),
    })),
  }).toBlob();
}

export async function downloadImportWorkbook(template: string, filename: string, sheet = 'Import') {
  const blob = await createImportWorkbook(template, sheet);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function readImportWorkbook(file: File, columns: number) {
  if (file.size > MAX_SAMPLE_IMPORT_BYTES) throw new LocalizedError('sampleImport.tooLarge');
  if (!file.name.toLowerCase().endsWith('.xlsx')) throw new LocalizedError('sampleImport.invalidXlsx');
  try {
    const { readSheet } = await import('read-excel-file/universal');
    const data = await readSheet(file, { trim: false, parseNumber: value => value });
    // Keep blank rows until numbering is assigned; trailing empty Excel cells
    // are omitted by readers and need padding for optional template columns.
    return data.map((row, index) => ({
      line: index + 1,
      cells: Array.from({ length: Math.max(columns || data[0]?.length || 0, row.length) }, (_, column) => {
        const cell = row[column];
        if (cell instanceof Date) throw new Error('Unexpected date cell');
        return cell == null ? '' : String(cell);
      }),
    })).filter(row => row.cells.some(cell => cell.trim()));
  } catch {
    throw new LocalizedError('sampleImport.invalidXlsx');
  }
}
